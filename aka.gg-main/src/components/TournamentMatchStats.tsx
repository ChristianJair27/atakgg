// src/components/TournamentMatchStats.tsx
// Auto-polls stats after each tournament match is played
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import axiosInstance from '@/lib/axios';
import { Swords, RefreshCw, Trophy, Eye, Skull, Target, Zap, Shield } from 'lucide-react';
import { useChampions } from '@/hooks/use-ddragon';

interface MatchParticipant {
  summonerName: string; tagLine?: string; championName: string; champLevel: number;
  teamId: number; win: boolean;
  kills: number; deaths: number; assists: number; kda: number;
  cs: number; csPerMin: number; goldEarned: number;
  totalDamageDealt: number; visionScore: number;
  wardsPlaced: number; wardsKilled: number;
  items: number[]; pentaKills: number;
}
interface MatchStats {
  matchId: string; gameDuration: number; gameMode: string;
  blueTeam: MatchParticipant[]; redTeam: MatchParticipant[];
  winner: 'blue' | 'red';
}

interface BracketMatch {
  id: string; team1: string | null; team2: string | null;
  winner: string | null; code: string | null;
  matchStatus: string; gameId?: number; score1?: number; score2?: number;
}

function StatBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  return (
    <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function PlayerRow({ p, isMvp, maxDmg }: { p: MatchParticipant; isMvp: boolean; maxDmg: number }) {
  const { data: champs } = useChampions();
  const champImg = champs?.byId?.[p.championName]?.image;
  const kdaColor = p.kda >= 5 ? 'text-yellow-400' : p.kda >= 3 ? 'text-green-400' : p.kda >= 2 ? 'text-blue-300' : 'text-gray-300';

  return (
    <div className={`flex items-center gap-3 py-2 px-3 rounded-lg transition ${isMvp ? 'bg-yellow-900/20 border border-yellow-600/30' : 'hover:bg-white/5'}`}>
      <div className="relative flex-shrink-0">
        {champImg ? (
          <img src={champImg} alt={p.championName} className="w-10 h-10 rounded-lg border border-white/[0.08]" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-white/[0.05] flex items-center justify-center text-xs">{p.championName[0]}</div>
        )}
        <span className="absolute -bottom-1 -right-1 text-xs bg-black/80 border border-white/15 rounded px-1 leading-tight">{p.champLevel}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-white truncate">{p.summonerName}</span>
          {isMvp && <Badge className="bg-yellow-700/50 text-yellow-300 text-xs px-1.5 py-0 h-4">MVP</Badge>}
        </div>
        <span className="text-xs text-gray-500">{p.championName}</span>
      </div>
      <div className="text-center w-20">
        <div className="text-sm font-bold">
          <span className="text-white">{p.kills}</span>
          <span className="text-gray-600">/</span>
          <span className="text-red-400">{p.deaths}</span>
          <span className="text-gray-600">/</span>
          <span className="text-gray-300">{p.assists}</span>
        </div>
        <div className={`text-xs font-semibold ${kdaColor}`}>{p.kda.toFixed(2)} KDA</div>
      </div>
      <div className="text-center w-16 hidden md:block">
        <div className="text-sm text-gray-200">{p.cs}</div>
        <div className="text-xs text-gray-500">{p.csPerMin}/min</div>
      </div>
      <div className="w-24 hidden lg:block">
        <div className="text-xs text-gray-400 mb-1">{(p.totalDamageDealt/1000).toFixed(1)}k dmg</div>
        <StatBar value={p.totalDamageDealt} max={maxDmg} color="bg-orange-500" />
      </div>
      <div className="text-center w-12 hidden md:block">
        <Eye className="h-3 w-3 text-gray-500 mx-auto mb-0.5" />
        <div className="text-xs text-gray-400">{p.visionScore}</div>
      </div>
      {p.pentaKills > 0 && (
        <Badge className="bg-purple-900/50 border-purple-500/50 text-purple-300 text-xs">PENTA</Badge>
      )}
    </div>
  );
}

function StatsTable({ team, label, color, maxDmg }: {
  team: MatchParticipant[]; label: string; color: 'blue' | 'red'; maxDmg: number;
}) {
  const sorted = [...team].sort((a, b) => (b.kills + b.assists) - (a.kills + a.assists));
  const mvpIdx = sorted.findIndex(p => p === sorted[0]);
  const borderColor = color === 'blue' ? 'border-blue-600/30' : 'border-red-600/30';
  const labelColor  = color === 'blue' ? 'text-blue-300' : 'text-red-300';
  const totalKills = team.reduce((s, p) => s + p.kills, 0);
  const avgKDA = (team.reduce((s, p) => s + p.kda, 0) / team.length).toFixed(2);

  return (
    <div className={`rounded-xl border ${borderColor} bg-white/[0.02] backdrop-blur-md overflow-hidden`}>
      <div className={`px-4 py-2 ${color === 'blue' ? 'bg-blue-950/40' : 'bg-red-950/40'} flex items-center justify-between`}>
        <span className={`font-bold text-sm ${labelColor} flex items-center gap-2`}>
          <Swords className="h-4 w-4" />{label}
        </span>
        <div className="flex gap-4 text-xs text-gray-400">
          <span>{totalKills} kills</span>
          <span>{avgKDA} avg KDA</span>
        </div>
      </div>
      {/* Column headers */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-white/[0.06] text-xs text-gray-500">
        <div className="w-10 flex-shrink-0"></div>
        <div className="flex-1">Jugador</div>
        <div className="w-20 text-center">K/D/A</div>
        <div className="w-16 text-center hidden md:block">CS</div>
        <div className="w-24 hidden lg:block">Daño</div>
        <div className="w-12 text-center hidden md:block">Visión</div>
      </div>
      <div className="divide-y divide-white/[0.05]">
        {sorted.map((p, i) => (
          <PlayerRow key={i} p={p} isMvp={i === mvpIdx} maxDmg={maxDmg} />
        ))}
      </div>
    </div>
  );
}

interface TournamentMatchStatsProps {
  tournamentId: string;
  match: BracketMatch;
  isActive: boolean;
}

export function TournamentMatchStats({ tournamentId, match, isActive }: TournamentMatchStatsProps) {
  const [stats, setStats]       = useState<MatchStats | null>(null);
  const [loading, setLoading]   = useState(false);
  const [polling, setPolling]   = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await axiosInstance.get(`/api/tournaments/${tournamentId}/matches/${match.id}/stats`);
      setStats(data);
      setPolling(false); // Tenemos datos, detener polling
    } catch (err: any) {
      if (err?.response?.status !== 404) console.error('[MatchStats]', err.message);
      // 404 = aún no hay gameId, seguir polling
    } finally {
      if (!silent) setLoading(false);
      setLastCheck(new Date());
    }
  }, [tournamentId, match.id]);

  // Auto-poll cada 30s cuando el partido está activo y no tenemos stats
  useEffect(() => {
    if (!isActive || stats || match.matchStatus === 'pending') return;
    if (!match.gameId && match.matchStatus !== 'active') return;

    setPolling(true);
    const interval = setInterval(() => fetchStats(true), 30_000);
    fetchStats(true);
    return () => { clearInterval(interval); setPolling(false); };
  }, [isActive, match.matchStatus, match.gameId, stats, fetchStats]);

  if (!match.team1 || !match.team2 || match.matchStatus === 'pending') return null;

  const maxDmg = stats
    ? Math.max(...[...stats.blueTeam, ...stats.redTeam].map(p => p.totalDamageDealt))
    : 0;

  const fmtDuration = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

  return (
    <div className="mt-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Zap className="h-4 w-4 text-purple-400" />
          <span className="text-gray-300">Stats del partido</span>
          {polling && (
            <span className="flex items-center gap-1 text-xs text-yellow-400 animate-pulse">
              <RefreshCw className="h-3 w-3 animate-spin" />actualizando...
            </span>
          )}
          {lastCheck && !polling && (
            <span className="text-xs text-gray-600">
              · {lastCheck.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' })}
            </span>
          )}
        </div>
        <Button
          size="sm" variant="ghost"
          onClick={() => fetchStats()}
          disabled={loading}
          className="h-7 text-xs text-gray-400 hover:text-white"
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {loading && !stats && (
        <div className="text-center py-8 text-gray-500 text-sm animate-pulse">
          Cargando stats...
        </div>
      )}

      {!stats && !loading && match.matchStatus === 'active' && (
        <div className="text-center py-6 text-gray-600 text-xs bg-white/[0.03] rounded-xl border border-white/[0.08]">
          <Swords className="h-6 w-6 mx-auto mb-2 text-gray-700" />
          <p>Partida en curso. Las stats aparecerán automáticamente cuando termine.</p>
          {match.code && (
            <p className="mt-1 text-purple-400">
              Código activo: <span className="font-mono">{match.code}</span>
            </p>
          )}
        </div>
      )}

      {stats && (
        <>
          {/* Game summary */}
          <div className="flex items-center justify-center gap-6 py-3 bg-white/[0.03] rounded-xl border border-white/[0.08] text-sm">
            <div className={`font-bold text-lg ${stats.winner === 'blue' ? 'text-blue-300' : 'text-gray-500'}`}>
              {match.team1}
              {stats.winner === 'blue' && <Trophy className="h-4 w-4 inline ml-1 text-yellow-400" />}
            </div>
            <div className="text-center text-gray-500">
              <div className="text-xs">VS</div>
              <div className="text-xs text-gray-600">{fmtDuration(stats.gameDuration)}</div>
            </div>
            <div className={`font-bold text-lg ${stats.winner === 'red' ? 'text-red-300' : 'text-gray-500'}`}>
              {match.team2}
              {stats.winner === 'red' && <Trophy className="h-4 w-4 inline ml-1 text-yellow-400" />}
            </div>
          </div>

          {/* Team stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <StatsTable
              team={stats.blueTeam}
              label={`${match.team1} (${stats.winner === 'blue' ? 'Victoria' : 'Derrota'})`}
              color="blue"
              maxDmg={maxDmg}
            />
            <StatsTable
              team={stats.redTeam}
              label={`${match.team2} (${stats.winner === 'red' ? 'Victoria' : 'Derrota'})`}
              color="red"
              maxDmg={maxDmg}
            />
          </div>

          {/* Team aggregates */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              { team: stats.blueTeam, label: match.team1, color: 'blue' },
              { team: stats.redTeam,  label: match.team2, color: 'red' },
            ].map(({ team, label, color }) => {
              const totalDmg   = team.reduce((s,p) => s+p.totalDamageDealt, 0);
              const totalGold  = team.reduce((s,p) => s+p.goldEarned, 0);
              const totalVis   = team.reduce((s,p) => s+p.visionScore, 0);
              const totalKills = team.reduce((s,p) => s+p.kills, 0);
              const bc = color === 'blue' ? 'border-blue-700/30 bg-blue-950/20' : 'border-red-700/30 bg-red-950/20';
              const lc = color === 'blue' ? 'text-blue-300' : 'text-red-300';
              return (
                <div key={label} className={`rounded-lg border ${bc} p-3 space-y-1.5`}>
                  <div className={`font-semibold ${lc} mb-2`}>{label}</div>
                  {[
                    { icon: <Swords className="h-3 w-3" />, label: 'Kills totales', value: totalKills },
                    { icon: <Target className="h-3 w-3" />, label: 'Daño total',    value: `${(totalDmg/1000).toFixed(1)}k` },
                    { icon: <Shield className="h-3 w-3" />, label: 'Oro total',     value: `${(totalGold/1000).toFixed(1)}k` },
                    { icon: <Eye className="h-3 w-3" />,    label: 'Visión',        value: totalVis },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between text-gray-400">
                      <span className="flex items-center gap-1">{row.icon}{row.label}</span>
                      <span className="text-white font-medium">{row.value}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
