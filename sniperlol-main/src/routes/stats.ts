// src/routes/stats.ts
import { Router } from "express";
import axios from "axios";
import { platformToRegional, PROBE_AMERICAS, PROBE_DEFAULT } from "../utils/regions.js";

import {
  getSummonerByPUUID,
  getChampionMasteriesByPUUID,
  getLeagueEntriesBySummonerId,
  getAccountByPUUID,
  getMatchIdsByPUUID,
  getMatchById,
  getLiveGame,
} from "../services/riot.js";

const r = Router();
const RIOT_KEY = process.env.RIOT_API_KEY;

// Helper: GET con reintentos cuando Riot devuelve 429
async function riotGet<T = any>(url: string, opts: any = {}, tries = 3): Promise<{ data: T }> {
  try {
    return await axios.get<T>(url, opts);
  } catch (e: any) {
    const status = e?.response?.status;
    if (status === 429 && tries > 0) {
      const ra = Number(e?.response?.headers?.["retry-after"]) || 1;
      await new Promise((r) => setTimeout(r, ra * 1000));
      return riotGet<T>(url, opts, tries - 1);
    }
    throw e;
  }
}

// Log simple
r.use((req, _res, next) => {
  console.log("[STATS]", req.method, req.path);
  next();
});

/**
 * GET /api/stats/resolve?region=la1&gameName=Kister&tagLine=NGC
 */
r.get("/resolve", async (req, res) => {
  try {
    const { region, gameName, tagLine } = req.query as any;
    if (!region || !gameName || !tagLine) {
      return res.status(400).json({ message: "region, gameName y tagLine son requeridos" });
    }
    if (!RIOT_KEY) return res.status(500).json({ message: "RIOT_API_KEY missing" });

    const regional = platformToRegional(region);
    const { data } = await axios.get(
      `https://${regional}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
        gameName
      )}/${encodeURIComponent(tagLine)}`,
      { headers: { "X-Riot-Token": RIOT_KEY } }
    );
    return res.json({ puuid: data.puuid, gameName: data.gameName, tagLine: data.tagLine });
  } catch (e: any) {
    console.error("RESOLVE ERR →", e?.response?.status, e?.response?.data);
    return res.status(e?.response?.status || 500).json({
      message: e?.response?.data?.status?.message || e?.message || "resolve failed",
    });
  }
});

/**
 * GET /api/stats/summary/:platform/:puuid
 * -> { summoner, rank, masteryTop, platformUsed }
 */
r.get("/summary/:platform/:puuid", async (req, res) => {
  const { platform, puuid } = req.params as { platform: string; puuid: string };

  const tryPlatforms = [platform, ...PROBE_AMERICAS.filter((p) => p !== platform)];
  const warnings: string[] = [];
  let pfUsed: string | null = null;

  // A) summoner-v4 (por PUUID)
  let summoner: { name: string; level: number; id: string; profileIconId?: number } | null = null;
  for (const pf of tryPlatforms) {
    try {
      const s = await getSummonerByPUUID(pf, puuid);
      if (s) {
        summoner = { name: s.name, level: s.summonerLevel, id: s.id, profileIconId: s.profileIconId };
        pfUsed = pf;
        break;
      }
    } catch (e: any) {
      const code = e?.response?.status;
      if (code === 403) return res.status(403).json({ message: "Forbidden (Riot 403)" });
      if (code !== 404) return res.status(code || 500).json(e?.response?.data || { message: "summoner failed" });
    }
  }
  if (!summoner) {
    try {
      const acc = await getAccountByPUUID(puuid, { platformHint: platform });
      summoner = { name: acc?.gameName ?? "—", level: 0, id: "", profileIconId: undefined };
      warnings.push("No se pudo obtener summoner-v4; usando nombre de account-v1.");
    } catch {
      summoner = { name: "—", level: 0, id: "" };
      warnings.push("No se pudo obtener nombre/level del invocador.");
    }
  }

  // B) league-v4 (rank)
  let rank: { queue: string; tier: string; rank: string; lp: number; wins: number; losses: number }[] = [];
  if (summoner.id && pfUsed) {
    try {
      const le = await getLeagueEntriesBySummonerId(pfUsed, summoner.id);
      rank = (le || []).map((q) => ({
        queue: q.queueType, // "RANKED_SOLO_5x5" | "RANKED_FLEX_SR"
        tier: q.tier,
        rank: q.rank,
        lp: q.leaguePoints,
        wins: (q as any).wins ?? 0,
        losses: (q as any).losses ?? 0,
      }));
    } catch (e: any) {
      if (e?.response?.status === 403) warnings.push("League-v4 devolvió 403. Ocultando rank.");
      else warnings.push("No se pudo traer league-v4.");
    }
  }

  // C) champion-mastery-v4 (top 5)
  let masteryTop: { championId: number; championName: string; level: number; points: number }[] = [];
  const platformsForMastery = pfUsed ? [pfUsed, ...tryPlatforms.filter((p) => p !== pfUsed)] : tryPlatforms;
  for (const pf of platformsForMastery) {
    try {
      const list = await getChampionMasteriesByPUUID(pf, puuid);
      masteryTop = list.slice(0, 5).map((m) => ({
        championId: m.championId,
        championName: String(m.championId),
        level: m.championLevel,
        points: m.championPoints,
      }));
      pfUsed = pfUsed || pf;
      break;
    } catch (e: any) {
      const code = e?.response?.status;
      if (code === 403) {
        warnings.push("Mastery-v4 devolvió 403.");
        break;
      }
      if (code !== 404) {
        warnings.push("Error trayendo masteries.");
        break;
      }
    }
  }

  return res.json({
    summoner,
    rank,
    masteryTop,
    platformUsed: pfUsed ?? platform,
    _warnings: warnings.length ? warnings : undefined,
  });
});

