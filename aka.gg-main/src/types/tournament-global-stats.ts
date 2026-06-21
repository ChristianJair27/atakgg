// Types for aggregated tournament-wide player stats (across all completed matches)

export interface PlayerAggregate {
  summonerName: string;
  tagLine: string;
  championPool: string[];
  mostPlayedChamp: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winrate: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  avgKda: number;
  totalGold: number;
  avgGoldPerMin: number;
  totalDamage: number;
  avgDamagePerMin: number;
  totalVisionScore: number;
  avgVisionPerMin: number;
  totalCs: number;
  avgCsPerMin: number;
  pentaKills: number;
  quadraKills: number;
  tripleKills: number;
  doubleKills: number;
}

export interface TournamentGlobalStats {
  tournamentId: string;
  matchesCompleted: number;
  players: PlayerAggregate[];
  lastUpdated: number;
}

export type GlobalSortKey =
  | 'avgKda' | 'totalKills' | 'totalDeaths' | 'totalAssists'
  | 'avgGoldPerMin' | 'totalGold'
  | 'avgDamagePerMin' | 'totalDamage'
  | 'avgCsPerMin' | 'totalCs'
  | 'avgVisionPerMin' | 'totalVisionScore'
  | 'winrate' | 'gamesPlayed' | 'pentaKills';
