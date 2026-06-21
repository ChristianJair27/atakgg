// Data Dragon & CDragon asset URL helpers

const DD_VERSION = '15.12.1';
const DD_BASE = `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}`;
const CDRAGON_BASE = 'https://raw.communitydragon.org/latest';

export const dd = {
  champion: (name: string) => `${DD_BASE}/img/champion/${encodeURIComponent(name)}.png`,
  championSplash: (name: string, skin = 0) => `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${name}_${skin}.jpg`,
  item: (id: number) => id ? `${DD_BASE}/img/item/${id}.png` : '',
  spell: (name: string) => `${DD_BASE}/img/spell/${name}.png`,
  profileIcon: (id: number) => `${DD_BASE}/img/profileicon/${id}.png`,
  rune: (path: string) => `${CDRAGON_BASE}/plugins/rcp-be-lol-game-data/global/default/${path.replace(/^\//, '').toLowerCase()}`,
};

/** Map summoner spell integer IDs to their Data Dragon name strings */
export const SUMMONER_SPELL_NAMES: Record<number, string> = {
  1:  'SummonerBoost',       // Cleanse
  3:  'SummonerExhaust',     // Exhaust
  4:  'SummonerFlash',       // Flash
  6:  'SummonerHaste',       // Ghost
  7:  'SummonerHeal',        // Heal
  11: 'SummonerSmite',       // Smite
  12: 'SummonerTeleport',    // Teleport
  13: 'SummonerMana',        // Clarity
  14: 'SummonerDot',         // Ignite
  21: 'SummonerBarrier',     // Barrier
  30: 'SummonerPoroRecall',  // Mark (ARAM)
  31: 'SummonerPoroThrow',   // Poro Toss
  32: 'SummonerSnowball',    // Mark
  39: 'SummonerSnowURFSnowball_Mark',
  54: 'Summoner_UltBook_Placeholder',
  55: 'Summoner_UltBook_SmiteAvatar',
};

export const SUMMONER_SPELL_LABELS: Record<number, string> = {
  1: 'Limpieza', 3: 'Agotamiento', 4: 'Flash', 6: 'Velocidad',
  7: 'Curar', 11: 'Castigar', 12: 'Teleporte', 13: 'Claridad',
  14: 'Incendiar', 21: 'Barrera', 32: 'Marcar',
};

export function spellIcon(id: number): string {
  const name = SUMMONER_SPELL_NAMES[id];
  return name ? dd.spell(name) : '';
}

/** Rune keystone paths (Community Dragon) */
const KEYSTONE_PATHS: Record<number, string> = {
  // Precision
  8005: 'press-the-attack',
  8008: 'lethal-tempo',
  8021: 'fleet-footwork',
  8010: 'conqueror',
  // Domination
  8112: 'electrocute',
  8124: 'predator',
  8128: 'dark-harvest',
  9923: 'hail-of-blades',
  // Sorcery
  8214: 'summon-aery',
  8229: 'arcane-comet',
  8230: 'phase-rush',
  // Resolve
  8437: 'grasp-of-the-undying',
  8439: 'aftershock',
  8465: 'guardian',
  // Inspiration
  8351: 'glacial-augment',
  8360: 'unsealed-spellbook',
  8369: 'first-strike',
};

/** Returns a CDragon-hosted keystone icon URL */
export function keystoneIcon(id: number): string {
  const slug = KEYSTONE_PATHS[id];
  if (!slug) return '';
  return `${CDRAGON_BASE}/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/${slug}.png`;
}

/** Rune path/tree IDs → CDragon folder */
const RUNE_PATH_FOLDERS: Record<number, string> = {
  8000: 'precision',
  8100: 'domination',
  8200: 'sorcery',
  8300: 'inspiration',
  8400: 'resolve',
};

export function runePathIcon(styleId: number): string {
  const folder = RUNE_PATH_FOLDERS[styleId];
  if (!folder) return '';
  return `${CDRAGON_BASE}/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/${folder}.png`;
}

/** Format seconds to mm:ss */
export function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Format large numbers with k suffix */
export function fmtNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