/**
 * GET /api/stats/recent/:platform/:puuid?count=10&queues=420,440
 */
r.get("/recent/:platform/:puuid", async (req, res) => {
  try {
    const { platform, puuid } = req.params as { platform: string; puuid: string };
    const { count = "10", queues } = req.query as { count?: string; queues?: string };

    const regional = platformToRegional(platform);
    if (!RIOT_KEY) return res.status(500).json({ message: "RIOT_API_KEY missing" });
    const headers = { "X-Riot-Token": RIOT_KEY };

    const idsRes = await riotGet<string[]>(
      `https://${regional}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids`,
      { headers, params: { start: 0, count: Number(count) } }
    );
    const ids = idsRes.data || [];

    const onlyQueues = queues
      ? new Set(
          String(queues)
            .split(",")
            .map((q) => Number(q.trim()))
            .filter(Boolean)
        )
      : undefined;

    type Row = {
      championId: number;
      championName: string;
      games: number;
      wins: number;
      losses: number;
      k: number;
      d: number;
      a: number;
    };
    const agg = new Map<number, Row>();

    // secuencial para evitar 429
    for (const id of ids) {
      const { data: match } = await riotGet(
        `https://${regional}.api.riotgames.com/lol/match/v5/matches/${id}`,
        { headers }
      );
      const info = (match as any)?.info;
      if (!info) continue;
      if (onlyQueues && !onlyQueues.has(info.queueId)) continue;

      const p = info.participants.find((x: any) => x.puuid === puuid);
      if (!p) continue;

      const key = p.championId as number;
      const row =
        agg.get(key) ||
        ({
          championId: key,
          championName: String(p.championName || key),
          games: 0,
          wins: 0,
          losses: 0,
          k: 0,
          d: 0,
          a: 0,
        } as Row);

      row.games += 1;
      p.win ? (row.wins += 1) : (row.losses += 1);
      row.k += p.kills || 0;
      row.d += p.deaths || 0;
      row.a += p.assists || 0;

      agg.set(key, row);
    }

    const champions = Array.from(agg.values())
      .map((r) => ({
        championId: r.championId,
        championName: r.championName,
        games: r.games,
        wins: r.wins,
        losses: r.losses,
        winRate: r.games ? Math.round((r.wins / r.games) * 100) : 0,
        kda: r.d === 0 ? (r.k + r.a).toFixed(2) : ((r.k + r.a) / r.d).toFixed(2),
        avgKills: (r.k / r.games).toFixed(1),
        avgDeaths: (r.d / r.games).toFixed(1),
        avgAssists: (r.a / r.games).toFixed(1),
      }))
      .sort((a, b) => b.games - a.games);

    return res.json({ champions });
  } catch (e: any) {
    return res.status(e?.response?.status || 500).json({
      message: e?.response?.data?.status?.message || e?.message || "recent failed",
    });
  }
});

// GET /api/stats/matches/:regional/:puuid/ids
r.get("/matches/:regional/:puuid/ids", async (req, res) => {
  try {
    const { regional, puuid } = req.params as { regional: string; puuid: string };
    const { count = "5", start = "0" } = req.query as any;
    console.log("[STATS] matches/ids →", { regional, puuid: puuid?.slice(0, 8), count, start });

    const ids = await getMatchIdsByPUUID(regional, puuid, Number(count), Number(start));
    console.log("[STATS] matches/ids OK →", ids.length);
    return res.json(ids);
  } catch (e: any) {
    console.warn("[STATS] matches/ids ERR →", e?.response?.status, e?.message);
    return res.status(e?.response?.status || 500).json({ message: e?.message || "match ids failed" });
  }
});

/**
 * GET /api/stats/matches/:regional/:matchId?puuid=<puuid>
 */
