// Player / account query hooks — wrap /api/players/* endpoints.
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { qk } from "./keys";

export type OverviewResponse = {
  ok: boolean;
  linked: boolean;
  profile?: {
    gameName?: string;
    tagLine?: string;
    platform?: string;
    puuid?: string;
    profileIcon?: number | null;
  };
  stats?: {
    totalMatches?: number;
    winRate?: number;
    currentRank?: string | null;
    lp?: number | null;
    favoriteChampion?: string | null;
    tournamentsJoined?: number;
    socialPosts?: number;
  };
  recent?: Array<{
    win?: boolean;
    queueName?: string;
    championName?: string;
    duration?: number;
  }>;
};

export function useOverview() {
  return useQuery({
    queryKey: qk.overview(),
    queryFn: async () => {
      const { data } = await axiosInstance.get<OverviewResponse>("/api/players/me/overview");
      return data;
    },
  });
}
