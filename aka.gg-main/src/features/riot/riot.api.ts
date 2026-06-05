// src/features/riot/riot.api.ts
import { axiosInstance } from "@/lib/axios";

export async function linkRiotAccount(payload: { riotId: string; platform: string }) {
  const { data } = await axiosInstance.post("/api/players/link", payload);
  return data;
}

export async function getMyOverview() {
  const { data } = await axiosInstance.get("/api/players/me/overview");
  return data;
}
