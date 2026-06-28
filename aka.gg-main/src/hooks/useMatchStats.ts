import { useState, useEffect, useRef, useCallback } from 'react';
import axiosInstance from '@/lib/axios';
import type { MatchStatsResponse } from '@/types/riot-match';

interface UseMatchStatsOptions {
  tournamentId: string;
  bracketMatchId: string;
  gameId?: number;
  /** Tournament code — stats endpoint auto-detects gameId from code */
  tournamentCode?: string | null;
  /** Called once when a complete match's stats are first loaded */
  onComplete?: (stats: MatchStatsResponse) => void;
  /** Whether to start polling */
  enabled?: boolean;
}

const POLL_INTERVAL_MS = 20_000;

export function useMatchStats({
  tournamentId,
  bracketMatchId,
  gameId,
  tournamentCode,
  onComplete,
  enabled = true,
}: UseMatchStatsOptions) {
  const [stats, setStats] = useState<MatchStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitingForGame, setWaitingForGame] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const canPoll = Boolean(tournamentId && bracketMatchId && (gameId || tournamentCode));

  const clearPoll = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const fetchStats = useCallback(async () => {
    if (!canPoll) return;
    try {
      setError(null);
      const { data } = await axiosInstance.get<MatchStatsResponse>(
        `/api/tournaments/${tournamentId}/matches/${bracketMatchId}/stats`
      );
      setStats(data);
      setWaitingForGame(false);

      if (data.isComplete && !completedRef.current) {
        completedRef.current = true;
        clearPoll();
        onCompleteRef.current?.(data);
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error ?? err?.message ?? 'Error al obtener stats';
      if (status === 404) {
        setWaitingForGame(true);
        setError(null);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [tournamentId, bracketMatchId, canPoll, clearPoll]);

  useEffect(() => {
    completedRef.current = false;
    if (!enabled || !canPoll) return;

    setLoading(true);
    fetchStats();

    if (!completedRef.current) {
      intervalRef.current = setInterval(fetchStats, POLL_INTERVAL_MS);
    }

    return clearPoll;
  }, [enabled, canPoll, fetchStats, clearPoll, gameId, tournamentCode, bracketMatchId]);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refresh, waitingForGame };
}