import { useState, useEffect, useRef, useCallback } from 'react';
import axiosInstance from '@/lib/axios';
import type { TournamentGlobalStats } from '@/types/tournament-global-stats';

interface Options {
  tournamentId: string;
  enabled?: boolean;
  onNewMatch?: () => void;
}

const POLL_MS = 30_000;

export function useTournamentGlobalStats({ tournamentId, enabled = true, onNewMatch }: Options) {
  const [data, setData]       = useState<TournamentGlobalStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const prevCount     = useRef<number>(-1);
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const onNewMatchRef = useRef(onNewMatch);
  onNewMatchRef.current = onNewMatch;

  const fetchStats = useCallback(async () => {
    if (!tournamentId) return;
    try {
      setError(null);
      const { data: resp } = await axiosInstance.get<TournamentGlobalStats>(
        `/api/tournaments/${tournamentId}/global-stats`
      );
      setData(resp);
      if (prevCount.current >= 0 && resp.matchesCompleted > prevCount.current) {
        onNewMatchRef.current?.();
      }
      prevCount.current = resp.matchesCompleted;
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Error al obtener stats globales');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    fetchStats();
    intervalRef.current = setInterval(fetchStats, POLL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, fetchStats]);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchStats();
  }, [fetchStats]);

  return { data, loading, error, refresh };
}
