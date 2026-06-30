// src/pages/ProfilePage.tsx
// Porofessor-style summoner profile — ATAK.GG dark red & black brand.
// New page; reuses the existing backend (/api/stats/*) via axiosInstance,
// the useChampions hook, and the DDragon icon helpers in src/lib/dataDragon.ts.
import React, { useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useChampions } from '@/hooks/use-ddragon';
import {
  useResolveRiotId,
  useSummary,
  useMatches,
  useLeagueRank,
  useRecentTeammates,
  useBestPlayers,
} from '@/hooks/queries/stats';
import { qk } from '@/hooks/queries/keys';
import {
  dd,
  rankEmblem,
  spellIcon,
  fmtNumber,
  keystoneIcon,
  runePathIcon,
} from '@/lib/dataDragon';
import { RefreshCw, Star, Search, ChevronDown } from 'lucide-react';
import { KataLoaderOverlay } from '@/components/KataLoader';
import { motion } from 'framer-motion';
import ChampionDanceSlot from '@/components/ChampionDanceSlot';
import { ScrollVideoBg } from '@/components/ScrollVideoBg';
import { Tip } from '@/components/ui/Tip';

// ─── Brand tokens ───────────────────────────────────────────────────────────
const C = {
  bg: '#0a0a0c',
  panel: '#131316',
  border: 'rgba(255,255,255,0.07)',
  red: '#e1242e',
  redHover: '#ff5a64',
  win: '#0bc4e3',    // ATAK teal for wins (not blue like OP.GG, distinct brand)
  loss: '#ff5a64',
  gold: '#c8aa6e',
  teal: '#0bc4e3',
};
const FONT_BODY = "'Saira', system-ui, sans-serif";
const FONT_COND = "'Saira Condensed', 'Saira', sans-serif";
const FONT_KDA = "'Saira Semi Condensed', 'Saira', sans-serif";

// ─── Region / platform helpers ──────────────────────────────────────────────
type Platform = 'la1'|'la2'|'na1'|'br1'|'oc1'|'euw1'|'eun1'|'tr1'|'ru'|'jp1'|'kr';
type Continent = 'americas'|'europe'|'asia';

const platformToContinent = (p: Platform): Continent =>
  ['la1','la2','na1','br1','oc1'].includes(p) ? 'americas' :
  ['euw1','eun1','tr1','ru'].includes(p) ? 'europe' : 'asia';

const normalizePlatform = (s?: string): Platform => {
  const m: Record<string, Platform> = {
    lan:'la1', la1:'la1', las:'la2', la2:'la2', na:'na1', na1:'na1',
    br:'br1', br1:'br1', oce:'oc1', oc1:'oc1', euw:'euw1', euw1:'euw1',
    eune:'eun1', eun1:'eun1', tr:'tr1', tr1:'tr1', ru:'ru',
    kr:'kr', jp:'jp1', jp1:'jp1',
  };
  return m[(s || '').toLowerCase()] || (s as Platform) || 'la1';
};

// Default tagLine per platform when the route omits one (bare name). Riot accepts
// these as sensible regional defaults for resolution.
const DEFAULT_TAG: Record<Platform, string> = {
  la1: 'LAN', la2: 'LAS', na1: 'NA1', br1: 'BR1', oc1: 'OCE',
  euw1: 'EUW', eun1: 'EUNE', tr1: 'TR1', ru: 'RU', jp1: 'JP1', kr: 'KR1',
};

// Route param `:name` may arrive as "Name#TAG" (from /stats links), "Name-TAG"
// (from /profile links), or a bare "Name" (no tag). Parse all three. When no tag
// is present we fall back to a per-region default so resolution can still work.
const splitNameTag = (raw: string | undefined, platform: Platform) => {
  const s = decodeURIComponent(raw || '').trim();
  if (!s) return { gameName: '', tagLine: '' };
  // Prefer an explicit '#' separator (canonical Riot ID).
  if (s.includes('#')) {
    const i = s.indexOf('#');
    return { gameName: s.slice(0, i).trim(), tagLine: s.slice(i + 1).trim() };
  }
  // Otherwise treat the LAST hyphen as the tag separator (names may contain '-').
  const i = s.lastIndexOf('-');
  if (i !== -1) {
    const candidateTag = s.slice(i + 1).trim();
    // A real tag is short & alphanumeric; if it looks like part of the name, ignore.
    if (candidateTag.length >= 2 && candidateTag.length <= 5 && /^[A-Za-z0-9]+$/.test(candidateTag)) {
      return { gameName: s.slice(0, i).trim(), tagLine: candidateTag };
    }
  }
  // Bare name → default regional tag.
  return { gameName: s, tagLine: DEFAULT_TAG[platform] || 'NA1' };
};

// Build the profile route for a co-player / participant.
const profileHref = (region: string, gameName?: string, tagLine?: string) => {
  const g = (gameName || '').trim();
  const t = (tagLine || '').trim();
  if (!g) return null;
  const slug = t ? `${encodeURIComponent(g)}-${encodeURIComponent(t)}` : encodeURIComponent(g);
  return `/profile/${region}/${slug}`;
};

// ─── Queue & role maps ──────────────────────────────────────────────────────
const QUEUE_NAMES: Record<number, string> = {
  400: 'Normal Draft', 420: 'Solo/Dúo', 430: 'Normal Blind',
  440: 'Flex', 450: 'ARAM', 700: 'Clash',
  830: 'Co-op IA', 840: 'Co-op IA', 850: 'Co-op IA',
  900: 'URF', 1700: 'Arena', 1900: 'URF',
};
const queueName = (qid?: number, fallback?: string) =>
  QUEUE_NAMES[qid ?? 0] || fallback || 'Personalizada';

const ROLES = ['Central', 'Jungla', 'Tirador', 'Soporte', 'Superior'] as const;
type Role = typeof ROLES[number];

// teamPosition / role / lane → Spanish role
const toRole = (m: any): Role | null => {
  const pos = String(m.teamPosition || m.role || '').toUpperCase();
  const lane = String(m.lane || '').toUpperCase();
  if (pos === 'MIDDLE' || lane === 'MIDDLE' || pos === 'MID') return 'Central';
  if (pos === 'JUNGLE' || lane === 'JUNGLE') return 'Jungla';
  if (pos === 'BOTTOM' || pos === 'CARRY' || pos === 'ADC' || (lane === 'BOTTOM' && pos !== 'SUPPORT')) return 'Tirador';
  if (pos === 'UTILITY' || pos === 'SUPPORT') return 'Soporte';
  if (pos === 'TOP' || lane === 'TOP') return 'Superior';
  return null;
};

// Mastery hexagon color by level
const masteryColor = (level: number): string => {
  if (level >= 7) return '#d13639';
  if (level >= 6) return '#8b3fb0';
  if (level >= 5) return '#b53a3a';
  if (level >= 4) return '#3f7fb0';
  return '#5a5a62';
};

// ─── Small UI primitives ────────────────────────────────────────────────────
// Seamless "incrustado" surface: no hard 1px outline, just a whisper-soft
// background gradient + layered shadows + a faint inset top highlight, so the
// panels read as embedded into the dark page rather than boxes on top of it.
const PANEL_SURFACE: React.CSSProperties = {
  // Frosted glass: a lighter translucent fill + stronger backdrop blur lets the
  // living dagger video read through, so panels feel like a thin UI layer
  // floating over the background rather than opaque stacked cards.
  background:
    'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 22%, rgba(255,255,255,0) 70%), rgba(13,13,17,0.26)',
  backdropFilter: 'blur(20px) saturate(120%)',
  WebkitBackdropFilter: 'blur(20px) saturate(120%)',
  borderRadius: 18,
  // Soft ambient depth only — no heavy "floating card" drop shadow.
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 44px -30px rgba(0,0,0,.6)',
};

