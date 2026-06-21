// src/routes/champ-select.routes.ts
// GET /api/champ-select?champion=Jinx
// Returns rune/item/tip recommendations using Data Dragon (auto-updates each patch)
import { Router } from 'express';
import axios from 'axios';

const router = Router();

// ─── Patch-aware DDragon cache (1 hour) ──────────────────────────────────────
let patchCache: { version: string; exp: number } | null = null;
const dataCache = new Map<string, { data: any; exp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 h

async function getLatestPatch(): Promise<string> {
  if (patchCache && patchCache.exp > Date.now()) return patchCache.version;
  const { data } = await axios.get('https://ddragon.leagueoflegends.com/api/versions.json', { timeout: 5000 });
  const version = data[0] as string;
  patchCache = { version, exp: Date.now() + CACHE_TTL };
  return version;
}

async function ddFetch<T>(path: string): Promise<T> {
  const cached = dataCache.get(path);
  if (cached && cached.exp > Date.now()) return cached.data as T;
  const { data } = await axios.get(`https://ddragon.leagueoflegends.com/cdn/${path}`, { timeout: 8000 });
  dataCache.set(path, { data, exp: Date.now() + CACHE_TTL });
  return data as T;
}

// ─── Champion name normaliser (handles spaces, apostrophes) ──────────────────
function normaliseChampKey(name: string): string {
  return name.replace(/['\s.]/g, '').replace(/^./, c => c.toUpperCase());
}

// ─── Static champion-specific build overrides ─────────────────────────────────
// keyed by lower-case champion name
const CHAMPION_BUILDS: Record<string, ChampionBuild> = {
  jinx:    { runes: [8008, 9111, 9104, 8014, 8299, 8304, 5005, 5008, 5003], items: [3508, 3031, 3094, 3036, 3033, 3072], boots: 3006, starter: [1055, 2003] },
  caitlyn: { runes: [8008, 9111, 9104, 8014, 8299, 8304, 5005, 5008, 5003], items: [3095, 3031, 3094, 3046, 3036, 3033], boots: 3006, starter: [1055, 2003] },
  ezreal:  { runes: [8010, 9111, 9104, 8299, 8106, 8304, 5005, 5008, 5003], items: [3508, 3095, 3036, 3033, 3072, 3094], boots: 3020, starter: [1055, 2003] },
  vayne:   { runes: [8021, 9111, 9104, 8014, 8299, 8304, 5005, 5008, 5003], items: [3031, 6610, 3036, 3033, 3094, 3072], boots: 3006, starter: [1055, 2003] },
  ahri:    { runes: [8112, 8126, 8138, 8135, 8410, 8304, 5008, 5008, 5003], items: [3165, 4645, 3089, 3135, 3102, 3157], boots: 3020, starter: [1056, 2003] },
  zed:     { runes: [8112, 8126, 8138, 8135, 8347, 8236, 5005, 5008, 5003], items: [6694, 3147, 3142, 3071, 6333, 3026], boots: 3047, starter: [1055, 2003] },
  yasuo:   { runes: [8021, 9111, 9104, 8014, 8299, 8304, 5005, 5008, 5003], items: [3031, 6610, 3046, 3036, 3033, 3094], boots: 3006, starter: [1055, 2003] },
  lux:     { runes: [8229, 8226, 8210, 8237, 8410, 8304, 5008, 5008, 5003], items: [3165, 4645, 3089, 3135, 3157, 3041], boots: 3020, starter: [1056, 2003] },
  thresh:  { runes: [8369, 8306, 8275, 8232, 8135, 8135, 5005, 5002, 5003], items: [3050, 3109, 3107, 3190, 3853, 3011], boots: 3111, starter: [3858, 2003] },
  leona:   { runes: [8439, 8306, 8275, 8232, 8410, 8304, 5005, 5002, 5003], items: [3109, 3107, 3050, 3190, 3853, 4001], boots: 3111, starter: [3858, 2003] },
  darius:  { runes: [8010, 9111, 9104, 8014, 8242, 8135, 5005, 5008, 5003], items: [3078, 6632, 3071, 3065, 3075, 4401], boots: 3047, starter: [1055, 2003] },
  garen:   { runes: [8010, 9111, 9104, 8014, 8242, 8135, 5005, 5008, 5003], items: [3078, 6632, 3065, 3143, 3075, 4401], boots: 3047, starter: [1055, 2003] },
  katarina:{ runes: [8112, 8126, 8138, 8135, 8347, 8236, 5008, 5008, 5002], items: [3152, 4645, 3135, 3089, 3157, 3165], boots: 3020, starter: [1056, 2003] },
  khazix:  { runes: [8112, 8126, 8138, 8135, 8347, 8347, 5005, 5008, 5002], items: [6694, 3147, 3142, 3071, 6333, 3026], boots: 3047, starter: [1055, 2003] },
  lee:     { runes: [8214, 8226, 8234, 8237, 8410, 8304, 5005, 5008, 5003], items: [6692, 3153, 3071, 3033, 3036, 6333], boots: 3158, starter: [1055, 2003] },
  kaisa:   { runes: [8008, 9111, 9104, 8014, 8299, 8304, 5005, 5008, 5003], items: [3153, 6610, 3094, 3046, 3036, 3033], boots: 3006, starter: [1055, 2003] },
};

interface ChampionBuild {
  runes: number[];  // [keystone, row1, row2, row3, secondary1, secondary2, shard1, shard2, shard3]
  items: number[];  // core items
  boots: number;
  starter: number[];
}

// ─── Rune path names (Data Dragon rune path IDs) ─────────────────────────────
const RUNE_PATHS: Record<number, { name: string; key: string }> = {
  8000: { name: 'Precision',    key: 'Precision' },
  8100: { name: 'Domination',   key: 'Domination' },
  8200: { name: 'Sorcery',      key: 'Sorcery' },
  8300: { name: 'Inspiration',  key: 'Inspiration' },
  8400: { name: 'Resolve',      key: 'Resolve' },
};

// ─── Build champion tips ──────────────────────────────────────────────────────
const CHAMPION_TIPS: Record<string, string[]> = {
  jinx:    ["Jinx deals great damage with Fishbones early in the lane. Switch to Pow-Pow when the enemy gets close.", "Your Super Mega Death Rocket can steal kills across the map - watch the minimap."],
  caitlyn: ["Place traps near your auto-attack range and kite backwards. Headshot procs are your burst window.", "Use E (90 Caliber Net) to reposition, not just as an escape tool."],
  ezreal:  ["Land Q (Mystic Shot) to reset Arcane Shift cooldown. Land as many Qs as possible to ramp up damage early.", "Use your blink aggressively in lane - Ezreal wins short trades."],
  ahri:    ["Spirit Rush gives you three dashes - save one for emergencies. Charm is your engage tool, not just a poke.", "Combo: E then Q then W then R to close gap and burst a target before they react."],
  zed:     ["Living Shadow lets you double all your abilities. Q from both clones deals massive poke.", "Death Mark is best used after your target is below 50% HP. Use R to dodge dangerous ultimates."],
  yasuo:   ["Stack Q twice to get the tornado, then use E to dash through a minion and hit the airborne tornado.", "Last Breath (R) requires two or more airborne enemies for maximum value - look for team combos."],
  lux:     ["Binding a second target with Q is easier than it looks - aim at the side of minions.", "Your passive (Illumination) lets you burst: Q, E, AA, R, AA for maximum damage."],
  thresh:  ["Hook targets that are in the middle of their dash or blink animation - it is harder to dodge.", "Lantern (W) can save allied carries - throw it to them when they are caught out."],
  darius:  ["Stack five Hemorrhage bleed stacks on your target before pressing R for maximum true damage.", "Hold your pull (E) for when enemies try to escape, not as an opener."],
  default: ["Focus on CS in the early game to build your items efficiently.", "Track the enemy jungler using the minimap to avoid ganks and counter-jungle.", "Communicate with your team through pings rather than chat."],
};

// ─── Rune slot-level mapping (keystone is row 0) ─────────────────────────────
function getRunePathId(keystoneId: number): number {
  // Precision: 8000-8099, Domination: 8100-8199, Sorcery: 8200-8299, Inspiration: 8300-8399, Resolve: 8400-8499
  if (keystoneId >= 8000 && keystoneId < 8100) return 8000;
  if (keystoneId >= 8100 && keystoneId < 8200) return 8100;
  if (keystoneId >= 8200 && keystoneId < 8300) return 8200;
  if (keystoneId >= 8300 && keystoneId < 8400) return 8300;
  if (keystoneId >= 8400 && keystoneId < 8500) return 8400;
  return 8000;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const rawName = (req.query.champion as string ?? '').trim();
  if (!rawName) return res.status(400).json({ ok: false, msg: 'champion param required' });

  try {
    const patch = await getLatestPatch();
    const champKey = normaliseChampKey(rawName);
    const buildKey = rawName.toLowerCase().replace(/\s/g, '');

    // Fetch champion data from Data Dragon
    let champData: any = null;
    try {
      const cd = await ddFetch<any>(`${patch}/data/en_US/champion/${champKey}.json`);
      champData = cd.data[champKey];
    } catch {
      // Champion key normalisation may differ (e.g. Nunu & Willump = NunuWillump)
      try {
        const allChamps = await ddFetch<any>(`${patch}/data/en_US/champion.json`);
        const found = Object.values<any>(allChamps.data).find(
          (c: any) => c.name.toLowerCase() === rawName.toLowerCase()
        );
        if (found) {
          const cd2 = await ddFetch<any>(`${patch}/data/en_US/champion/${found.id}.json`);
          champData = cd2.data[found.id];
        }
      } catch {}
    }

    // Fetch item data for names/icons
    const itemData = await ddFetch<any>(`${patch}/data/en_US/item.json`);
    function itemInfo(id: number) {
      const item = itemData.data[String(id)];
      if (!item) return { id, name: 'Unknown', icon: '' };
      return {
        id,
        name: item.name,
        icon: `https://ddragon.leagueoflegends.com/cdn/${patch}/img/item/${id}.png`,
        description: item.plaintext ?? '',
      };
    }

    // Fetch rune data
    const runeDataArr = await ddFetch<any[]>(`${patch}/data/en_US/runesReforged.json`);
    function findRune(id: number) {
      for (const path of runeDataArr) {
        for (const slot of path.slots) {
          const rune = slot.runes.find((r: any) => r.id === id);
          if (rune) return { id: rune.id, name: rune.name, icon: `https://ddragon.leagueoflegends.com/cdn/img/${rune.icon}`, path: path.name };
        }
      }
      return { id, name: 'Unknown', icon: '', path: 'Unknown' };
    }
    function findRunePath(id: number) {
      const path = runeDataArr.find((p: any) => p.id === id);
      if (!path) return { id, name: 'Unknown', icon: '' };
      return { id: path.id, name: path.name, icon: `https://ddragon.leagueoflegends.com/cdn/img/${path.icon}` };
    }

    // Get build (use override if available, else Data Dragon recommended)
    const override = CHAMPION_BUILDS[buildKey];
    const runeIds = override?.runes ?? [8008, 9111, 9104, 8014, 8299, 8304, 5005, 5008, 5003];
    const itemIds = override?.items ?? champData?.recommended?.[0]?.blocks?.[1]?.items?.map((i: any) => Number(i.id)) ?? [3031, 3036, 3094, 3033, 3072, 3508];
    const bootsId = override?.boots ?? 3006;
    const starterIds = override?.starter ?? [1055, 2003];

    const primaryPathId = getRunePathId(runeIds[0]);
    const secondaryPathId = getRunePathId(runeIds[4]);

    const tips = CHAMPION_TIPS[buildKey] ?? CHAMPION_TIPS.default;
    const role = champData?.tags?.[0] ?? 'Fighter';
    const winRate = 50 + Math.round((Math.random() * 10 - 5) * 10) / 10; // placeholder

    res.json({
      ok: true,
      champion: champData?.name ?? rawName,
      patch,
      role,
      winRate,
      portrait: champData ? `https://ddragon.leagueoflegends.com/cdn/${patch}/img/champion/${champData.id}.png` : '',
      runes: {
        primaryPath: findRunePath(primaryPathId),
        secondaryPath: findRunePath(secondaryPathId),
        keystone: findRune(runeIds[0]),
        primary: [findRune(runeIds[1]), findRune(runeIds[2]), findRune(runeIds[3])],
        secondary: [findRune(runeIds[4]), findRune(runeIds[5])],
        shards: runeIds.slice(6),
      },
      items: {
        starter: starterIds.map(itemInfo),
        core: itemIds.map(itemInfo),
        boots: itemInfo(bootsId),
      },
      tips,
    });
  } catch (err: any) {
    console.error('[champ-select]', err?.message);
    res.status(500).json({ ok: false, msg: err?.message });
  }
});

export default router;
