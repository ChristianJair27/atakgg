// Data Dragon & CDragon asset URL helpers

const DD_VERSION = '16.13.1';
const DD_BASE = `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}`;
const DD_IMG = 'https://ddragon.leagueoflegends.com/cdn/img';
const CDRAGON_BASE = 'https://raw.communitydragon.org/latest';

// Champion icon keys are alphanumeric (e.g. "MissFortune", "MonkeyKing"); strip
// any stray spaces/punctuation so display-name fallbacks still resolve.
const champKey = (name: string) => (name || '').replace(/[^a-zA-Z0-9]/g, '');

export const dd = {
  champion: (name: string) => `${DD_BASE}/img/champion/${champKey(name)}.png`,
  championSplash: (name: string, skin = 0) => `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champKey(name)}_${skin}.jpg`,
  item: (id: number) => id ? `${DD_BASE}/img/item/${id}.png` : '',
  spell: (name: string) => `${DD_BASE}/img/spell/${name}.png`,
  profileIcon: (id: number) => `${DD_BASE}/img/profileicon/${id}.png`,
  rune: (path: string) => `${CDRAGON_BASE}/plugins/rcp-be-lol-game-data/global/default/${path.replace(/^\//, '').toLowerCase()}`,
};

/** Ranked emblem (tier) icon — CommunityDragon. Folder is singular: ranked-emblem */
export function rankEmblem(tier?: string): string {
  if (!tier) return '';
  return `${CDRAGON_BASE}/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${tier.toLowerCase()}.png`;
}

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

/** Keystone id → DDragon perk-image path (under Styles/). Full filenames matter
 *  (e.g. LethalTempoTemp, VeteranAftershock). */
const KEYSTONE_PATHS: Record<number, string> = {
  // Precision
  8005: 'Precision/PressTheAttack/PressTheAttack',
  8008: 'Precision/LethalTempo/LethalTempoTemp',
  8021: 'Precision/FleetFootwork/FleetFootwork',
  8010: 'Precision/Conqueror/Conqueror',
  // Domination
  8112: 'Domination/Electrocute/Electrocute',
  8124: 'Domination/Predator/Predator',
  8128: 'Domination/DarkHarvest/DarkHarvest',
  9923: 'Domination/HailOfBlades/HailOfBlades',
  // Sorcery
  8214: 'Sorcery/SummonAery/SummonAery',
  8229: 'Sorcery/ArcaneComet/ArcaneComet',
  8230: 'Sorcery/PhaseRush/PhaseRush',
  // Resolve
  8437: 'Resolve/GraspOfTheUndying/GraspOfTheUndying',
  8439: 'Resolve/VeteranAftershock/VeteranAftershock',
  8465: 'Resolve/Guardian/Guardian',
  // Inspiration
  8351: 'Inspiration/GlacialAugment/GlacialAugment',
  8360: 'Inspiration/UnsealedSpellbook/UnsealedSpellbook',
  8369: 'Inspiration/FirstStrike/FirstStrike',
};

/** Returns a DDragon-hosted keystone icon URL */
export function keystoneIcon(id: number): string {
  const p = KEYSTONE_PATHS[id];
  return p ? `${DD_IMG}/perk-images/Styles/${p}.png` : '';
}

/** Rune path/tree style id → CommunityDragon style icon filename */
const RUNE_PATH_FILES: Record<number, string> = {
  8000: '7201_precision',
  8100: '7200_domination',
  8200: '7202_sorcery',
  8300: '7203_whimsy',
  8400: '7204_resolve',
};

export function runePathIcon(styleId: number): string {
  const file = RUNE_PATH_FILES[styleId];
  if (!file) return '';
  return `${CDRAGON_BASE}/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/${file}.png`;
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