// Inner "sub-cards": kept minimal and reserved for the rare place a subtle lift
// genuinely helps (e.g. the featured rank emblem block). Most former sub-cards
// have been replaced by open sections separated with hairline dividers.
const SUBCARD_SURFACE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.018)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  borderRadius: 12,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
};

// Thin hairline divider used to separate open sections within a single panel,
// replacing nested cards.
const HAIRLINE = '1px solid rgba(255,255,255,0.06)';

// Shared motion: fade + rise + de-blur as the panel scrolls into view.
const RISE_IN = {
  initial: { opacity: 0, y: 22, filter: 'blur(6px)' },
  whileInView: { opacity: 1, y: 0, filter: 'blur(0px)' },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

function Panel({ children, style, className = '', delay = 0 }: {
  children: React.ReactNode; style?: React.CSSProperties; className?: string; delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={RISE_IN.initial}
      whileInView={RISE_IN.whileInView}
      viewport={RISE_IN.viewport}
      transition={{ ...RISE_IN.transition, delay }}
      style={{ ...PANEL_SURFACE, ...style }}
    >
      {children}
    </motion.div>
  );
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
      <h2
        style={{
          fontFamily: FONT_COND,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          fontSize: 13,
          color: 'rgba(255,255,255,0.82)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          margin: 0,
        }}
      >
        <span style={{ width: 4, height: 16, background: C.red, borderRadius: 2, display: 'inline-block' }} />
        {children}
      </h2>
      {right}
    </div>
  );
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: '100%', background: color, borderRadius: 999, transformOrigin: 'left', transform: `scaleX(${Math.min(Math.max(value, 0), 100) / 100})`, transition: 'transform .6s' }} />
    </div>
  );
}

function Skeleton({ h = 16, w = '100%', style }: { h?: number; w?: number | string; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        height: h, width: w, borderRadius: 6,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.09), rgba(255,255,255,0.04))',
        backgroundSize: '200% 100%',
        animation: 'atak-shimmer 1.3s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

