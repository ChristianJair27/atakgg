// Tournament query hooks — wrap the existing /api/tournaments endpoints.
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { qk } from "./keys";

export interface Tournament {
  id: string;
  name: string;
  phase: "registration" | "checkin" | "active" | "complete";
  status: string;
  participants: number;
  maxParticipants: number;
  prize: string;
  startDate: string;
  format: string;
  description: string;
  riotTournamentId?: number;
  codesAvailable?: number;
}

export function useTournaments() {
  return useQuery({
    queryKey: qk.tournaments(),
    queryFn: async () => {
      const { data } = await axiosInstance.get<Tournament[]>("/api/tournaments");
      return Array.isArray(data) ? data : [];
    },
  });
}

export function useTournament(id?: string) {
  return useQuery({
    queryKey: id ? qk.tournament(id) : qk.tournament("_"),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data } = await axiosInstance.get<Tournament>(`/api/tournaments/${id}`);
      return data;
    },
  });
}

export function useRegistrations(id?: string) {
  return useQuery({
    queryKey: id ? qk.registrations(id) : qk.registrations("_"),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/api/tournaments/${id}/registrations`);
      return data;
    },
  });
}
