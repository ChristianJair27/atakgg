// src/hooks/stats.ts
import { useMutation, useQuery } from "@tanstack/react-query";
import { axiosInstance } from "../lib/axios";
import type { Platform, Continent } from "../lib/utils";

/** Utilidad opcional: detecta si la “API” devolvió HTML (front) */
const safeGet = async <T,>(url: string, config: any = {}): Promise<T> => {
  const res = await axiosInstance.get<T>(url, { validateStatus: () => true, ...config });
  const ct = (res.headers as any)?.["content-type"] || "";
  if (ct.includes("text/html")) {
    throw new Error(`La API devolvió HTML en ${url}. Revisa proxy /api o baseURL.`);
  }
  if (res.status >= 400) {
    throw new Error(`Error ${res.status} en ${url}: ${(res.data as any)?.message || "request failed"}`);
  }
  return res.data;
};

type ResolveParams = { region: Platform; gameName: string; tagLine: string };
type ResolveResp = { puuid: string; gameName: string; tagLine: string };

export const useResolveSummoner = () =>
  useMutation<ResolveResp, any, ResolveParams>({
    mutationKey: ["resolveSummoner"],
    mutationFn: async (p) => {
      return safeGet<ResolveResp>("/api/stats/resolve", {
        params: { region: p.region, gameName: p.gameName, tagLine: p.tagLine },
      });
    },
  });

type SummaryResp = {
  summoner: { name: string; level: number; profileIconId?: number };
  rank: { queue: string; tier: string; rank: string; lp: number; wins?: number; losses?: number }[] | null;
  masteryTop:
    | { championId: number; championName: string; level: number; points: number }[]
    | null;
};

export const useSummary = (platform?: Platform, puuid?: string) =>
  useQuery({
    queryKey: ["summary", platform, puuid],
    enabled: Boolean(platform && puuid),
    queryFn: async () => {
      return safeGet<SummaryResp>(`/api/stats/summary/${platform}/${puuid}`);
    },
  });

/** CORREGIDO: usa /ids y devuelve string[] */
export const useMatches = (continent?: Continent, puuid?: string, count = 10) =>
  useQuery({
    queryKey: ["matches", continent, puuid, count],
    enabled: false, // se dispara manualmente si así lo deseas
    queryFn: async () => {
      return safeGet<string[]>(
        `/api/stats/matches/${continent}/${puuid}/ids`,
        { params: { start: 0, count } }
      );
    },
  });