// ─── Logo ───────────────────────────────────────────────────────────────────
function Dagger({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M32 6L23 38L32 50L41 38L32 6Z" fill="url(#pp-blade)" stroke={C.red} strokeWidth="2" />
      <path d="M32 6V50" stroke="#fff" strokeWidth="1" opacity="0.55" />
      <path d="M18 44H46" stroke={C.red} strokeWidth="3" strokeLinecap="round" />
      <path d="M32 44V60" stroke="#1a1a1f" strokeWidth="4" strokeLinecap="round" />
      <defs>
        <linearGradient id="pp-blade" x1="32" y1="6" x2="32" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ff4d4d" />
          <stop offset="100%" stopColor="#3b0000" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <Dagger />
      <div style={{ lineHeight: 1 }}>
        <div style={{ fontFamily: FONT_COND, fontWeight: 800, fontSize: 22, letterSpacing: '0.02em', color: '#fff' }}>
          ATAK<span style={{ color: C.red }}>.GG</span>
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 8, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>
          Powered by Riot API
        </div>
      </div>
    </div>
  );
}

// ─── Top bar ────────────────────────────────────────────────────────────────
function TopBar({ region }: { region: string }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const nav = [
    { label: 'Perfil', active: true },
    { label: 'Campeones' }, { label: 'Meta' }, { label: 'Torneos' }, { label: 'Clasificación' },
  ];

  const go = () => {
    const v = q.trim();
    if (!v.includes('#')) return;
    const [name, tag] = v.split('#');
    navigate(`/profile/${region}/${encodeURIComponent(name.trim())}-${encodeURIComponent((tag || '').trim())}`);
  };

  return (
    <div
      style={{
        position: 'sticky', top: 0, zIndex: 50, height: 60,
        background: 'rgba(10,10,12,0.92)', backdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div style={{ maxWidth: 1340, margin: '0 auto', height: '100%', padding: '0 18px', display: 'flex', alignItems: 'center', gap: 22 }}>
        <Logo />
        <nav style={{ display: 'flex', gap: 18 }}>
          {nav.map((n) => (
            <span
              key={n.label}
              style={{
                fontFamily: FONT_BODY, fontSize: 14, fontWeight: n.active ? 700 : 500,
                color: n.active ? '#fff' : 'rgba(255,255,255,0.5)',
                borderBottom: n.active ? `2px solid ${C.red}` : '2px solid transparent',
                paddingBottom: 4, cursor: 'pointer',
              }}
            >
              {n.label}
            </span>
          ))}
        </nav>
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative', width: 280, maxWidth: '36vw' }}>
          <Search size={15} style={{ position: 'absolute', left: 11, top: 10, color: 'rgba(255,255,255,0.4)' }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && go()}
            placeholder="Invocador o Campeón…"
            style={{
              width: '100%', height: 36, paddingLeft: 32, paddingRight: 12,
              background: '#0e0e11', border: `1px solid ${C.border}`, borderRadius: 8,
              color: '#fff', fontFamily: FONT_BODY, fontSize: 13, outline: 'none',
            }}
          />
        </div>
        <button
          style={{
            height: 36, padding: '0 16px', background: C.red, color: '#fff',
            border: 'none', borderRadius: 8, fontFamily: FONT_BODY, fontWeight: 700,
            fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = C.redHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = C.red)}
        >
          Registrarse
        </button>
      </div>
    </div>
  );
}

// ─── Types of state ─────────────────────────────────────────────────────────
interface RankEntry { queue: string; tier: string; rank: string; lp: number; wins?: number; losses?: number; }

// ─── Page ───────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { region, name } = useParams<{ region: string; name: string }>();
  const { data: champs } = useChampions();

  const platform = normalizePlatform(region);
  const continent = platformToContinent(platform);
  const { gameName, tagLine } = useMemo(() => splitNameTag(name, platform), [name, platform]);

  const qc = useQueryClient();
  const [count, setCount] = useState(10);
  const [filter, setFilter] = useState<'all' | 420 | 440 | 450>('all');

  const champByKey = champs?.byKey;

  // ── Dependent React Query chain ──────────────────────────────────────────────
  // resolve (riotId → puuid) → summary / matches / league-rank / teammates /
  // best-players. Each downstream query is `enabled` only once `puuid` resolves,
  // so the flow self-orchestrates and everything is cached + deduped.
  const hasRiotId = Boolean(gameName && tagLine);
  const resolveQ = useResolveRiotId(hasRiotId ? platform : undefined, gameName, tagLine);
  const puuid = resolveQ.data?.puuid;
  const resolveErr = !hasRiotId || resolveQ.isError;

  const summaryQ = useSummary(platform, puuid);
  const summary = summaryQ.data ?? null;
  const summaryLoading = summaryQ.isPending; // pending while disabled or in-flight

  const matchesQ = useMatches(continent, puuid, count);
  const matches: any[] = matchesQ.data ?? [];
  // While "Cargar más" refetches with a new count we still have the prior page.
  const matchesLoading = matchesQ.isPending;
  const loadingMore = matchesQ.isFetching && !matchesQ.isPending;

  const leagueRankQ = useLeagueRank(platform, puuid);
  const leagueRank = leagueRankQ.data ?? null;

  const teammatesQ = useRecentTeammates(continent, puuid, 20);
  const teammates = teammatesQ.data ?? null;
  const teammatesLoading = teammatesQ.isPending;

  const bestPlayersQ = useBestPlayers(platform, puuid, 15);
  const bestPlayers = bestPlayersQ.data ?? null;

  // OP.GG regional rank + champion stats (independent of PUUID — uses Riot ID directly)
  const opggQ = useQuery({
    queryKey: ['opgg', 'profile', platform, gameName, tagLine],
    queryFn: async () => {
      const res = await fetch(
        `http://localhost:4000/api/opgg/summoner-full?game_name=${encodeURIComponent(gameName)}&tag_line=${encodeURIComponent(tagLine)}&region=${encodeURIComponent(platform)}`
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.ok ? data : null;
    },
    enabled: !!gameName && !!tagLine,
    staleTime: 5 * 60 * 1000,
  });
  const opggData = opggQ.data ?? null;

  const loadMore = () => setCount((n) => n + 10);

  // "Actualizar" — invalidate every stats query for this invocador (resolve
  // through the dependent chain). React Query then refetches the mounted ones.
  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.stats.resolve(platform, gameName, tagLine) });
    if (puuid) {
      qc.invalidateQueries({ queryKey: qk.stats.summary(platform, puuid) });
      qc.invalidateQueries({ queryKey: qk.stats.matches(continent, puuid, count) });
      qc.invalidateQueries({ queryKey: qk.stats.leagueRank(platform, puuid) });
      qc.invalidateQueries({ queryKey: qk.stats.recentTeammates(continent, puuid) });
      qc.invalidateQueries({ queryKey: qk.stats.bestPlayers(platform, puuid) });
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const rankArr: RankEntry[] = summary?.rank || [];
  const soloRank = rankArr.find((r) => r.queue === 'RANKED_SOLO_5x5') || null;
  const flexRank = rankArr.find((r) => r.queue === 'RANKED_FLEX_SR' || r.queue === 'RANKED_TEAM_5x5') || null;

  const masteryTop = (summary?.masteryTop || []).slice(0, 6);

  // Highest-mastery champion → feeds the small 3D dancing-champion slot.
  const topMasteryChamp = useMemo(() => {
    const top = (summary?.masteryTop || [])[0];
    if (!top) return null;
    const c = champByKey?.[String(top.championId)];
    return c ? { slug: c.id, name: c.name } : null; // c.id is the DDragon slug (e.g. "Pantheon")
  }, [summary, champByKey]);

  const filtered = useMemo(() => {
    if (filter === 'all') return matches;
    return matches.filter((m) => m.queueId === filter);
  }, [matches, filter]);

  const recap = useMemo(() => {
    if (!filtered.length) return null;
    const wins = filtered.filter((m) => m.win).length;
    const k = filtered.reduce((s, m) => s + (m.kills || 0), 0);
    const d = filtered.reduce((s, m) => s + (m.deaths || 0), 0);
    const a = filtered.reduce((s, m) => s + (m.assists || 0), 0);
    return {
      n: filtered.length, wins, losses: filtered.length - wins,
      wr: Math.round((wins / filtered.length) * 100),
      kda: d === 0 ? (k + a).toFixed(2) : ((k + a) / d).toFixed(2),
      k: (k / filtered.length).toFixed(1), d: (d / filtered.length).toFixed(1), a: (a / filtered.length).toFixed(1),
    };
  }, [filtered]);

  // Role performance (from match history; Solo/Flex/normals)
  const rolePerf = useMemo(() => {
    const map: Record<Role, { games: number; wins: number }> = {
      Central: { games: 0, wins: 0 }, Jungla: { games: 0, wins: 0 }, Tirador: { games: 0, wins: 0 },
      Soporte: { games: 0, wins: 0 }, Superior: { games: 0, wins: 0 },
    };
    for (const m of matches) {
      const r = toRole(m);
      if (!r) continue;
      map[r].games += 1;
      if (m.win) map[r].wins += 1;
    }
    return map;
  }, [matches]);

  // Champions table (Solo/Dúo preferred; falls back to all ranked-ish history)
  const champRows = useMemo(() => {
    const pool = matches.filter((m) => m.queueId === 420);
    const src = pool.length ? pool : matches.filter((m) => m.queueId === 420 || m.queueId === 440);
    const agg = new Map<number, { games: number; wins: number; k: number; d: number; a: number }>();
    for (const m of src) {
      const id = Number(m.championId);
      const row = agg.get(id) || { games: 0, wins: 0, k: 0, d: 0, a: 0 };
      row.games += 1; if (m.win) row.wins += 1;
      row.k += m.kills || 0; row.d += m.deaths || 0; row.a += m.assists || 0;
      agg.set(id, row);
    }
    return Array.from(agg.entries())
      .map(([id, r]) => ({
        id,
        games: r.games,
        wr: Math.round((r.wins / r.games) * 100),
        kda: r.d === 0 ? (r.k + r.a).toFixed(2) : ((r.k + r.a) / r.d).toFixed(2),
      }))
      .sort((a, b) => b.games - a.games)
      .slice(0, 6);
  }, [matches]);

  // Player tags — use OP.GG full-season data as primary source, recent matches as fallback
  const tags = useMemo(() => {
    const t: string[] = [];
    if (opggData?.is_hot_streak) t.push('Racha ganadora 🔥');
    if (opggData?.is_veteran) t.push('Veterano');
    if (opggData?.is_fresh_blood) t.push('Recién llegado');

    // WR tag: prefer season WR from OP.GG ranked stats
    const seasonWr = (opggData?.rank as any)?.win_rate ?? null;
    const wrSrc = seasonWr ?? (recap ? recap.wr : null);
    if (wrSrc != null) {
      if (wrSrc >= 56) t.push('En racha');
      else if (wrSrc <= 42) t.push('En slump');
    }

    // KDA / deaths tag: derive from season champion totals (career totals ÷ play = per-game avg)
    const champStats = opggData?.champion_stats as any[] | undefined;
    if (champStats?.length) {
      const totalPlay   = champStats.reduce((s, c) => s + (c.play   || 0), 0);
      const totalKills  = champStats.reduce((s, c) => s + (c.kill   || 0), 0);
      const totalDeaths = champStats.reduce((s, c) => s + (c.death  || 0), 0);
      const totalAssist = champStats.reduce((s, c) => s + (c.assist || 0), 0);
      if (totalPlay > 0 && totalDeaths > 0) {
        const seasonKDA    = (totalKills + totalAssist) / totalDeaths;
        const avgDeathsPG  = totalDeaths / totalPlay;
        if (seasonKDA   >= 4) t.push('KDA alto');
        if (avgDeathsPG <  4) t.push('Juega seguro');
      }
    } else if (recap) {
      if (Number(recap.kda) >= 4) t.push('KDA alto');
      if (Number(recap.d)   <= 4) t.push('Juega seguro');
    }

    // Main champion from OP.GG (most played this season)
    const opggTop = champStats?.length
      ? [...champStats].sort((a, b) => b.play - a.play)[0]
      : null;
    if (opggTop?.champion_name) {
      const displayName = opggTop.champion_name.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
      t.push(`Main ${displayName}`);
    } else {
      const best = champRows[0];
      if (best && champByKey?.[String(best.id)]) t.push(`Main ${champByKey[String(best.id)].name}`);
    }

    const topRole = (Object.entries(rolePerf) as [Role, any][]).sort((a, b) => b[1].games - a[1].games)[0];
    if (topRole && topRole[1].games > 0) t.push(topRole[0]);
    if (soloRank) t.push(`${soloRank.tier[0]}${soloRank.tier.slice(1).toLowerCase()} ${soloRank.rank}`);
    return t.length ? t : ['Sin datos suficientes'];
  }, [recap, champRows, rolePerf, soloRank, champByKey, opggData]);

  const profileIconUrl = summary?.summoner?.profileIconId != null ? dd.profileIcon(summary.summoner.profileIconId) : '';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: '#e8e8ea', fontFamily: FONT_BODY, lineHeight: 1.5 }}>
      <style>{`
        @keyframes atak-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .atak-glow { background:
          radial-gradient(900px 500px at 80% -10%, rgba(225,36,46,0.14), transparent 60%),
          transparent; }
        @media (max-width: 960px){ .atak-grid{ grid-template-columns: 1fr !important; } }
      `}</style>

      {/* 3D Katarina loader while resolving the invocador (initial load). */}
      {!puuid && !resolveErr && <KataLoaderOverlay show label="Cargando invocador" />}

      {/* Hero scroll-scrubbed dagger video: bold up top, advances with scroll,
          fades into the data. Renders nothing until /public/video/dagger-scroll.mp4 exists. */}
      <ScrollVideoBg />

      {/* Top bar removed — the app's global Navbar is used instead. */}

      <div className="atak-glow" style={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1340, margin: '0 auto', padding: '88px 18px 80px' }}>

          {/* Resolve error */}
          {resolveErr && !puuid && (
            <Panel style={{ padding: 24, marginBottom: 18 }}>
              <div style={{ fontFamily: FONT_COND, fontWeight: 700, fontSize: 18, marginBottom: 6 }}>
                No se encontró al invocador
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
                Verifica el Riot ID (Nombre#TAG) y la región. Buscado: <b>{gameName || '—'}#{tagLine || '—'}</b> en {platform.toUpperCase()}.
              </div>
            </Panel>
          )}

          {/* ── Profile header ─────────────────────────────────────────────── */}
          <Panel
            style={{
              padding: '28px 30px', marginBottom: 28, overflow: 'hidden', position: 'relative',
              background:
                'linear-gradient(120deg, rgba(225,36,46,0.16), rgba(225,36,46,0.03) 42%, rgba(255,255,255,0.01) 68%), rgba(15,15,19,0.4)',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 26, alignItems: 'center' }}>
              {/* Icon + level */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {summaryLoading && !summary ? (
                  <Skeleton h={84} w={84} style={{ borderRadius: 14 }} />
                ) : (
                  <img
                    src={profileIconUrl}
                    alt=""
                    style={{ width: 84, height: 84, borderRadius: 14, border: `2px solid ${C.red}`, objectFit: 'cover', background: '#000' }}
                    onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')}
                  />
                )}
                <div
                  style={{
                    position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)',
                    background: '#0a0a0c', border: `1px solid ${C.border}`, borderRadius: 999,
                    padding: '2px 9px', fontFamily: FONT_COND, fontWeight: 700, fontSize: 12, color: C.gold, whiteSpace: 'nowrap',
                  }}
                >
                  Nv. {summary?.summoner?.level ?? '—'}
                </div>
              </div>

              {/* Name + region */}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h1 style={{ fontFamily: FONT_COND, fontWeight: 800, fontSize: 34, margin: 0, color: '#fff', lineHeight: 1 }}>
                    {gameName || '—'}
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 22 }}> #{tagLine}</span>
                  </h1>
                  <span style={{ background: 'rgba(255,255,255,0.07)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)', borderRadius: 999, padding: '4px 13px', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                    {platform.toUpperCase()}
                  </span>
                  <Star size={20} style={{ color: C.gold, cursor: 'pointer', opacity: 0.85 }} />
                </div>

                {/* Mastery hexagons */}
                <div style={{ display: 'flex', gap: 9, marginTop: 14, flexWrap: 'wrap' }}>
                  {summaryLoading && !summary
                    ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={44} w={40} />)
                    : masteryTop.length
                      ? masteryTop.map((m: any, i: number) => {
                          const c = champByKey?.[String(m.championId)];
                          const col = masteryColor(m.level);
                          return (
                            <div key={i} title={`${c?.name || m.championId} · Nv.${m.level} · ${fmtNumber(m.points)}`}
                              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                              <div
                                style={{
                                  width: 44, height: 50, position: 'relative',
                                  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                                  background: col, padding: 2,
                                }}
                              >
                                <div style={{
                                  width: '100%', height: '100%',
                                  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                                  overflow: 'hidden', background: '#000',
                                }}>
                                  {c?.image && <img src={c.image} alt="" onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                </div>
                              </div>
                              <span style={{ fontFamily: FONT_COND, fontSize: 10, fontWeight: 700, color: col }}>{m.level}</span>
                            </div>
                          );
                        })
                      : <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>Sin datos de maestría</span>}
                </div>
              </div>

              {/* Season + refresh */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', alignSelf: 'flex-start', marginLeft: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>
                  Temporada 2026 <ChevronDown size={15} />
                </div>
                <Tip label="Volver a cargar los datos del invocador">
                  <button
                    onClick={refresh}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.red, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = C.redHover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = C.red)}
                  >
                    <RefreshCw size={15} /> Actualizar
                  </button>
                </Tip>
              </div>
            </div>
          </Panel>

          {/* ── Two-column grid ────────────────────────────────────────────── */}
          <div className="atak-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.12fr)', gap: 28 }}>

            {/* LEFT */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
              <PersonalScore
                solo={soloRank} flex={flexRank}
                loading={summaryLoading && !summary}
                leagueRank={leagueRank}
                opggData={opggData}
              />
              <RecentGames
                matches={filtered} loading={matchesLoading && !matches.length}
                recap={recap} filter={filter} setFilter={setFilter}
                champByKey={champByKey} puuid={puuid}
                onLoadMore={loadMore} loadingMore={loadingMore}
                hasMore={loadingMore || matches.length >= count}
                region={platform} continent={continent}
              />
            </div>

            {/* RIGHT */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
              {/* Small 3D dancing champion (highest mastery) — degrades to splash art. */}
              <motion.div {...RISE_IN}>
                <ChampionDanceSlot
                  champSlug={topMasteryChamp?.slug}
                  champName={topMasteryChamp?.name}
                  loading={summaryLoading && !summary}
                />
              </motion.div>
              <PlayerTags tags={tags} loading={matchesLoading && !matches.length} />
              <RecentlyPlayedWith
                players={teammates} loading={teammatesLoading}
                champByKey={champByKey} region={platform}
              />
              <RolePerformance perf={rolePerf} loading={matchesLoading && !matches.length} />
              <ChampionsTable rows={champRows} champByKey={champByKey} loading={matchesLoading && !matches.length} bestPlayers={bestPlayers} region={platform} opggChampStats={opggData?.champion_stats ?? null} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Personal score (featured Solo/Dúo) ─────────────────────────────────────
function PersonalScore({ solo, flex, loading, leagueRank, opggData }: {
  solo: RankEntry | null; flex: RankEntry | null; loading: boolean;
  leagueRank: { regionalRank: number | null; topPercent: number | null } | null;
  opggData?: any;
}) {
  const ladderRank = opggData?.rank?.ladder_rank ?? null;
  const ladderTotal = opggData?.rank?.ladder_total ?? null;
  const seasonPlay = opggData?.season_play ?? 0;
  const seasonWR = opggData?.season_win_rate ?? null;
  const isHotStreak = opggData?.is_hot_streak ?? false;
  const isVeteran = opggData?.is_veteran ?? false;

  return (
    <Panel style={{ padding: 26 }}>
      <SectionTitle>Puntuación personal</SectionTitle>
      {loading ? (
        <div style={{ display: 'flex', gap: 16 }}>
          <Skeleton h={88} w={88} style={{ borderRadius: 12 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Skeleton h={20} w="60%" /><Skeleton h={14} w="40%" /><Skeleton h={8} />
          </div>
        </div>
      ) : solo ? (
        <FeaturedRank rank={solo} leagueRank={leagueRank} />
      ) : (
        <Unranked label="Solo/Dúo sin clasificar" />
      )}

      {/* OP.GG regional position card */}
      {ladderRank != null && (
        <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(11,196,227,0.04)', border: '1px solid rgba(11,196,227,0.12)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(11,196,227,0.5)', fontWeight: 700, marginBottom: 2 }}>Posición regional</div>
            <div style={{ fontFamily: FONT_COND, fontWeight: 800, fontSize: 20, color: '#0bc4e3', lineHeight: 1 }}>
              #{ladderRank.toLocaleString()}
              {ladderTotal != null && (
                <span style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.35)', marginLeft: 5 }}>
                  de {(ladderTotal / 1_000_000).toFixed(1)}M
                </span>
              )}
            </div>
          </div>
          {seasonPlay > 0 && (
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.07)', paddingLeft: 14 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>Partidas temporada</div>
              <div style={{ fontFamily: FONT_COND, fontWeight: 700, fontSize: 16 }}>
                {seasonPlay}
                {seasonWR != null && (
                  <span style={{ fontSize: 13, fontWeight: 700, marginLeft: 8, color: seasonWR >= 50 ? C.win : C.loss }}>{seasonWR}%</span>
                )}
              </div>
            </div>
          )}
          {(isHotStreak || isVeteran) && (
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              {isHotStreak && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}>Racha ganadora</span>}
              {isVeteran && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: 'rgba(200,155,60,0.1)', border: '1px solid rgba(200,155,60,0.2)', color: C.gold }}>Veterano</span>}
            </div>
          )}
        </div>
      )}

      {/* 2-up: Flex + enemy avg — open sections divided by a hairline (no cards) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 22, paddingTop: 20, borderTop: HAIRLINE }}>
        <MiniRank label="Flex" rank={flex} loading={loading} />
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
            Promedio enemigos
          </div>
          <div style={{ fontFamily: FONT_COND, fontWeight: 600, fontSize: 18, color: 'rgba(255,255,255,0.45)' }}>—</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>No disponible</div>
        </div>
      </div>
    </Panel>
  );
}

function FeaturedRank({ rank, leagueRank }: {
  rank: RankEntry;
  leagueRank?: { regionalRank: number | null; topPercent: number | null } | null;
}) {
  const wins = rank.wins || 0, losses = rank.losses || 0;
  const total = wins + losses;
  const wr = total ? Math.round((wins / total) * 100) : 0;
  const tierName = rank.tier ? rank.tier[0] + rank.tier.slice(1).toLowerCase() : '';
  const tierColor: Record<string, string> = {
    IRON: '#6b6b6b', BRONZE: '#ad7c52', SILVER: '#9eaab8', GOLD: '#c8aa6e',
    PLATINUM: '#5bbfa7', EMERALD: '#4cad6d', DIAMOND: '#6aa5d4',
    MASTER: '#9d4dc4', GRANDMASTER: '#e84d4d', CHALLENGER: '#00eeff',
  };
  const color = tierColor[rank.tier?.toUpperCase?.()] ?? C.gold;
  return (
    <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
      {/* Rank emblem with glow ring */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          position: 'absolute', inset: -6, borderRadius: '50%',
          background: `radial-gradient(circle, ${color}30 0%, transparent 70%)`,
          filter: 'blur(12px)',
        }} />
        <img src={rankEmblem(rank.tier)} alt={rank.tier}
          style={{ width: 120, height: 120, objectFit: 'contain', position: 'relative',
            filter: `drop-shadow(0 0 18px ${color}70)` }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONT_COND, fontWeight: 900, fontSize: 30, color, lineHeight: 1, letterSpacing: '-0.01em' }}>
          {tierName} {rank.rank}
        </div>
        <div style={{ fontFamily: FONT_COND, fontWeight: 800, fontSize: 22, color: '#fff', marginTop: 4 }}>{rank.lp} LP</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 5, fontSize: 12, color: 'rgba(255,255,255,0.45)', flexWrap: 'wrap' }}>
          {leagueRank?.regionalRank != null && (
            <span>Rank regional: <b style={{ color: 'rgba(255,255,255,0.7)' }}>#{fmtNumber(leagueRank.regionalRank)}</b></span>
          )}
          {leagueRank?.topPercent != null && (
            <span>Top %: <b style={{ color: 'rgba(255,255,255,0.7)' }}>{leagueRank.topPercent}%</b></span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <span style={{ fontFamily: FONT_COND, fontSize: 14, color: C.win, fontWeight: 700 }}>{wins}V</span>
          <span style={{ fontFamily: FONT_COND, fontSize: 14, color: C.loss, fontWeight: 700 }}>{losses}D</span>
          <div style={{ flex: 1, maxWidth: 200 }}><Bar value={wr} color={wr >= 50 ? C.win : C.loss} /></div>
          <span style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_COND, color: wr >= 50 ? C.win : C.loss }}>{wr}%</span>
        </div>
      </div>
    </div>
  );
}