r.get("/matches/:regional/:matchId", async (req, res) => {
  try {
    const { regional, matchId } = req.params as { regional: string; matchId: string };
    const { puuid } = req.query as { puuid?: string };

    const match = await getMatchById(regional, matchId);
    if (!match) return res.status(404).json({ message: "Match not found" });
    if (!puuid) return res.json(match);

    const info = (match as any).info;
    const me = info?.participants?.find((x: any) => x.puuid === puuid);
    if (!me) return res.status(404).json({ message: "Participant not found" });

    const teamId = me.teamId;
    const teamKills = info.participants
      .filter((p: any) => p.teamId === teamId)
      .reduce((a: number, p: any) => a + (p.kills || 0), 0);

    const items = [me.item0, me.item1, me.item2, me.item3, me.item4, me.item5].filter((x: any) => Number.isInteger(x));
    const trinket = Number.isInteger(me.item6) ? me.item6 : undefined;

    const out = {
      matchId,
      championId: me.championId,
      championName: me.championName,
      win: Boolean(me.win),
      kills: me.kills,
      deaths: me.deaths,
      assists: me.assists,
      kda: (me.kills + me.assists) / Math.max(me.deaths, 1),
      cs: (me.totalMinionsKilled ?? 0) + (me.neutralMinionsKilled ?? 0),
      gameDuration: info.gameDuration,
      gameMode: info.gameMode ?? info.queueId,
      gameStartTimestamp: info.gameStartTimestamp,
      queueId: info.queueId,
      championLevel: me.champLevel,
      gold: me.goldEarned,
      totalDamageDealtToChampions: me.totalDamageDealtToChampions,

      items,
      trinket,
      summonerSpells: [me.summoner1Id, me.summoner2Id],
      perks: me.perks,
      role: me.role,
      lane: me.lane,

      killParticipation: teamKills ? (me.kills + me.assists) / teamKills : undefined,
      playerAugments: [me.playerAugment1, me.playerAugment2, me.playerAugment3, me.playerAugment4].filter((x: any) =>
        Number.isInteger(x)
      ),
      teamParticipants: info.participants.map((p:any) => ({
  teamId: p.teamId,
  championId: p.championId,
  summonerName: p.riotIdGameName || p.summonerName || "Invocador",
  puuid: p.puuid,
  kills: p.kills,
  deaths: p.deaths,
  assists: p.assists,
  items: [p.item0,p.item1,p.item2,p.item3,p.item4,p.item5].filter(Number.isInteger),
  trinket: Number.isInteger(p.item6) ? p.item6 : undefined,
})),
    };

    return res.json(out);
  } catch (e: any) {
    return res.status(e?.response?.status || 500).json({ message: e?.message || "match detail failed" });
  }
});

/**
 * GET /api/stats/spectator/:platform/:puuid
 */

