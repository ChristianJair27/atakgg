// Riot stats query hooks — wrap /api/stats/* endpoints used by the profile and
// match-detail pages. These mirror the calls those pages already make; no
// endpoint behavior is changed.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import type { MatchStatsResponse } from "@/types/riot-match";
import { qk } from "./keys";

interface ResolveResult {
  puuid: string;
  gameName?: string;
  tagLine?: string;
}

// Shared query options for resolving a Riot ID → puuid, so both the hook and
// imperative callers (e.g. the search box `queryClient.fetchQuery`) use the same
// key + fetcher and warm the same cache entry.
export function resolveRiotIdQueryOptions(region: string, gameName: string, tagLine: string) {
  return {
    queryKey: qk.stats.resolve(region, gameName, tagLine),
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await axiosInstance.get<ResolveResult>("/api/stats/resolve", {
        params: { region, gameName, tagLine },
      });
      return data;
    },
  };
}

// Resolve Riot ID → puuid. Stats data is slow-moving, so cache it well.
export function useResolveRiotId(region?: string, gameName?: string, tagLine?: string) {
  return useQuery({
    ...resolveRiotIdQueryOptions(region || "", gameName || "", tagLine || ""),
    enabled: Boolean(region && gameName && tagLine),
  });
}

export function useSummary(platform?: string, puuid?: string) {
  return useQuery({
    queryKey: qk.stats.summary(platform || "", puuid),
    enabled: Boolean(platform && puuid),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/api/stats/summary/${platform}/${puuid}`);
      return data;
    },
  });
}

export function useRecentTeammates(continent?: string, puuid?: string, count = 20) {
  return useQuery({
    queryKey: qk.stats.recentTeammates(continent || "", puuid),
    enabled: Boolean(continent && puuid),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/api/stats/recent-teammates/${continent}/${puuid}`, {
        params: { count },
      });
      return (data?.players || []) as any[];
    },
  });
}

// Match history (full detail). Two-step Riot flow: fetch the recent match ids,
// then fetch each match's detail (best-effort — failed fetches are dropped). The
// `count` is part of the key so "Cargar más" keeps each page cached separately.
export function useMatches(continent?: string, puuid?: string, count = 10) {
  return useQuery({
    queryKey: qk.stats.matches(continent || "", puuid, count),
    enabled: Boolean(continent && puuid),
    staleTime: 10 * 60_000,
    // Keep the prior (smaller) page visible while "Cargar más" loads the bigger one.
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data: ids } = await axiosInstance.get(`/api/stats/matches/${continent}/${puuid}/ids`, {
        params: { count },
      });
      const settled = await Promise.allSettled(
        (ids || []).slice(0, count).map((mid: string) =>
          axiosInstance.get(`/api/stats/matches/${continent}/${mid}`, { params: { puuid } }),
        ),
      );
      return settled
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
        .map((r) => r.value.data)
        .sort((a, b) => (b.gameStartTimestamp || 0) - (a.gameStartTimestamp || 0));
    },
  });
}

// League regional rank + top% (apex tiers only; null otherwise — honest).
export function useLeagueRank(platform?: string, puuid?: string) {
  return useQuery({
    queryKey: qk.stats.leagueRank(platform || "", puuid),
    enabled: Boolean(platform && puuid),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/api/stats/league-rank/${platform}/${puuid}`);
      return {
        regionalRank: (data?.regionalRank ?? null) as number | null,
        topPercent: (data?.topPercent ?? null) as number | null,
      };
    },
  });
}

// "Mejor jugador" per champion (best-effort, ours; cached server-side).
export function useBestPlayers(platform?: string, puuid?: string, count = 15) {
  return useQuery({
    queryKey: qk.stats.bestPlayers(platform || "", puuid),
    enabled: Boolean(platform && puuid),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/api/stats/best-players/${platform}/${puuid}`, {
        params: { count },
      });
      return (data?.byChampion || {}) as Record<string, any>;
    },
  });
}

// Available seasons for a player (wraps /api/stats/seasons).
export function useSeasons(puuid?: string) {
  return useQuery({
    queryKey: qk.stats.seasons(puuid),
    enabled: Boolean(puuid),
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/api/stats/seasons/${puuid}`);
      return data;
    },
  });
}

// Rich match stats for the match-detail page.
export function useMatchStats(regional?: string, matchId?: string) {
  return useQuery({
    queryKey: qk.stats.matchStats(regional || "", matchId || ""),
    enabled: Boolean(regional && matchId),
    staleTime: 10 * 60_000, // a finished match never changes
    queryFn: async () => {
      const { data } = await axiosInstance.get<MatchStatsResponse>(
        `/api/stats/match-stats/${regional}/${matchId}`,
      );
      return data;
    },
  });
}