function MiniRank({ label, rank, loading }: { label: string; rank: RankEntry | null; loading: boolean }) {
  const tierColor: Record<string, string> = {
    IRON: '#6b6b6b', BRONZE: '#ad7c52', SILVER: '#9eaab8', GOLD: '#c8aa6e',
    PLATINUM: '#5bbfa7', EMERALD: '#4cad6d', DIAMOND: '#6aa5d4',
    MASTER: '#9d4dc4', GRANDMASTER: '#e84d4d', CHALLENGER: '#00eeff',
  };
  const color = rank ? (tierColor[rank.tier?.toUpperCase?.()] ?? C.gold) : C.gold;
  return (
    <div>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>{label}</div>
      {loading ? <Skeleton h={18} w="70%" /> : rank ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              position: 'absolute', inset: -8,
              background: `radial-gradient(circle, ${color}28 0%, transparent 70%)`,
              filter: 'blur(8px)',
            }} />
            <img src={rankEmblem(rank.tier)} alt={rank.tier}
              style={{ width: 72, height: 72, objectFit: 'contain', position: 'relative',
                filter: `drop-shadow(0 0 12px ${color}70)` }} />
          </div>
          <div>
            <div style={{ fontFamily: FONT_COND, fontWeight: 800, fontSize: 20, color }}>
              {rank.tier[0] + rank.tier.slice(1).toLowerCase()} {rank.rank}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{rank.lp} LP</div>
          </div>
        </div>
      ) : (
        <div style={{ fontFamily: FONT_COND, fontWeight: 600, fontSize: 16, color: 'rgba(255,255,255,0.45)' }}>Sin clasificar</div>
      )}
    </div>
  );
}