r.get("/spectator/:platform/:puuid", async (req, res) => {
  try {
    const platform = String(req.params.platform).toLowerCase();
    const puuid = String(req.params.puuid);
    const wantRank = String(req.query.rank || "0") === "1";

    const ALLOWED = new Set(["la1","la2","na1","br1","oc1","euw1","eun1","tr1","ru","jp1","kr"]);
    if (!ALLOWED.has(platform)) {
      return res.status(400).json({ error: "invalid platform", platform });
    }
    if (!RIOT_KEY) return res.status(500).json({ error: "RIOT_API_KEY missing" });

    const headers = { "X-Riot-Token": RIOT_KEY };

    // Probe multiple platforms because the PUUID may have summoner profiles on different regions
    // (very common with LAN/LAS/NA/BR players). This prevents false 404s when the page
    // was loaded for one platform but the player is playing on another.
    // Use a safe list of platforms. Some SEA hosts (th2, tw2, vn2 etc.) do not reliably resolve
    // for the public Riot API and cause DNS errors (getaddrinfo ENOTFOUND).
    // We keep only well-supported platforms for now.
    const SAFE_PROBE_PLATFORMS = [
      ...PROBE_AMERICAS,
      "euw1", "eun1", "tr1", "ru",
      "kr", "jp1"
      // SEA platforms are commented because several (th2, tw2, vn2, etc.) cause DNS failures.
      // "ph2", "sg2" // only enable if you have confirmed they work for your region
    ];
    const tryPlatforms = [platform, ...SAFE_PROBE_PLATFORMS.filter((p: any) => p !== platform)];

    let summoner: any = null;
    let usedPlatform = platform;

    for (const pf of tryPlatforms) {
      try {
        const s = await getSummonerByPUUID(pf as any, puuid);
        if (s?.id) {
          summoner = s;
          usedPlatform = pf;
          break;
        }
      } catch (e: any) {
        if (e?.response?.status === 403) {
          return res.status(403).json({ error: "Forbidden (Riot 403)" });
        }
      }
    }

    let g: any = null;

    if (summoner?.id) {
      // Preferred path: we have a summoner id on a known platform
      try {
        g = await getLiveGame(usedPlatform as any, summoner.id);
      } catch (e: any) {
        const st = e?.response?.status;
        if (st === 404 || st === 403) {
          // continue to fallback below
        } else {
          return res.status(st || 500).json(e?.response?.data || { error: "spectator failed" });
        }
      }
    }

    if (!g) {
      // Fallback: no summoner profile found (or by-summoner failed), try direct by-puuid on all probed platforms.
      // This is important because by-puuid can sometimes succeed even when summoner/v4 lookup fails for the PUUID on that platform.
      console.log(`[spectator] No summoner found or no game via by-summoner for ${puuid}. Falling back to direct by-puuid on ${tryPlatforms.length} platforms...`);

      for (const pf of tryPlatforms) {
        try {
          const directUrl = `https://${pf}.api.riotgames.com/lol/spectator/v5/active-games/by-puuid/${encodeURIComponent(puuid)}`;
          const directRes = await riotGet(directUrl, { headers: { "X-Riot-Token": RIOT_KEY } });
          const directData = directRes?.data;

          if (directData && Array.isArray(directData.participants) && directData.participants.length > 0) {
            g = directData;
            usedPlatform = pf;
            console.log(`[spectator] SUCCESS via direct by-puuid fallback on platform ${pf}`);
            break;
          }
        } catch (e: any) {
          const st = e?.response?.status;
          if (st === 404 || st === 403) {
            continue; // expected, player not on this platform
          }
          // Network errors (DNS ENOTFOUND, connection refused, etc.) have no response.status.
          // Just skip the platform silently — these are common for non-existent SEA hosts.
          if (!st) {
            continue;
          }
          console.warn(`[spectator direct fallback] unexpected error on ${pf}:`, st || e?.code || e?.message);
        }
      }
    }

    if (!g) {
      return res.status(404).json({ 
        error: "No active game found after full probing (summoner lookup + direct by-puuid fallback)",
        triedPlatforms: tryPlatforms,
        puuid 
      });
    }

    // Participantes con campos útiles de v5
    // éxito
const participants = (g.participants || []).map((p: any) => {
  // spectator-v5 trae spell1Id, spell2Id y perks con perkIds, perkStyle, perkSubStyle
  const perkIds: number[] = p?.perks?.perkIds || [];
  // keystone suele venir como el primer perk de la rama primaria
  const keystone = perkIds[0];

  return {
    summonerName: p.riotIdGameName || p.summonerName || "Invocador",
    championId: p.championId,
    teamId: p.teamId,
    puuid: p.puuid,

    // 👇 nuevo
    spell1Id: p.spell1Id,
    spell2Id: p.spell2Id,
    perks: {
      keystone,
      primaryStyle: p?.perks?.perkStyle,
      subStyle: p?.perks?.perkSubStyle,
    },

    // placeholder rank; lo completamos abajo si ?rank=1
    rank: null as null | { tier: string; rank: string; lp: number },
  };
});

if (String(req.query.rank) === "1") {
  // Trae rank para cada summonerId (máximo 10 → OK con rate limits suaves)
  const axiosOpts = { headers: { "X-Riot-Token": RIOT_KEY } };
  await Promise.allSettled(
    participants.map(async (pp: any, i: number) => {
      try {
        const sum = await riotGet<{ id: string }>(
          `https://${usedPlatform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(pp.puuid || "")}`,
          axiosOpts
        );
        if (!sum?.data?.id) return;

        const le = await riotGet<any[]>(
          `https://${usedPlatform}.api.riotgames.com/lol/league/v4/entries/by-summoner/${sum.data.id}`,
          axiosOpts
        );
        const best = (le.data || []).find((x: any) => x.queueType === "RANKED_SOLO_5x5") || (le.data || [])[0];
        if (best) {
          participants[i].rank = {
            tier: best.tier,
            rank: best.rank,
            lp: best.leaguePoints,
          };
        }
      } catch {}
    })
  );
}

// Calcular duración desde gameStartTime (ms → seconds)
const gameLength = g.gameStartTime
  ? Math.floor((Date.now() - g.gameStartTime) / 1000)
  : (g.gameLength ?? 0);

return res.json({
  gameId:       g.gameId,
  platformId:   g.platformId,
  platformUsed: usedPlatform,           // helpful when we had to probe other regions
  gameMode:     g.gameMode,
  gameType:     g.gameType,
  gameStartTime:g.gameStartTime,
  gameLength,
  queueId:      g.gameQueueConfigId,
  mapId:        g.mapId,
  observers:    g.observers || null,
  encryptionKey: g.observers?.encryptionKey || null,
  bannedChampions: (g.bannedChampions || []).map((b: any) => ({
    championId: b.championId,
    teamId:     b.teamId,
    pickTurn:   b.pickTurn,
  })),
  participants,
});
  } catch (e: any) {
    const st = e?.response?.status;
    if (st === 404 || st === 403) return res.sendStatus(204);
    return res.status(st || 500).json({ error: e?.message || "spectator failed" });
  }
});


// Imprime rutas
setImmediate(() => {
  const paths = (r as any).stack
    ?.filter((l: any) => l?.route?.path)
    .map((l: any) => `${Object.keys(l.route.methods)[0].toUpperCase()} ${l.route.path}`);
  console.log("[STATS] routes:", paths);
});

/**
 * GET /api/stats/champion-stats/:platform/:puuid?count=20&queues=420,440
 */
