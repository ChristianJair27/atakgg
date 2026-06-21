import { useState, useEffect, useRef, useCallback } from 'react';
import axiosInstance from '@/lib/axios';
import type { MatchStatsResponse } from '@/types/riot-match';

interface UseMatchStatsOptions {
  tournamentId: string;
  bracketMatchId: string;
  gameId?: number;
  /** Called once when a complete match's stats are first loaded */
  onComplete?: (stats: MatchStatsResponse) => void;
  /** Whether to start polling; pass false when the match has no gameId yet */
  enabled?: boolean;
}

const POLL_INTERVAL_MS = 35_000;

export function useMatchStats({
  tournamentId,
  bracketMatchId,
  gameId,
  onComplete,
  enabled = true,
}: UseMatchStatsOptions) {
  const [stats, setStats] = useState<MatchStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const clearPoll = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const fetchStats = useCallback(async () => {
    if (!tournamentId || !bracketMatchId || !gameId) return;
    try {
      setError(null);
      const { data } = await axiosInstance.get<MatchStatsResponse>(
        `/api/tournaments/${tournamentId}/matches/${bracketMatchId}/stats`
      );
      setStats(data);

      if (data.isComplete && !completedRef.current) {
        completedRef.current = true;
        clearPoll();
        onCompleteRef.current?.(data);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.message ?? 'Error al obtener stats';
      if (err?.response?.status !== 404) setError(msg);
    } finally {
      setLoading(false);
    }
  }, [tournamentId, bracketMatchId, gameId, clearPoll]);

  useEffect(() => {
    if (!enabled || !gameId) return;

    // Immediate first fetch
    setLoading(true);
    fetchStats();

    // Start polling only if not already complete
    if (!completedRef.current) {
      intervalRef.current = setInterval(fetchStats, POLL_INTERVAL_MS);
    }

    return clearPoll;
  }, [enabled, gameId, fetchStats, clearPoll]);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refresh };
}