function Unranked({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
      <div style={{ width: 64, height: 64, borderRadius: 14, ...SUBCARD_SURFACE, display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.25)', fontFamily: FONT_COND, fontWeight: 800, fontSize: 22 }}>?</div>
      <div>
        <div style={{ fontFamily: FONT_COND, fontWeight: 700, fontSize: 18, color: 'rgba(255,255,255,0.6)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Juega partidas clasificatorias</div>
      </div>
    </div>
  );
}

// ─── Recent games ───────────────────────────────────────────────────────────
function RecentGames({
  matches, loading, recap, filter, setFilter, champByKey, puuid, onLoadMore, loadingMore, hasMore, region, continent,
}: {
  matches: any[]; loading: boolean; recap: any;
  filter: 'all' | 420 | 440 | 450; setFilter: (f: any) => void;
  champByKey: any; puuid?: string; onLoadMore: () => void; loadingMore: boolean; hasMore: boolean;
  region: string; continent: string;
}) {
  const chips: { label: string; val: 'all' | 420 | 440 | 450 }[] = [
    { label: 'Todas', val: 'all' }, { label: 'Solo/Dúo', val: 420 },
    { label: 'Flex', val: 440 }, { label: 'ARAM', val: 450 },
  ];
  return (
    <Panel style={{ padding: 26 }}>
      <SectionTitle
        right={
          <div style={{ display: 'flex', gap: 6 }}>
            {chips.map((c) => (
              <Tip key={String(c.val)} label={`Filtrar por ${c.label}`}>
                <button
                  onClick={() => setFilter(c.val)}
                  style={{
                    fontSize: 12, fontWeight: 500, padding: '4px 11px', borderRadius: 999, cursor: 'pointer',
                    border: filter === c.val ? `1px solid ${C.red}` : '1px solid rgba(255,255,255,0.10)',
                    background: filter === c.val ? 'rgba(225,36,46,0.18)' : 'transparent',
                    color: filter === c.val ? C.redHover : 'rgba(255,255,255,0.55)',
                    transition: 'color .16s, border-color .16s, background .16s',
                  }}
                >
                  {c.label}
                </button>
              </Tip>
            ))}
          </div>
        }
      >
        Partidas recientes
      </SectionTitle>

      {/* Summary strip — open row, separated by a hairline (no card) */}
      {recap && (
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', padding: '4px 0 18px', marginBottom: 18, borderBottom: HAIRLINE, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Últimas {recap.n}</div>
            <div style={{ fontFamily: FONT_COND, fontWeight: 700, fontSize: 16, marginTop: 2 }}>
              <span style={{ color: C.win }}>{recap.wins}V</span> <span style={{ color: C.loss }}>{recap.losses}D</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>KDA prom.</div>
            <div style={{ fontFamily: FONT_KDA, fontWeight: 700, fontSize: 16, marginTop: 2 }}>{recap.k} / <span style={{ color: C.loss }}>{recap.d}</span> / {recap.a} <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>({recap.kda})</span></div>
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Victorias {recap.wr}%</div>
            <Bar value={recap.wr} color={recap.wr >= 50 ? C.win : C.loss} />
          </div>
        </div>
      )}

      {/* Rows */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={66} style={{ borderRadius: 10 }} />)}
        </div>
      ) : matches.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
          No hay partidas recientes para este filtro.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {matches.map((m, i) => <MatchRowMini key={m.matchId} m={m} champByKey={champByKey} puuid={puuid} region={region} continent={continent} index={i} />)}
        </div>
      )}

      {hasMore && matches.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            style={{ padding: '8px 22px', borderRadius: 999, border: `1px solid ${C.border}`, background: 'transparent', color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            {loadingMore ? 'Cargando…' : 'Cargar más'}
          </button>
        </div>
      )}
    </Panel>
  );
}