r.get("/champion-stats/:platform/:puuid", async (req, res) => {
  try {
    const { platform, puuid } = req.params as { platform: string; puuid: string };
    const { count = "20", queues } = req.query as { count?: string; queues?: string };

    const regional = platformToRegional(platform);
    if (!RIOT_KEY) return res.status(500).json({ message: "RIOT_API_KEY missing" });
    const headers = { "X-Riot-Token": RIOT_KEY };

    const idsRes = await riotGet<string[]>(
      `https://${regional}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids`,
      { headers, params: { start: 0, count: Number(count) } }
    );
    const ids = idsRes.data || [];

    const onlyQueues = queues
      ? new Set(
          String(queues)
            .split(",")
            .map((q) => Number(q.trim()))
            .filter(Boolean)
        )
      : undefined;

    type Row = { games: number; wins: number; losses: number; k: number; d: number; a: number };
    const agg = new Map<number, Row>();

    // secuencial + riotGet
    for (const id of ids) {
      const r = await riotGet(`https://${regional}.api.riotgames.com/lol/match/v5/matches/${id}`, { headers });
      const info = (r.data as any)?.info;
      if (!info) continue;
      if (onlyQueues && !onlyQueues.has(info.queueId)) continue;

      const p = info.participants?.find((x: any) => x.puuid === puuid);
      if (!p) continue;

      const key = Number(p.championId);
      const row =
        agg.get(key) ||
        ({ games: 0, wins: 0, losses: 0, k: 0, d: 0, a: 0 } as Row);

      row.games += 1;
      p.win ? (row.wins += 1) : (row.losses += 1);
      row.k += p.kills || 0;
      row.d += p.deaths || 0;
      row.a += p.assists || 0;

      agg.set(key, row);
    }

    const out: Record<
      number,
      { games: number; wins: number; losses: number; winRate: number; kda: string; avgKills: string; avgDeaths: string; avgAssists: string }
    > = {};

    for (const [champId, rrow] of agg.entries()) {
      const kda = rrow.d === 0 ? rrow.k + rrow.a : (rrow.k + rrow.a) / rrow.d;
      out[champId] = {
        games: rrow.games,
        wins: rrow.wins,
        losses: rrow.losses,
        winRate: rrow.games ? Math.round((rrow.wins / rrow.games) * 100) : 0,
        kda: kda.toFixed(2),
        avgKills: (rrow.k / rrow.games).toFixed(1),
        avgDeaths: (rrow.d / rrow.games).toFixed(1),
        avgAssists: (rrow.a / rrow.games).toFixed(1),
      };
    }

    return res.json(out);
  } catch (e: any) {
    return res.status(e?.response?.status || 500).json({
      message: e?.response?.data?.status?.message || e?.message || "champion-stats failed",
    });
  }
});


// ─── Featured players (seed + live cache) ────────────────────────────────────
const FEATURED_SEED = [
  { riotId:'Faker#KR1',      region:'kr',   platform:'kr' },
  { riotId:'Caps#EUW',       region:'euw1', platform:'euw1' },
  { riotId:'Doublelift#NA1', region:'na1',  platform:'na1' },
  { riotId:'KisterKata#NA1', region:'na1',  platform:'na1' },
  { riotId:'Rekkles#EUW',    region:'euw1', platform:'euw1' },
  { riotId:'Ruler#KR1',      region:'kr',   platform:'kr' },
];

const featuredCache: Map<string, { data: any; ts: number }> = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 min

async function fetchFeaturedPlayer(seed: typeof FEATURED_SEED[0]) {
  const cached = featuredCache.get(seed.riotId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  if (!RIOT_KEY) throw new Error('no key');
  const headers = { 'X-Riot-Token': RIOT_KEY };
  const [gameName, tagLine] = seed.riotId.split('#');
  const regional = platformToRegional(seed.platform);

  const { data: acc } = await riotGet<any>(
    `https://${regional}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    { headers }
  );
  const puuid = acc.puuid;

  const [sumRes, leagueRes, idsRes] = await Promise.allSettled([
    riotGet<any>(`https://${seed.platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`, { headers }),
    (async () => {
      const s = await riotGet<any>(`https://${seed.platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`, { headers });
      return riotGet<any[]>(`https://${seed.platform}.api.riotgames.com/lol/league/v4/entries/by-summoner/${s.data.id}`, { headers });
    })(),
    riotGet<string[]>(`https://${regional}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids`, { headers, params: { count: 5 } }),
  ]);

  const summoner = sumRes.status === 'fulfilled' ? sumRes.value.data : null;
  const rankEntries = leagueRes.status === 'fulfilled' ? leagueRes.value.data : [];
  const matchIds: string[] = idsRes.status === 'fulfilled' ? (idsRes.value.data || []) : [];

  const solo = (rankEntries as any[]).find((e: any) => e.queueType === 'RANKED_SOLO_5x5') || (rankEntries as any[])[0];

  // champion stats from last 5 matches
  const champCount: Record<number, { games: number; wins: number; k: number; d: number; a: number }> = {};
  await Promise.allSettled(matchIds.slice(0, 5).map(async (mid) => {
    try {
      const { data: m } = await riotGet<any>(`https://${regional}.api.riotgames.com/lol/match/v5/matches/${mid}`, { headers });
      const p = m?.info?.participants?.find((x: any) => x.puuid === puuid);
      if (!p) return;
      const cid = p.championId as number;
      if (!champCount[cid]) champCount[cid] = { games: 0, wins: 0, k: 0, d: 0, a: 0 };
      champCount[cid].games++;
      if (p.win) champCount[cid].wins++;
      champCount[cid].k += p.kills; champCount[cid].d += p.deaths; champCount[cid].a += p.assists;
    } catch {}
  }));

  let topChampId: number | null = null;
  let topGames = 0;
  for (const [cid, s] of Object.entries(champCount)) {
    if (s.games > topGames) { topGames = s.games; topChampId = Number(cid); }
  }

  let avgKDA = 0;
  let totalWins = 0, totalGames = 0;
  for (const s of Object.values(champCount)) {
    totalGames += s.games; totalWins += s.wins;
    avgKDA += s.d === 0 ? (s.k + s.a) : (s.k + s.a) / s.d;
  }
  if (Object.keys(champCount).length > 0) avgKDA = avgKDA / Object.keys(champCount).length;

  const result = {
    riotId: seed.riotId,
    gameName, tagLine,
    region: seed.region,
    platform: seed.platform,
    puuid,
    profileIconId: summoner?.profileIconId ?? null,
    level: summoner?.summonerLevel ?? 0,
    rank: solo ? { tier: solo.tier, rank: solo.rank, lp: solo.leaguePoints, wins: solo.wins, losses: solo.losses } : null,
    topChampId,
    winRate: totalGames ? Math.round((totalWins / totalGames) * 100) : 0,
    avgKDA: Number(avgKDA.toFixed(2)),
    recentGames: totalGames,
  };

  featuredCache.set(seed.riotId, { data: result, ts: Date.now() });
  return result;
}

