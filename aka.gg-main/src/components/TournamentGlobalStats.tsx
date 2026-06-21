// src/components/TournamentGlobalStats.tsx — Aggregated tournament-wide stats view
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Trophy, Sword, Coins, Eye, Star,
  ChevronUp, ChevronDown, Zap, Activity, Users, RefreshCw, Skull,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { dd, fmtNumber } from '@/lib/dataDragon';
import type { TournamentGlobalStats, PlayerAggregate, GlobalSortKey } from '@/types/tournament-global-stats';

// ─── Mini image helper ────────────────────────────────────────────────────────

function ImgSlot({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [err, setErr] = useState(false);
  if (err || !src) return <div className={cn('bg-white/5 border border-white/10', className)} />;
  return <img src={src} alt={alt} className={cn('object-cover', className)} onError={() => setErr(true)} loading="lazy" />;
}

function ChampIcon({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const cls = { sm: 'w-8 h-8 rounded-lg', md: 'w-10 h-10 rounded-xl', lg: 'w-16 h-16 rounded-2xl' }[size];
  return <ImgSlot src={dd.champion(name || 'Garen')} alt={name} className={cn(cls, 'border border-white/10')} />;
}

// ─── Podium ───────────────────────────────────────────────────────────────────

const PODIUM_CATS: { key: GlobalSortKey; label: string; fmt: (v: number) => string; icon: React.ReactNode }[] = [
  { key: 'avgKda',          label: 'KDA',      fmt: v => v.toFixed(2),              icon: <Sword    className="h-3 w-3" /> },
  { key: 'totalKills',      label: 'Kills',    fmt: v => String(v),                 icon: <Skull    className="h-3 w-3" /> },
  { key: 'avgGoldPerMin',   label: 'Oro/min',  fmt: v => fmtNumber(v),              icon: <Coins    className="h-3 w-3" /> },
  { key: 'avgDamagePerMin', label: 'Daño/min', fmt: v => fmtNumber(Math.round(v)),  icon: <Zap      className="h-3 w-3" /> },
  { key: 'avgCsPerMin',     label: 'CS/min',   fmt: v => v.toFixed(1),              icon: <Activity className="h-3 w-3" /> },
  { key: 'avgVisionPerMin', label: 'Visión',   fmt: v => v.toFixed(2),              icon: <Eye      className="h-3 w-3" /> },
];

function Podium({ players, sortKey }: { players: PlayerAggregate[]; sortKey: GlobalSortKey }) {
  const cat = PODIUM_CATS.find(c => c.key === sortKey)!;
  const top3 = [...players].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number)).slice(0, 3);
  if (top3.length === 0) return null;

  // Display order: [2nd, 1st, 3rd] for classic podium layout
  const displayOrder = [top3[1], top3[0], top3[2]].filter(Boolean);

  const platformH: Record<number, number> = { 1: 96, 2: 68, 3: 52 };
  const rankOf = (p: PlayerAggregate) => top3.indexOf(p) + 1;

  return (
    <div className="flex items-end justify-center gap-4 py-2">
      {displayOrder.map(p => {
        const rank = rankOf(p);
        const h    = platformH[rank] ?? 52;
        const val  = cat.fmt(p[sortKey] as number);

        const medalBg  = rank === 1 ? 'bg-yellow-400'   : rank === 2 ? 'bg-gray-300'    : 'bg-amber-700';
        const ringCls  = rank === 1 ? 'ring-yellow-400/50' : rank === 2 ? 'ring-white/20' : 'ring-amber-700/30';
        const platBg   = rank === 1 ? 'bg-yellow-500/15 border-yellow-500/30'
                       : rank === 2 ? 'bg-white/10 border-white/20'
                       :              'bg-amber-800/15 border-amber-700/30';
        const valColor = rank === 1 ? 'text-yellow-300' : 'text-white/60';
        const scale    = rank === 1 ? 'scale-110' : '';

        return (
          <motion.div
            key={p.summonerName}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (3 - rank) * 0.08 }}
            className="flex flex-col items-center gap-2"
          >
            <div className={cn('flex flex-col items-center gap-1.5 transition-transform', scale)}>
              <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-black', medalBg)}>
                {rank}
              </span>
              <div className={cn('rounded-xl overflow-hidden ring-2 shrink-0', ringCls, rank === 1 ? 'w-14 h-14' : 'w-10 h-10')}>
                <ChampIcon name={p.mostPlayedChamp} size={rank === 1 ? 'lg' : 'md'} />
              </div>
              <div className="text-center max-w-[90px]">
                <p className={cn('font-bold text-white truncate', rank === 1 ? 'text-sm' : 'text-xs')}>
                  {p.summonerName}
                </p>
                <p className={cn('font-black', rank === 1 ? 'text-lg' : 'text-sm', valColor)}>{val}</p>
              </div>
            </div>
            <div
              className={cn('w-20 rounded-t-lg border flex items-center justify-center', platBg)}
              style={{ height: h }}
            >
              <span className={cn('text-2xl font-black', rank === 1 ? 'text-yellow-400/60' : 'text-white/20')}>
                #{rank}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Sortable table ───────────────────────────────────────────────────────────

type SortDir = 'desc' | 'asc';

const TABLE_COLS: { key: GlobalSortKey | 'player'; label: string; sortable: boolean }[] = [
  { key: 'player',          label: 'Jugador',   sortable: false },
  { key: 'gamesPlayed',     label: 'PJ',        sortable: true },
  { key: 'winrate',         label: 'WR%',       sortable: true },
  { key: 'avgKda',          label: 'KDA',       sortable: true },
  { key: 'totalKills',      label: 'K',         sortable: true },
  { key: 'totalDeaths',     label: 'D',         sortable: true },
  { key: 'totalAssists',    label: 'A',         sortable: true },
  { key: 'avgGoldPerMin',   label: 'G/min',     sortable: true },
  { key: 'avgDamagePerMin', label: 'Dmg/min',   sortable: true },
  { key: 'avgCsPerMin',     label: 'CS/min',    sortable: true },
  { key: 'avgVisionPerMin', label: 'Vis/min',   sortable: true },
  { key: 'pentaKills',      label: 'Pentas',    sortable: true },
];

function SortableTable({ players }: { players: PlayerAggregate[] }) {
  const [sortKey, setSortKey] = useState<GlobalSortKey>('avgKda');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sorted = useMemo(() => {
    const mult = sortDir === 'desc' ? -1 : 1;
    return [...players].sort((a, b) => mult * ((a[sortKey] as number) - (b[sortKey] as number)));
  }, [players, sortKey, sortDir]);

  const onSort = (key: GlobalSortKey) => {
    if (key === sortKey) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-white/[0.06] bg-white/[0.02]">
            {TABLE_COLS.map(col => (
              <th
                key={col.key}
                onClick={col.sortable ? () => onSort(col.key as GlobalSortKey) : undefined}
                className={cn(
                  'px-3 py-2.5 text-[10px] uppercase tracking-wider whitespace-nowrap select-none',
                  col.key === 'player' ? 'text-left' : 'text-center',
                  col.sortable ? 'cursor-pointer hover:text-white transition-colors' : '',
                  sortKey === col.key ? 'text-white' : 'text-white/25',
                )}
              >
                <span className={cn('flex items-center gap-0.5', col.key !== 'player' && 'justify-center')}>
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    sortDir === 'desc'
                      ? <ChevronDown className="h-3 w-3" />
                      : <ChevronUp   className="h-3 w-3" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => (
            <tr
              key={p.summonerName + p.tagLine}
              className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors"
            >
              {/* Player + champ pool */}
              <td className="px-3 py-2.5 min-w-[150px]">
                <div className="flex items-center gap-2">
                  <ChampIcon name={p.mostPlayedChamp} size="sm" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate max-w-[110px]">{p.summonerName}</p>
                    <p className="text-[9px] text-white/25 truncate max-w-[110px]">
                      {p.championPool.slice(0, 4).join(' · ')}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-2.5 text-center text-xs text-white/50">{p.gamesPlayed}</td>
              <td className="px-3 py-2.5 text-center">
                <span className={cn(
                  'text-xs font-bold',
                  p.winrate >= 60 ? 'text-green-400' :
                  p.winrate >= 50 ? 'text-white/70'  : 'text-red-400/70',
                )}>
                  {p.winrate}%
                </span>
              </td>
              <td className="px-3 py-2.5 text-center">
                <span className={cn(
                  'text-xs font-bold',
                  p.avgKda >= 4  ? 'text-yellow-300' :
                  p.avgKda >= 2.5 ? 'text-white'     : 'text-white/50',
                )}>
                  {p.avgKda.toFixed(2)}
                </span>
              </td>
              <td className="px-3 py-2.5 text-center text-xs text-white/60">{p.totalKills}</td>
              <td className="px-3 py-2.5 text-center text-xs text-red-400/60">{p.totalDeaths}</td>
              <td className="px-3 py-2.5 text-center text-xs text-white/60">{p.totalAssists}</td>
              <td className="px-3 py-2.5 text-center text-xs text-yellow-300/70">{p.avgGoldPerMin.toFixed(1)}</td>
              <td className="px-3 py-2.5 text-center text-xs text-orange-300/70">{fmtNumber(Math.round(p.avgDamagePerMin))}</td>
              <td className="px-3 py-2.5 text-center text-xs text-white/60">{p.avgCsPerMin.toFixed(1)}</td>
              <td className="px-3 py-2.5 text-center text-xs text-cyan-300/60">{p.avgVisionPerMin.toFixed(2)}</td>
              <td className="px-3 py-2.5 text-center">
                {p.pentaKills > 0
                  ? <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-red-500 text-white">{p.pentaKills}</span>
                  : <span className="text-xs text-white/20">—</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Charts ───────────────────────────────────────────────────────────────────

const CHART_STYLE = { background: 'transparent', fontSize: 10, fill: 'rgba(255,255,255,0.4)' };

type ChartMetric = 'avgDamagePerMin' | 'avgGoldPerMin' | 'avgKda';
const CHART_LABELS: Record<ChartMetric, { label: string; color: string }> = {
  avgDamagePerMin: { label: 'Daño/min',     color: '#f97316' },
  avgGoldPerMin:   { label: 'Oro/min',      color: '#eab308' },
  avgKda:          { label: 'KDA Promedio', color: '#22c55e' },
};

function TopPlayersChart({ players }: { players: PlayerAggregate[] }) {
  const [metric, setMetric] = useState<ChartMetric>('avgDamagePerMin');

  const data = useMemo(() =>
    [...players]
      .sort((a, b) => (b[metric] as number) - (a[metric] as number))
      .slice(0, 8)
      .map(p => ({
        name:  p.summonerName,
        value: Math.round((p[metric] as number) * 10) / 10,
      })),
    [players, metric]
  );

  const { label, color } = CHART_LABELS[metric];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-white/40 uppercase tracking-widest">Top 8 Jugadores</p>
        <div className="flex gap-1">
          {(Object.entries(CHART_LABELS) as [ChartMetric, typeof CHART_LABELS[ChartMetric]][]).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setMetric(k)}
              className={cn(
                'px-2 py-1 rounded-lg text-[10px] font-semibold transition-all',
                metric === k ? 'bg-white text-black' : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/70',
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={metric} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={data} layout="vertical" margin={{ left: 70, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" tick={CHART_STYLE} axisLine={false} tickLine={false} tickFormatter={v => fmtNumber(v)} />
              <YAxis type="category" dataKey="name" tick={{ ...CHART_STYLE, fontSize: 9 }} axisLine={false} tickLine={false} width={66} />
              <RechartTooltip
                contentStyle={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                labelStyle={{ color: 'white', fontSize: 11 }}
                itemStyle={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}
                formatter={(v: number) => [fmtNumber(v), label]}
              />
              <Bar dataKey="value" name={label} radius={[0, 4, 4, 0]}>
                {data.map((_, i) => <Cell key={i} fill={color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface Props {
  data: TournamentGlobalStats;
  loading?: boolean;
  onRefresh?: () => void;
}

export function TournamentGlobalStats({ data, loading, onRefresh }: Props) {
  const [podiumCat, setPodiumCat] = useState<GlobalSortKey>('avgKda');

  const { players, matchesCompleted } = data;

  const mostPlayedChamp = useMemo(() => {
    const counts = new Map<string, number>();
    players.forEach(p => {
      p.championPool.forEach(c => counts.set(c, (counts.get(c) ?? 0) + 1));
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }, [players]);

  if (matchesCompleted === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] py-20 text-center">
        <Trophy className="h-14 w-14 mx-auto mb-4 text-white/10" />
        <p className="text-white/30 text-sm">Aún no hay partidas completadas en este torneo</p>
        <p className="text-xs text-white/15 mt-1">Los stats globales aparecerán cuando termine la primera partida</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 shrink-0">
            <Trophy className="h-4 w-4 text-yellow-400" />
          </div>
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Partidas</p>
            <p className="text-xl font-black text-white">{matchesCompleted}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 shrink-0">
            <Users className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Jugadores</p>
            <p className="text-xl font-black text-white">{players.length}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center gap-3">
          {mostPlayedChamp && (
            <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-white/10">
              <ImgSlot src={dd.champion(mostPlayedChamp)} alt={mostPlayedChamp} className="w-10 h-10" />
            </div>
          )}
          {!mostPlayedChamp && (
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 shrink-0">
              <Star className="h-4 w-4 text-purple-400" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Más jugado</p>
            <p className="text-sm font-bold text-white truncate">{mostPlayedChamp ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* Podium */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <p className="text-xs text-white/40 uppercase tracking-widest font-bold">
            🏆 Top 3 — {PODIUM_CATS.find(c => c.key === podiumCat)?.label}
          </p>
          <div className="flex flex-wrap gap-1">
            {PODIUM_CATS.map(cat => (
              <button
                key={cat.key}
                onClick={() => setPodiumCat(cat.key)}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all',
                  podiumCat === cat.key
                    ? 'bg-white text-black'
                    : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/70',
                )}
              >
                {cat.icon}{cat.label}
              </button>
            ))}
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={podiumCat}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Podium players={players} sortKey={podiumCat} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <TopPlayersChart players={players} />
      </div>

      {/* Sortable table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Tabla Completa</p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white/40
                hover:text-white hover:bg-white/[0.06] transition-all"
            >
              <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
              Actualizar
            </button>
          )}
        </div>
        <SortableTable players={players} />
      </div>
    </div>
  );
}