function timeAgo(ms?: number) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

function MatchRowMini({ m, champByKey, puuid, region, continent, index = 0 }: {
  m: any; champByKey: any; puuid?: string; region: string; continent: string; index?: number;
}) {
  const navigate = useNavigate();
  const c = champByKey?.[String(m.championId)];
  const minutes = Math.max(1, Math.floor((m.gameDuration || 0) / 60));
  const cs = m.cs ?? 0;
  const csPerMin = (cs / minutes).toFixed(1);
  const kp = m.killParticipation != null ? Math.round(m.killParticipation * 100) : null;
  const kda = m.deaths === 0 ? (m.kills + m.assists).toFixed(2) : ((m.kills + m.assists) / m.deaths).toFixed(2);
  const spells: number[] = m.summonerSpells || [];
  const win = m.win;

  // 5v5 team comp mini-grid
  const myTeamId = m.teamParticipants?.find((x: any) => x.puuid === puuid)?.teamId;
  const team1 = (m.teamParticipants || []).filter((p: any) => p.teamId === (myTeamId ?? 100));
  const team2 = (m.teamParticipants || []).filter((p: any) => p.teamId !== (myTeamId ?? 100));
  const isSR = (m.teamParticipants || []).length === 10;

  const openDetail = () =>
    navigate(`/match/${continent}/${m.matchId}`, { state: { puuid, region } });

  return (
    <motion.div
      onClick={openDetail}
      role="button"
      title="Ver detalle de la partida"
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.045, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '16px 14px 16px 18px',
        boxShadow: `inset 4px 0 0 ${win ? C.win : C.loss}`,
        borderBottom: HAIRLINE,
        background: win ? 'rgba(11,196,227,0.025)' : 'rgba(255,90,100,0.025)',
        flexWrap: 'wrap', cursor: 'pointer', transition: 'background .18s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = win ? 'rgba(11,196,227,0.06)' : 'rgba(255,90,100,0.06)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = win ? 'rgba(11,196,227,0.025)' : 'rgba(255,90,100,0.025)';
      }}
    >
      {/* Champ icon + spells */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <img src={c?.image} alt="" onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')}
            style={{ width: 58, height: 58, borderRadius: 10, objectFit: 'cover',
              border: `2px solid ${win ? C.win + '60' : C.loss + '50'}` }} />
          <div style={{ position: 'absolute', bottom: 2, right: 2, background: 'rgba(0,0,0,0.75)',
            borderRadius: 4, padding: '1px 4px', fontSize: 10, fontFamily: FONT_COND, fontWeight: 700, color: '#fff' }}>
            {m.champLevel || ''}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {spells.slice(0, 2).map((id, i) => {
            const url = spellIcon(id);
            return url
              ? <img key={i} src={url} alt="" style={{ width: 22, height: 22, borderRadius: 4 }} />
              : <div key={i} style={{ width: 22, height: 22, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }} />;
          })}
        </div>
      </div>

      {/* Result + queue */}
      <div style={{ width: 90, flexShrink: 0 }}>
        <div style={{
          display: 'inline-block', fontFamily: FONT_COND, fontWeight: 800, fontSize: 12,
          color: win ? C.win : C.loss, textTransform: 'uppercase', letterSpacing: '0.06em',
          background: win ? 'rgba(11,196,227,0.10)' : 'rgba(255,90,100,0.10)',
          border: `1px solid ${win ? C.win + '40' : C.loss + '40'}`,
          borderRadius: 5, padding: '2px 8px', marginBottom: 4,
        }}>
          {win ? 'Victoria' : 'Derrota'}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{queueName(m.queueId, m.gameMode)}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)' }}>{timeAgo(m.gameStartTimestamp)}</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>
          {Math.floor((m.gameDuration || 0) / 60)}m{String(((m.gameDuration || 0) % 60)).padStart(2, '0')}s
        </div>
      </div>

      {/* KDA / CS / KP */}
      <div style={{ minWidth: 126 }}>
        <Tip label="Asesinatos / Muertes / Asistencias (KDA)" asChild={false}>
          <div>
            <div style={{ fontFamily: FONT_KDA, fontWeight: 700, fontSize: 16 }}>
              {m.kills} / <span style={{ color: C.loss }}>{m.deaths}</span> / {m.assists}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>
              <span style={{ fontWeight: 700, color: Number(kda) >= 3 ? C.win : Number(kda) >= 2 ? '#fff' : 'rgba(255,255,255,0.55)' }}>{kda} KDA</span>
            </div>
          </div>
        </Tip>
        <Tip label={`Súbditos por minuto${kp != null ? ' · Participación en asesinatos' : ''}`}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>
            {cs} CS ({csPerMin}/min){kp != null ? ` · KP ${kp}%` : ''}
          </div>
        </Tip>
      </div>

      {/* Runes — keystone + secondary path */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {m.perks?.keystoneId ? (
          <Tip label={`Keystone: ${m.perks.keystoneId}`} asChild={false}>
            <div style={{ position: 'relative' }}>
              <img
                src={keystoneIcon(m.perks.keystoneId)} alt=""
                onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                style={{ width: 34, height: 34, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.5)', objectFit: 'contain',
                  border: `1px solid ${win ? 'rgba(11,196,227,0.25)' : 'rgba(255,90,100,0.2)'}` }}
              />
              {m.perks?.secondaryStyleId ? (
                <img
                  src={runePathIcon(m.perks.secondaryStyleId)} alt=""
                  onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                  style={{ position: 'absolute', bottom: -4, right: -4, width: 16, height: 16,
                    borderRadius: '50%', objectFit: 'contain', background: 'rgba(10,10,14,0.85)',
                    border: '1px solid rgba(255,255,255,0.15)' }}
                />
              ) : null}
            </div>
          </Tip>
        ) : (
          <div style={{ width: 34, height: 34 }} />
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* Items — 3×2 grid + trinket */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
        {/* Row 1: items 0-2 */}
        <div style={{ display: 'flex', gap: 2 }}>
          {(m.items || []).slice(0, 3).map((id: number, i: number) => (
            id > 0 ? (
              <img key={i} src={dd.item(id)} alt="" onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                style={{ width: 28, height: 28, borderRadius: 5, border: '1px solid rgba(255,255,255,0.10)', objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <div key={i} style={{ width: 28, height: 28, borderRadius: 5, background: 'rgba(255,255,255,0.04)', flexShrink: 0 }} />
            )
          ))}
        </div>
        {/* Row 2: items 3-5 + trinket */}
        <div style={{ display: 'flex', gap: 2 }}>
          {[...(m.items || []).slice(3, 6), m.trinket ?? 0].map((id: number, i: number) => (
            id > 0 ? (
              <img key={i} src={dd.item(id)} alt="" onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                style={{ width: 28, height: 28, borderRadius: 5,
                  border: `1px solid ${i === 3 ? 'rgba(200,155,60,0.35)' : 'rgba(255,255,255,0.10)'}`,
                  objectFit: 'cover', flexShrink: 0,
                  opacity: i === 3 ? 0.7 : 1 }}
              />
            ) : (
              <div key={i} style={{ width: 28, height: 28, borderRadius: 5, background: 'rgba(255,255,255,0.04)', flexShrink: 0 }} />
            )
          ))}
        </div>
        {/* Arena augments row (only when present) */}
        {(m.playerAugments as number[] | undefined)?.length ? (
          <div style={{ display: 'flex', gap: 2 }}>
            {(m.playerAugments as number[]).map((id, i) => (
              <div key={i} title={`Augment ${id}`}
                style={{ width: 28, height: 14, borderRadius: 3, background: 'rgba(200,155,60,0.15)',
                  border: '1px solid rgba(200,155,60,0.3)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 7, color: C.gold, fontWeight: 800 }}>
                A{i + 1}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Team comp — champion icons + truncated names */}
      {isSR && (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {[team1, team2].map((teamArr, ti) => (
            <div key={ti} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {teamArr.slice(0, 5).map((p: any, i: number) => {
                const pc = champByKey?.[String(p.championId)];
                const isMe = p.puuid === puuid;
                const href = profileHref(region, p.gameName ?? p.summonerName, p.tagLine);
                const shortName = (p.gameName || p.summonerName || '').slice(0, 9);
                const inner = (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <img
                      src={pc?.image} alt="" title={p.gameName || p.summonerName}
                      onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')}
                      style={{ width: 18, height: 18, borderRadius: 3, objectFit: 'cover', flexShrink: 0,
                        opacity: ti === 1 ? 0.5 : 1,
                        outline: isMe ? `1px solid ${C.gold}` : 'none' }}
                    />
                    <span style={{
                      fontSize: 9, color: isMe ? C.gold : ti === 0 ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.3)',
                      fontWeight: isMe ? 700 : 400, whiteSpace: 'nowrap', overflow: 'hidden',
                      maxWidth: 52, textOverflow: 'ellipsis', lineHeight: 1,
                    }}>
                      {shortName}
                    </span>
                  </div>
                );
                return href ? (
                  <Link key={i} to={href} onClick={(e) => e.stopPropagation()}
                    title={`Ver perfil de ${p.gameName || p.summonerName}`}
                    style={{ textDecoration: 'none' }}>
                    {inner}
                  </Link>
                ) : <div key={i}>{inner}</div>;
              })}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── Player tags ────────────────────────────────────────────────────────────
function PlayerTags({ tags, loading }: { tags: string[]; loading: boolean }) {
  return (
    <Panel style={{ padding: 26 }}>
      <SectionTitle>Etiquetas del jugador</SectionTitle>
      {loading ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={28} w={90} style={{ borderRadius: 999 }} />)}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          {tags.map((t, i) => (
            <span key={i} style={{ fontSize: 13, fontWeight: 500, padding: '6px 13px', borderRadius: 999, background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.78)' }}>
              {t}
            </span>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ─── Recently played with ───────────────────────────────────────────────────
function RecentlyPlayedWith({ players, loading, champByKey, region }: {
  players: any[] | null; loading: boolean; champByKey: any; region: string;
}) {
  return (
    <Panel style={{ padding: 26 }}>
      <SectionTitle>Jugó recientemente con</SectionTitle>
      {loading && !players ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={40} style={{ borderRadius: 8 }} />)}
        </div>
      ) : !players || players.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
          Sin compañeros recurrentes en las últimas partidas.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {players.map((p) => {
            const href = profileHref(region, p.gameName, p.tagLine);
            const wr = p.winRate;
            const topCid = p.champions?.[0]?.championId;
            const tc = topCid != null ? champByKey?.[String(topCid)] : null;
            const inner = (
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '11px 6px',
                  borderBottom: HAIRLINE, background: 'transparent',
                  transition: 'background .18s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {tc?.image ? (
                  <img src={tc.image} alt="" onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')}
                    style={{ width: 30, height: 30, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 30, height: 30, borderRadius: 6, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.gameName}<span style={{ color: 'rgba(255,255,255,0.35)' }}>{p.tagLine ? ` #${p.tagLine}` : ''}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                    {p.games} {p.games === 1 ? 'partida' : 'partidas'} juntos
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {wr != null ? (
                    <div style={{ fontFamily: FONT_COND, fontWeight: 800, fontSize: 14, color: wr >= 50 ? C.win : C.loss }}>{wr}%</div>
                  ) : (
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>—</div>
                  )}
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                    {p.asAlly}A · {p.asEnemy}E
                  </div>
                </div>
              </div>
            );
            return href ? (
              <Link key={p.puuid} to={href} style={{ textDecoration: 'none' }}>{inner}</Link>
            ) : (
              <div key={p.puuid}>{inner}</div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// ─── Role performance ───────────────────────────────────────────────────────
function RolePerformance({ perf, loading }: { perf: Record<Role, { games: number; wins: number }>; loading: boolean }) {
  const total = ROLES.reduce((s, r) => s + perf[r].games, 0);
  return (
    <Panel style={{ padding: 26 }}>
      <SectionTitle>Rendimiento por rol</SectionTitle>
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={22} />)}
        </div>
      ) : total === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Sin datos de roles.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '90px 60px 1fr', fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', paddingBottom: 6, borderBottom: HAIRLINE }}>
            <span>Rol</span><span>Partidas</span><span>Tasa de victorias</span>
          </div>
          {ROLES.map((r) => {
            const d = perf[r];
            const wr = d.games ? Math.round((d.wins / d.games) * 100) : 0;
            return (
              <div key={r} style={{ display: 'grid', gridTemplateColumns: '90px 60px 1fr', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{r}</span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{d.games}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1 }}><Bar value={wr} color={d.games ? (wr >= 50 ? C.win : C.loss) : 'rgba(255,255,255,0.15)'} /></div>
                  <span style={{ fontSize: 12, fontWeight: 700, width: 36, textAlign: 'right', color: d.games ? (wr >= 50 ? C.win : C.loss) : 'rgba(255,255,255,0.3)' }}>
                    {d.games ? `${wr}%` : '—'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// ─── Champions table ────────────────────────────────────────────────────────
function ChampionsTable({ rows, champByKey, loading, bestPlayers, region, opggChampStats }: {
  rows: any[]; champByKey: any; loading: boolean;
  bestPlayers?: Record<string, any> | null; region: string;
  opggChampStats?: any[] | null;
}) {
  const [showAll, setShowAll] = useState(false);

  // Build name → DDragon champion lookup (for OP.GG name matching)
  const champByName = useMemo(() => {
    if (!champByKey) return {};
    const m: Record<string, any> = {};
    Object.values(champByKey).forEach((c: any) => {
      const key = (c.name || '').toLowerCase().replace(/[_'\s.&]/g, '');
      m[key] = c;
    });
    return m;
  }, [champByKey]);

  // Build display rows: OP.GG (all-season) as primary; local matches as fallback
  const displayRows = useMemo(() => {
    if (opggChampStats?.length) {
      return [...opggChampStats]
        .filter((cs: any) => cs.play > 0)
        .sort((a: any, b: any) => b.play - a.play)
        .map((cs: any) => {
          const nameKey = cs.champion_name.toLowerCase().replace(/[_'\s.&]/g, '');
          const champData = champByName[nameKey];
          const play = cs.play || 1;
          const wr = Math.round((cs.win / play) * 100);
          // OP.GG always returns career totals for kill/death/assist — divide by play
          const avgK = parseFloat((cs.kill   / play).toFixed(1));
          const avgD = parseFloat((cs.death  / play).toFixed(1));
          const avgA = parseFloat((cs.assist / play).toFixed(1));
          const kda = avgD === 0 ? '∞' : ((avgK + avgA) / avgD).toFixed(2);
          return { champData, championName: cs.champion_name, play: cs.play, win: cs.win, lose: cs.lose, wr, kda, avgK, avgD, avgA, serverRank: cs.server_rank ?? null };
        });
    }
    // Fallback: rows from local match history
    return rows.map((r: any) => {
      const c = champByKey?.[String(r.id)];
      return { champData: c, championName: c?.name || String(r.id), play: r.games, win: Math.round(r.games * r.wr / 100), lose: r.games - Math.round(r.games * r.wr / 100), wr: r.wr, kda: r.kda };
    });
  }, [opggChampStats, rows, champByKey, champByName]);

  const visibleRows = showAll ? displayRows : displayRows.slice(0, 8);
  const usingOpgg = (opggChampStats?.length ?? 0) > 0;

  return (
    <Panel style={{ padding: 26 }}>
      <SectionTitle right={
        usingOpgg ? <span style={{ fontSize: 10, color: 'rgba(11,196,227,0.6)', fontWeight: 600, letterSpacing: '0.1em' }}>TODA LA TEMPORADA</span> : undefined
      }>
        Campeones · {usingOpgg ? 'Clasificatoria' : 'Solo/Dúo'}
      </SectionTitle>
      {loading && !displayRows.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={32} />)}
        </div>
      ) : displayRows.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Sin campeones clasificados aún.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.7fr 1fr 0.8fr', fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', paddingBottom: 9, borderBottom: HAIRLINE }}>
            <span>Campeón</span><span>KDA</span><span>Partidas · WR</span><span>Mejor jug.</span>
          </div>
          {visibleRows.map((r: any, idx: number) => {
            const c = r.champData;
            // Best player for this champ (from local match data — best by champion ID)
            const localId = c ? Object.keys(champByKey || {}).find(k => champByKey[k] === c) : null;
            const best = localId ? bestPlayers?.[localId] : null;
            const bestTier = best?.tier ? `${best.tier[0]}${best.tier.slice(1).toLowerCase()} ${best.rank || ''}`.trim() : null;
            const bestHref = best ? profileHref(region, best.gameName, best.tagLine) : null;
            const bestInner = best ? (
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, minWidth: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.redHover, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{best.gameName}</span>
                {bestTier && <span style={{ fontSize: 10, color: C.gold }}>{bestTier}</span>}
              </div>
            ) : <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>—</span>;

            return (
              <div
                key={r.championName + idx}
                style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.7fr 1fr 0.8fr', alignItems: 'center', gap: 8, padding: '10px 6px', borderBottom: HAIRLINE, transition: 'background .16s', cursor: 'default' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                {/* Champion icon + name + KDA details */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  {c?.image ? (
                    <img src={c.image} alt="" onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')} style={{ width: 32, height: 32, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: 7, background: 'rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>?</div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                      {c?.name || r.championName.toLowerCase().replace(/\b\w/g, (s: string) => s.toUpperCase()).replace(/_/g, ' ')}
                    </span>
                    {usingOpgg && r.avgK != null && (
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                        {r.avgK} / <span style={{ color: C.loss }}>{r.avgD}</span> / {r.avgA}
                      </span>
                    )}
                  </div>
                </div>

                {/* KDA ratio */}
                <span style={{ fontFamily: FONT_KDA, fontSize: 13, fontWeight: 700, color: Number(r.kda) >= 3 ? C.gold : Number(r.kda) >= 2 ? '#fff' : 'rgba(255,255,255,0.6)' }}>
                  {r.kda === '∞' ? <span style={{ color: C.teal }}>∞</span> : r.kda}
                </span>

                {/* Games + WR + server rank */}
                <div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                    {r.play}P · <span style={{ color: r.wr >= 55 ? C.win : r.wr < 45 ? C.loss : C.gold, fontWeight: 700 }}>{r.wr}%</span>
                  </div>
                  {r.serverRank != null ? (
                    <div style={{ fontSize: 10, color: C.teal, fontWeight: 700 }}>#{r.serverRank.toLocaleString()} servidor</div>
                  ) : (
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{r.win}V · {r.lose}D</div>
                  )}
                </div>

                {/* Best player */}
                {bestHref ? (
                  <Link to={bestHref} style={{ textDecoration: 'none', minWidth: 0 }} title={`Mejor con ${c?.name || ''}`}>{bestInner}</Link>
                ) : bestInner}
              </div>
            );
          })}

          {displayRows.length > 8 && (
            <button
              onClick={() => setShowAll(s => !s)}
              style={{ marginTop: 10, padding: '7px 0', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
            >
              {showAll ? '▲ Mostrar menos' : `▼ Ver todos los ${displayRows.length} campeones`}
            </button>
          )}
        </div>
      )}
    </Panel>
  );
}