r.get('/featured', async (_req, res) => {
  const results = await Promise.allSettled(FEATURED_SEED.map(fetchFeaturedPlayer));
  const players = results
    .map((r, i) => r.status === 'fulfilled' ? r.value : { ...FEATURED_SEED[i], error: true, rank: null, topChampId: null, winRate: 0, avgKDA: 0, recentGames: 0, profileIconId: null, level: 0 })
    .filter(Boolean);
  res.json(players);
});

// ─── Profile comments ─────────────────────────────────────────────────────────
import { pool } from '../db.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import jwt from 'jsonwebtoken';

async function initProfileCommentsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS profile_comments (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      profile_puuid VARCHAR(200) NOT NULL,
      user_id       INT NOT NULL,
      user_name     VARCHAR(100) NOT NULL,
      content       TEXT NOT NULL,
      likes_count   INT DEFAULT 0,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_profile (profile_puuid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS profile_comment_likes (
      comment_id INT NOT NULL,
      user_id    INT NOT NULL,
      PRIMARY KEY (comment_id, user_id)
    ) ENGINE=InnoDB
  `);
}
initProfileCommentsTable().catch(e => console.error('[profile-comments] init error:', e.message));

function getViewerId(req: any): number | null {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const id = Number(payload.sub || payload.uid);
    return isNaN(id) ? null : id;
  } catch { return null; }
}

async function getUserName(userId: number): Promise<string> {
  try {
    const [[u]] = await pool.query<any[]>('SELECT name, email FROM users WHERE id = ?', [userId]);
    return u?.name || (u?.email ? u.email.split('@')[0] : `Usuario${userId}`);
  } catch { return `Usuario${userId}`; }
}

// GET /api/stats/profile-comments/:puuid
r.get('/profile-comments/:puuid', async (req: any, res) => {
  const puuid = req.params.puuid;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const viewerId = getViewerId(req);
  const likedExpr = viewerId !== null
    ? `(SELECT COUNT(*) > 0 FROM profile_comment_likes l WHERE l.comment_id = c.id AND l.user_id = ${viewerId})`
    : 'FALSE';
  try {
    const [comments] = await pool.query<any[]>(
      `SELECT c.id, c.user_id, c.user_name, c.content, c.likes_count, c.created_at,
              ${likedExpr} AS liked_by_me
       FROM profile_comments c
       WHERE c.profile_puuid = ?
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [puuid, limit, offset]
    );
    const [[{ total }]] = await pool.query<any[]>(
      'SELECT COUNT(*) AS total FROM profile_comments WHERE profile_puuid = ?', [puuid]
    );
    res.json({ comments, total: Number(total), page, pages: Math.ceil(Number(total) / limit) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/stats/profile-comments/:puuid
r.post('/profile-comments/:puuid', requireAuth, async (req: any, res) => {
  const puuid = req.params.puuid;
  const { content } = req.body;
  const userId = req.auth.userId;
  if (!content?.trim())     return res.status(400).json({ error: 'Comentario requerido' });
  if (content.length > 280) return res.status(400).json({ error: 'Máximo 280 caracteres' });
  try {
    const userName = await getUserName(userId);
    const [result] = await pool.query<any>(
      'INSERT INTO profile_comments (profile_puuid, user_id, user_name, content) VALUES (?, ?, ?, ?)',
      [puuid, userId, userName, content.trim()]
    );
    const [[comment]] = await pool.query<any[]>(
      'SELECT *, FALSE AS liked_by_me FROM profile_comments WHERE id = ?', [result.insertId]
    );
    res.status(201).json(comment);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/stats/profile-comments/:id/like
r.post('/profile-comments/:id/like', requireAuth, async (req: any, res) => {
  const commentId = Number(req.params.id);
  const userId = req.auth.userId;
  if (isNaN(commentId)) return res.status(400).json({ error: 'ID inválido' });
  try {
    const [[existing]] = await pool.query<any[]>(
      'SELECT 1 FROM profile_comment_likes WHERE comment_id = ? AND user_id = ?', [commentId, userId]
    );
    if (existing) {
      await pool.query('DELETE FROM profile_comment_likes WHERE comment_id = ? AND user_id = ?', [commentId, userId]);
      await pool.query('UPDATE profile_comments SET likes_count = GREATEST(0, likes_count - 1) WHERE id = ?', [commentId]);
      return res.json({ liked: false });
    }
    await pool.query('INSERT IGNORE INTO profile_comment_likes (comment_id, user_id) VALUES (?, ?)', [commentId, userId]);
    await pool.query('UPDATE profile_comments SET likes_count = likes_count + 1 WHERE id = ?', [commentId]);
    res.json({ liked: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/stats/profile-comments/:id
r.delete('/profile-comments/:id', requireAuth, async (req: any, res) => {
  const commentId = Number(req.params.id);
  const userId = req.auth.userId;
  const role   = req.auth.role;
  if (isNaN(commentId)) return res.status(400).json({ error: 'ID inválido' });
  try {
    const [[c]] = await pool.query<any[]>('SELECT user_id, profile_puuid FROM profile_comments WHERE id = ?', [commentId]);
    if (!c) return res.status(404).json({ error: 'Comentario no encontrado' });
    // owner of comment OR the profile owner (checked by puuid param) OR admin
    const profileOwnerPuuid = req.query.profilePuuid as string | undefined;
    const isProfileOwner = profileOwnerPuuid && profileOwnerPuuid === c.profile_puuid &&
      // Check if userId is the owner of that profile — we don't have a direct link, but we allow via query param
      req.query.profileOwner === 'true';
    if (c.user_id !== userId && role !== 'admin' && !isProfileOwner)
      return res.status(403).json({ error: 'Sin permiso' });
    await pool.query('DELETE FROM profile_comment_likes WHERE comment_id = ?', [commentId]);
    await pool.query('DELETE FROM profile_comments WHERE id = ?', [commentId]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

r.get("/match-timeline/:regional/:matchId", async (req, res) => {
  try {
    const { regional, matchId } = req.params as { regional: string; matchId: string };
    if (!RIOT_KEY) return res.status(500).json({ message: "RIOT_API_KEY missing" });

    const headers = { "X-Riot-Token": RIOT_KEY };
    const { data: tl } = await riotGet<any>(
      `https://${regional}.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline`,
      { headers }
    );

    // Frames → oro por equipo, cs por equipo, etc.
    const frames = tl?.info?.frames ?? [];
    const blueIds = new Set<number>();
    const redIds  = new Set<number>();

    // Necesitamos team mapping: lo tomamos del match normal (ya lo tienes en /matches/:regional/:matchId)
    // Si prefieres incluirlo aquí, puedes hacer un GET al match y mapear participantId -> teamId.
    // Para ahorrar, exponemos totales por "ladoA/ladoB" sin nombres.
    const teamTotals = frames.map((f: any) => {
      let blueGold = 0, redGold = 0, blueCS = 0, redCS = 0;
      for (const [pid, pf] of Object.entries<any>(f.participantFrames || {})) {
        // sin teamId aquí, pero podemos alternar por convención: ids 1-5 = blue, 6-10 = red (estándar Riot)
        const idNum = Number(pid);
        const isBlue = idNum >= 1 && idNum <= 5;
        const gold = pf.totalGold ?? 0;
        const cs   = (pf.minionsKilled ?? 0) + (pf.jungleMinionsKilled ?? 0);
        if (isBlue) { blueGold += gold; blueCS += cs; } else { redGold += gold; redCS += cs; }
      }
      return {
        t: f.timestamp, blueGold, redGold, blueCS, redCS
      };
    });

    // Eventos interesantes: subidas de skill, objetivos, compras
    const skillUps: Array<{ t:number; participantId:number; skillSlot:number; levelUpType:string }> = [];
    const itemBuys: Array<{ t:number; participantId:number; itemId:number }> = [];
    const objectives: Array<{ t:number; type:string; teamId?:number }> = [];

    for (const f of frames) {
      for (const ev of (f.events || [])) {
        if (ev.type === "SKILL_LEVEL_UP") {
          skillUps.push({ t: ev.timestamp, participantId: ev.participantId, skillSlot: ev.skillSlot, levelUpType: ev.levelUpType });
        } else if (ev.type === "ITEM_PURCHASED") {
          itemBuys.push({ t: ev.timestamp, participantId: ev.participantId, itemId: ev.itemId });
        } else if (["ELITE_MONSTER_KILL","TURRET_PLATE_DESTROYED","BUILDING_KILL"].includes(ev.type)) {
          objectives.push({ t: ev.timestamp, type: ev.type, teamId: ev.killerTeamId ?? ev.teamId });
        }
      }
    }

    return res.json({
      frames: teamTotals,   // {t, blueGold, redGold, blueCS, redCS}
      skillUps,
      itemBuys,
      objectives
    });
  } catch (e:any) {
    return res.status(e?.response?.status || 500).json({
      message: e?.response?.data?.status?.message || e?.message || "timeline failed",
    });
  }
});

// ─── GET /api/stats/live/:platform/:puuid ─────────────────────────────────────
// Probing + fallback to direct by-puuid for maximum detection rate across regions.
r.get("/live/:platform/:puuid", async (req, res) => {
  const platform = String(req.params.platform).toLowerCase();
  const puuid    = String(req.params.puuid);

  try {
    // Probe platforms (same logic as the improved /spectator route)
    // Use a safe list of platforms. Some SEA hosts (th2, tw2, vn2 etc.) do not reliably resolve
    // for the public Riot API and cause DNS errors (getaddrinfo ENOTFOUND).
    // We keep only well-supported platforms for now.
    const SAFE_PROBE_PLATFORMS = [
      ...PROBE_AMERICAS,
      "euw1", "eun1", "tr1", "ru",
      "kr", "jp1"
      // SEA platforms are commented because several (th2, tw2, vn2, etc.) cause DNS failures.
      // "ph2", "sg2" // only enable if you have confirmed they work for your region
    ];
    const tryPlatforms = [platform, ...SAFE_PROBE_PLATFORMS.filter((p: any) => p !== platform)];

    let summoner: any = null;
    let usedPlatform = platform;

    for (const pf of tryPlatforms) {
      try {
        const s = await getSummonerByPUUID(pf as any, puuid);
        if (s?.id) {
          summoner = s;
          usedPlatform = pf;
          break;
        }
      } catch (e: any) {
        if (e?.response?.status === 403) return res.status(403).json({ error: "Forbidden (Riot 403)" });
      }
    }

    let game: any = null;

    if (summoner?.id) {
      game = await getLiveGame(usedPlatform as any, summoner.id);
    }

    if (!game) {
      // Fallback for /live route too (direct by-puuid)
      console.log(`[/live] No summoner or no game via by-summoner. Trying direct by-puuid fallback...`);
      for (const pf of tryPlatforms) {
        try {
          const directUrl = `https://${pf}.api.riotgames.com/lol/spectator/v5/active-games/by-puuid/${encodeURIComponent(puuid)}`;
          const directRes = await riotGet(directUrl, { headers: { "X-Riot-Token": RIOT_KEY } });
          if (directRes?.data?.participants?.length > 0) {
            game = directRes.data;
            usedPlatform = pf;
            console.log(`[/live] Found game via direct by-puuid fallback on ${pf}`);
            break;
          }
        } catch (e: any) {
          const st = e?.response?.status;
          if (st === 404 || st === 403) {
            continue;
          }
          if (!st) {
            continue; // DNS/network error — skip silently
          }
          console.warn(`[/live direct fallback] unexpected error on ${pf}:`, st || e?.code || e?.message);
        }
      }
    }

    if (!game) {
      return res.status(404).json({ inGame: false, error: "No active game found after full probing", triedPlatforms: tryPlatforms });
    }

    // Step 3: normalize & enrich response
    const gameLength = game.gameStartTime
      ? Math.floor((Date.now() - game.gameStartTime) / 1000)
      : (game.gameLength ?? 0);

    const participants = (game.participants ?? []).map((p: any) => ({
      summonerName: p.riotIdGameName || p.summonerName || "Invocador",
      riotId:       p.riotId ?? null,
      championId:   p.championId,
      teamId:       p.teamId,
      puuid:        p.puuid ?? null,
      spell1Id:     p.spell1Id,
      spell2Id:     p.spell2Id,
    }));

    return res.json({
      inGame:          true,
      gameId:          game.gameId,
      platformId:      game.platformId,
      platformUsed:    usedPlatform,
      gameMode:        game.gameMode,
      gameType:        game.gameType,
      gameLength,
      gameStartTime:   game.gameStartTime,
      queueId:         game.gameQueueConfigId,
      mapId:           game.mapId,
      observers:       game.observers || null,
      encryptionKey:   game.observers?.encryptionKey || null,
      bannedChampions: (game.bannedChampions ?? []).map((b: any) => ({
        championId: b.championId,
        teamId:     b.teamId,
        pickTurn:   b.pickTurn,
      })),
      participants,
    });
  } catch (e: any) {
    const st = e?.response?.status;
    if (st === 404) return res.status(204).send(); // not in game
    return res.status(st || 500).json({ error: e?.message || "live check failed" });
  }
});

export default r;
