// Centralized React Query key factory for ATAK.GG.
//
// Convention: keys are arrays whose first element is a stable domain string and
// whose remaining elements are the params that identify the resource. Always go
// through this factory so invalidation stays consistent across the app.
export const qk = {
  tournaments: () => ["tournaments"] as const,
  tournament: (id: string) => ["tournament", id] as const,
  registrations: (id: string) => ["tournament", id, "registrations"] as const,
  invitations: () => ["tournament-invitations"] as const,
  tournamentDashboard: () => ["tournament-dashboard"] as const,

  overview: () => ["overview"] as const,

  social: {
    feed: (tag: string) => ["social", "feed", tag] as const,
    comments: (postId: number) => ["social", "comments", postId] as const,
  },

  stats: {
    resolve: (region: string, gameName: string, tagLine: string) =>
      ["stats", "resolve", region, gameName, tagLine] as const,
    summary: (platform: string, puuid?: string) => ["stats", "summary", platform, puuid] as const,
    matchStats: (regional: string, matchId: string) =>
      ["stats", "matchStats", regional, matchId] as const,
    recentTeammates: (continent: string, puuid?: string) =>
      ["stats", "recentTeammates", continent, puuid] as const,
    matches: (continent: string, puuid: string | undefined, count: number) =>
      ["stats", "matches", continent, puuid, count] as const,
    leagueRank: (platform: string, puuid?: string) =>
      ["stats", "leagueRank", platform, puuid] as const,
    bestPlayers: (platform: string, puuid?: string) =>
      ["stats", "bestPlayers", platform, puuid] as const,
    seasons: (puuid?: string) => ["stats", "seasons", puuid] as const,
  },
} as const;
