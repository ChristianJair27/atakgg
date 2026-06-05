// src/hooks/match.ts
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";

export const useMatchDetail = (regional?: string, matchId?: string, puuid?: string) =>
  useQuery({
    queryKey: ["matchDetail", regional, matchId, puuid],
    enabled: Boolean(regional && matchId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/api/stats/matches/${regional}/${matchId}`, {
        params: puuid ? { puuid } : {},
      });
      return data;
    },
  });

export const useMatchTimeline = (regional?: string, matchId?: string) =>
  useQuery({
    queryKey: ["matchTimeline", regional, matchId],
    enabled: Boolean(regional && matchId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/api/stats/match-timeline/${regional}/${matchId}`);
      return data as {
        frames: { t:number; blueGold:number; redGold:number; blueCS:number; redCS:number }[];
        skillUps: { t:number; participantId:number; skillSlot:number; levelUpType:string }[];
        itemBuys: { t:number; participantId:number; itemId:number }[];
        objectives: { t:number; type:string; teamId?:number }[];
      };
    },
  });
