// Riot stats query hooks — wrap /api/stats/* endpoints used by the profile and
// match-detail pages. These mirror the calls those pages already make; no
// endpoint behavior is changed.
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import type { MatchStatsResponse } from "@/types/riot-match";
import { qk } from "./keys";

// Resolve Riot ID → puuid. Stats data is slow-moving, so cache it well.
export function useResolveRiotId(region?: string, gameName?: string, tagLine?: string) {
  return useQuery({
    queryKey: qk.stats.resolve(region || "", gameName || "", tagLine || ""),
    enabled: Boolean(region && gameName && tagLine),
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await axiosInstance.get<{ puuid: string }>("/api/stats/resolve", {
        params: { region, gameName, tagLine },
      });
      return data;
    },
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
