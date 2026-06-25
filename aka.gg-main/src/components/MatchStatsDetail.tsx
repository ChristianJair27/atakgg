// src/components/MatchStatsDetail.tsx — Full tournament match stats view
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Sword, Shield, Eye, Coins, Clock, Trophy, Zap, Skull, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dd, spellIcon, keystoneIcon, runePathIcon, fmtDuration, fmtNumber } from '@/lib/dataDragon';
import type { MatchStatsResponse, ParticipantStats, TeamObjectives } from '@/types/riot-match';

// ─── Confetti ─────────────────────────────────────────────────────────────────

function Confetti() {
  const colors = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#ffffff'];
  const pieces = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    color: colors[i % colors.length],
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 2}s`,
    duration: `${2 + Math.random() * 2}s`,
    size: `${6 + Math.random() * 8}px`,
    rotate: `${Math.random() * 720}deg`,
  }));

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map(p => (
        <div
          key={p.id}
          className="absolute top-0"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            animation: `confettiFall ${p.duration} ${p.delay} ease-in forwards`,
          }}
        />
      ))}
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ─── Icon slots ───────────────────────────────────────────────────────────────

function ImgSlot({
  src, alt, className, fallback,
}: { src: string; alt: string; className?: string; fallback?: string }) {
  const [err, setErr] = useState(false);
  if (err || !src) {
    return (
      <div className={cn('bg-white/5 border border-white/10 flex items-center justify-center', className)}>
        <span className="text-[8px] text-white/20">{fallback ?? '?'}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setErr(true)}
      loading="lazy"
    />
  );
}

function ChampIcon({ name, level, size = 'md' }: { name: string; level?: number; size?: 'sm' | 'md' | 'lg' }) {
  const cls = { sm: 'w-7 h-7 rounded-lg', md: 'w-10 h-10 rounded-xl', lg: 'w-14 h-14 rounded-2xl' }[size];
  return (
    <div className="relative shrink-0">
      <ImgSlot src={dd.champion(name)} alt={name} className={cn(cls, 'object-cover border border-white/10')} fallback={name[0]} />
      {level != null && (
        <span className="absolute -bottom-1 -right-1 text-[9px] font-black text-white bg-black/80 px-1 rounded border border-white/10">
          {level}
        </span>
      )}
    </div>
  );
}

function ItemSlot({ id }: { id: number }) {
  if (!id) return <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-dashed border-white/10" />;
  return <ImgSlot src={dd.item(id)} alt={`Item ${id}`} className="w-7 h-7 rounded-lg object-cover border border-white/10" fallback="?" />;
}

function SpellSlot({ id }: { id: number }) {
  return <ImgSlot src={spellIcon(id)} alt={`Spell ${id}`} className="w-6 h-6 rounded" fallback="?" />;
}

function RuneSlot({ keystoneId, secondaryStyleId }: { keystoneId: number; secondaryStyleId: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <ImgSlot src={keystoneIcon(keystoneId)} alt="Keystone" className="w-6 h-6 rounded-full" fallback="K" />
      <ImgSlot src={runePathIcon(secondaryStyleId)} alt="Secondary" className="w-5 h-5 rounded-full mx-auto" fallback="S" />
    </div>
  );
}

// ─── KDA label ────────────────────────────────────────────────────────────────

function KdaText({ k, d, a }: { k: number; d: number; a: number }) {
  return (
    <span className="text-sm font-bold tabular-nums">
      <span className="text-white">{k}</span>
      <span className="text-white/40">/</span>
      <span className="text-red-400">{d}</span>
      <span className="text-white/40">/</span>
      <span className="text-white">{a}</span>
    </span>
  );
}

// ─── Highlight badges ─────────────────────────────────────────────────────────

function MultikillBadge({ p }: { p: ParticipantStats }) {
  if (p.pentaKills > 0)  return <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-red-500 text-white">PENTAKILL</span>;
  if (p.quadraKills > 0) return <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-purple-500 text-white">QUADRA</span>;
  if (p.tripleKills > 0) return <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-blue-500 text-white">TRIPLE</span>;
  if (p.doubleKills > 0) return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-600 text-white">DOBLE</span>;
  return null;
}

// ─── Participant row ──────────────────────────────────────────────────────────

function ParticipantRow({
  p, maxDmg, isFirst,
}: { p: ParticipantStats; maxDmg: number; isFirst: boolean }) {
  const kdaVal = p.deaths === 0 ? (p.kills + p.assists).toFixed(1) : ((p.kills + p.assists) / p.deaths).toFixed(2);
  const dmgPct = maxDmg > 0 ? Math.round((p.totalDamageDealt / maxDmg) * 100) : 0;

  return (
    <tr className={cn(
      'border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]',
      isFirst && 'bg-yellow-500/5'
    )}>
      {/* Champion */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <ChampIcon name={p.championName} level={p.champLevel} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-white truncate max-w-[80px]">
                {p.summonerName || 'Invocador'}
              </span>
              {p.firstBloodKill && (
                <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-300 border border-red-500/20">
                  1ª Sangre
                </span>
              )}
              <MultikillBadge p={p} />
            </div>
            <span className="text-[10px] text-white/30">{p.teamPosition || (p as any).role || ''}</span>
          </div>
        </div>
      </td>
      {/* Spells + Runes */}
      <td className="px-2 py-2.5">
        <div className="flex items-center gap-1">
          <div className="flex flex-col gap-0.5">
            <SpellSlot id={p.summoner1Id} />
            <SpellSlot id={p.summoner2Id} />
          </div>
          <RuneSlot keystoneId={p.perks.keystoneId} secondaryStyleId={p.perks.secondaryStyleId} />
        </div>
      </td>
      {/* KDA */}
      <td className="px-3 py-2.5 text-center">
        <KdaText k={p.kills} d={p.deaths} a={p.assists} />
        <div className="text-[10px] text-white/30 mt-0.5">{kdaVal} KDA</div>
      </td>
      {/* CS */}
      <td className="px-3 py-2.5 text-center">
        <div className="text-sm font-semibold text-white">{p.cs}</div>
        <div className="text-[10px] text-white/30">{p.csPerMin}/min</div>
      </td>
      {/* Damage */}
      <td className="px-3 py-2.5 min-w-[110px]">
        <div className="text-xs font-semibold text-white mb-1">{fmtNumber(p.totalDamageDealt)}</div>
        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-600 to-orange-500 transition-all duration-700"
            style={{ width: `${dmgPct}%` }}
          />
        </div>
        <div className="flex gap-1 mt-0.5">
          {[
            { v: p.physicalDamage, color: 'bg-orange-400' },
            { v: p.magicDamage,    color: 'bg-blue-400' },
            { v: p.trueDamage,     color: 'bg-white' },
          ].map(({ v, color }, i) => (
            <div key={i} className="h-0.5 rounded-full" style={{ width: `${maxDmg > 0 ? Math.round((v/maxDmg)*60) : 0}px` }}>
              <div className={cn('h-full rounded-full', color)} />
            </div>
          ))}
        </div>
      </td>
      {/* Gold */}
      <td className="px-3 py-2.5 text-center">
        <div className="text-xs font-semibold text-yellow-300">{fmtNumber(p.goldEarned)}</div>
      </td>
      {/* Vision */}
      <td className="px-3 py-2.5 text-center">
        <div className="text-xs text-white/60">{p.visionScore}</div>
        <div className="text-[10px] text-white/20">{p.wardsPlaced}P/{p.wardsKilled}K</div>
      </td>
      {/* Items */}
      <td className="px-3 py-2.5">
        <div className="flex gap-0.5 flex-wrap">
          {p.items.slice(0, 7).map((id, i) => (
            <ItemSlot key={i} id={id} />
          ))}
        </div>
      </td>
    </tr>
  );
}

// ─── Team table ───────────────────────────────────────────────────────────────

function TeamTable({
  participants, teamColor, teamName,
}: { participants: ParticipantStats[]; teamColor: 'blue' | 'red'; teamName?: string }) {
  const maxDmg = Math.max(...participants.map(p => p.totalDamageDealt), 1);
  const totalKills  = participants.reduce((s, p) => s + p.kills, 0);
  const totalGold   = participants.reduce((s, p) => s + p.goldEarned, 0);
  const totalDmg    = participants.reduce((s, p) => s + p.totalDamageDealt, 0);
  const colorClass  = teamColor === 'blue' ? 'text-blue-400 border-blue-500/30' : 'text-red-400 border-red-500/30';
  const headerBg    = teamColor === 'blue' ? 'bg-blue-500/5' : 'bg-red-500/5';
  const winBadge    = participants[0]?.win;
  const mvp         = [...participants].sort((a, b) =>
    (b.kills + b.assists - b.deaths) - (a.kills + a.assists - a.deaths)
  )[0];

  const HEADERS = ['Campeón', 'Hechizos', 'KDA', 'CS', 'Daño', 'Oro', 'Visión', 'Ítems'];

  return (
    <div className={cn('rounded-[24px] overflow-hidden mb-4 bg-white/[0.015] shadow-[0_18px_50px_-22px_rgba(0,0,0,0.8)]')}>
      {/* Team header */}
      <div className={cn('flex items-center justify-between px-4 py-2.5', headerBg)}>
        <div className="flex items-center gap-3">
          <span className={cn('text-xs font-black uppercase tracking-widest', colorClass)}>
            {teamName ?? (teamColor === 'blue' ? 'Equipo Azul' : 'Equipo Rojo')}
          </span>
          {winBadge ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-green-500/20 text-green-300 border border-green-500/30">
              <Trophy className="h-2.5 w-2.5" /> VICTORIA
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-white/40 border border-white/10">
              DERROTA
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-white/40">
          <span className="flex items-center gap-1"><Skull className="h-3 w-3" />{totalKills}</span>
          <span className="flex items-center gap-1"><Coins className="h-3 w-3 text-yellow-400" />{fmtNumber(totalGold)}</span>
          <span className="flex items-center gap-1"><Sword className="h-3 w-3 text-orange-400" />{fmtNumber(totalDmg)}</span>
          {mvp && <span className="flex items-center gap-1 text-yellow-300"><Star className="h-3 w-3" />MVP: {mvp.summonerName}</span>}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/[0.05]">
              {HEADERS.map(h => (
                <th key={h} className="px-3 py-2 text-[10px] text-white/25 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {participants.map((p, i) => (
              <ParticipantRow key={i} p={p} maxDmg={maxDmg} isFirst={p === mvp} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Charts ───────────────────────────────────────────────────────────────────

const CHART_STYLE = {
  background: 'transparent',
  fontSize: 10,
  fill: 'rgba(255,255,255,0.4)',
};

function DamageChart({ blueTeam, redTeam }: { blueTeam: ParticipantStats[]; redTeam: ParticipantStats[] }) {
  const data = [...blueTeam, ...redTeam].map(p => ({
    name: p.summonerName || p.championName,
    champ: p.championName,
    dmg: p.totalDamageDealt,
    physical: p.physicalDamage,
    magic: p.magicDamage,
    true: p.trueDamage,
    team: p.teamId === 100 ? 'blue' : 'red',
  }));

  return (
    <div>
      <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Daño a Campeones</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical" margin={{ left: 60, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
          <XAxis type="number" tick={CHART_STYLE} axisLine={false} tickLine={false} tickFormatter={v => fmtNumber(v)} />
          <YAxis type="category" dataKey="name" tick={{ ...CHART_STYLE, fontSize: 9 }} axisLine={false} tickLine={false} width={58} />
          <RechartTooltip
            contentStyle={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
            labelStyle={{ color: 'white', fontSize: 11 }}
            itemStyle={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}
            formatter={(v: number) => [fmtNumber(v)]}
          />
          <Bar dataKey="physical" stackId="a" fill="#f97316" name="Físico" radius={0} />
          <Bar dataKey="magic"    stackId="a" fill="#3b82f6" name="Mágico" radius={0} />
          <Bar dataKey="true"     stackId="a" fill="#ffffff" name="Verdadero" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2 justify-center">
        {[['#f97316','Físico'],['#3b82f6','Mágico'],['#ffffff','Verdadero']].map(([c,l]) => (
          <span key={l} className="flex items-center gap-1 text-[10px] text-white/40">
            <span className="w-2 h-2 rounded-sm" style={{ background: c }} />
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

function GoldChart({ blueTeam, redTeam }: { blueTeam: ParticipantStats[]; redTeam: ParticipantStats[] }) {
  const data = [...blueTeam, ...redTeam].map(p => ({
    name: p.summonerName || p.championName,
    gold: p.goldEarned,
    fill: p.teamId === 100 ? '#3b82f6' : '#ef4444',
  }));

  return (
    <div>
      <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Oro Ganado</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical" margin={{ left: 60, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
          <XAxis type="number" tick={CHART_STYLE} axisLine={false} tickLine={false} tickFormatter={v => fmtNumber(v)} />
          <YAxis type="category" dataKey="name" tick={{ ...CHART_STYLE, fontSize: 9 }} axisLine={false} tickLine={false} width={58} />
          <RechartTooltip
            contentStyle={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
            labelStyle={{ color: 'white', fontSize: 11 }}
            itemStyle={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}
            formatter={(v: number) => [fmtNumber(v), 'Oro']}
          />
          <Bar dataKey="gold" name="Oro" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ObjectivesChart({
  blue, red,
}: { blue: TeamObjectives; red: TeamObjectives }) {
  const objectives = [
    { name: 'Dragones', blue: blue.dragonKills,   red: red.dragonKills,   icon: '🐉' },
    { name: 'Barón',    blue: blue.baronKills,    red: red.baronKills,    icon: '🐲' },
    { name: 'Torres',   blue: blue.towerKills,    red: red.towerKills,    icon: '🗼' },
    { name: 'Heraldo',  blue: blue.riftHeraldKills, red: red.riftHeraldKills, icon: '👁️' },
    { name: 'Inhibs',  blue: blue.inhibitorKills, red: red.inhibitorKills, icon: '💎' },
  ];

  return (
    <div>
      <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Objetivos</p>
      <div className="space-y-2.5">
        {objectives.map(o => {
          const total = o.blue + o.red || 1;
          const bluePct = Math.round((o.blue / total) * 100);
          const redPct  = 100 - bluePct;
          return (
            <div key={o.name}>
              <div className="flex justify-between text-[10px] text-white/40 mb-1">
                <span className="text-blue-400 font-bold">{o.blue}</span>
                <span>{o.icon} {o.name}</span>
                <span className="text-red-400 font-bold">{o.red}</span>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden bg-white/5">
                <div className="bg-blue-500 transition-all" style={{ width: `${o.blue === 0 && o.red === 0 ? 50 : bluePct}%` }} />
                <div className="bg-red-500  transition-all" style={{ width: `${o.blue === 0 && o.red === 0 ? 50 : redPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── In-progress placeholder ──────────────────────────────────────────────────

function InProgressView({ bracketMatchId }: { bracketMatchId: string }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [1, 0.7, 1] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mb-6"
      >
        <Zap className="h-7 w-7 text-green-400" />
      </motion.div>
      <p className="text-green-400 font-bold text-lg mb-1">Partida en Curso</p>
      <p className="text-white/30 text-sm mb-4">{bracketMatchId}</p>
      <div className="flex items-center gap-2 text-white/40 text-sm">
        <Clock className="h-4 w-4" />
        <span>Actualizando en {35 - (seconds % 35)}s...</span>
      </div>
      <p className="text-xs text-white/20 mt-3">Los stats aparecerán automáticamente al finalizar</p>
    </div>
  );
}

// ─── No gameId state ──────────────────────────────────────────────────────────

function NoGameView() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Sword className="h-12 w-12 text-white/10 mb-4" />
      <p className="text-white/30 text-sm">Sin partida vinculada</p>
      <p className="text-xs text-white/20 mt-1">Activa el partido y el sistema detectará el gameId automáticamente</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface MatchStatsDetailProps {
  stats: MatchStatsResponse | null;
  loading: boolean;
  error?: string | null;
  bracketMatchId: string;
  gameId?: number;
  team1?: string | null;
  team2?: string | null;
}

const TABS_STATS = [
  { key: 'tabla',    label: 'Tabla' },
  { key: 'daño',     label: 'Daño' },
  { key: 'oro',      label: 'Oro' },
  { key: 'objetivos', label: 'Objetivos' },
];

export function MatchStatsDetail({
  stats, loading, error, bracketMatchId, gameId, team1, team2,
}: MatchStatsDetailProps) {
  const [tab, setTab] = useState('tabla');
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiShown = useRef(false);

  useEffect(() => {
    if (stats?.isComplete && !confettiShown.current) {
      confettiShown.current = true;
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
    }
  }, [stats?.isComplete]);

  if (!gameId) return <NoGameView />;
  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="h-8 w-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        <p className="text-white/30 text-sm animate-pulse">Obteniendo stats de Riot...</p>
      </div>
    );
  }
  if (error && !stats) {
    return (
      <div className="text-center py-14 text-white/30 text-sm">
        <p>⚠ {error}</p>
      </div>
    );
  }
  if (!stats) {
    return <InProgressView bracketMatchId={bracketMatchId} />;
  }

  const { blueTeam, redTeam, blueObjectives, redObjectives, gameDuration, gameMode, winner, isComplete } = stats;

  const blueTeamName = team1 ?? 'Equipo Azul';
  const redTeamName  = team2 ?? 'Equipo Rojo';
  const winnerName   = winner === 'blue' ? blueTeamName : winner === 'red' ? redTeamName : null;

  return (
    <div className="text-white">
      {showConfetti && <Confetti />}

      {/* Match header */}
      <motion.div
        initial={{ opacity: 0, y: 22, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
        className="rounded-[28px] bg-gradient-to-b from-white/[0.06] to-white/[0.01] p-5 mb-5 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.07)]">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* Blue team */}
          <div className={cn(
            'flex-1 text-center sm:text-right',
            winner === 'blue' && 'text-blue-300',
            winner === 'red' && 'opacity-50',
          )}>
            <p className="font-black text-lg truncate">{blueTeamName}</p>
            <p className="text-xs text-white/30 uppercase tracking-widest">Equipo Azul</p>
            {winner === 'blue' && (
              <motion.p initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                className="text-blue-400 text-sm font-black mt-1">🏆 VICTORIA</motion.p>
            )}
          </div>

          {/* Center score / timer */}
          <div className="text-center shrink-0">
            <div className="flex items-center gap-3 justify-center">
              <span className="text-3xl font-black text-white">
                {blueTeam.reduce((s, p) => s + p.kills, 0)}
              </span>
              <span className="text-white/20 text-sm">vs</span>
              <span className="text-3xl font-black text-white">
                {redTeam.reduce((s, p) => s + p.kills, 0)}
              </span>
            </div>
            <div className="flex items-center gap-2 justify-center mt-1 text-xs text-white/30">
              <Clock className="h-3 w-3" />
              <span>{fmtDuration(gameDuration)}</span>
              <span>·</span>
              <span>{gameMode}</span>
            </div>
            {!isComplete && (
              <motion.div
                animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
                className="mt-1.5 flex items-center gap-1 justify-center text-green-400 text-xs font-bold"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                EN VIVO
              </motion.div>
            )}
          </div>

          {/* Red team */}
          <div className={cn(
            'flex-1 text-center sm:text-left',
            winner === 'red' && 'text-red-300',
            winner === 'blue' && 'opacity-50',
          )}>
            <p className="font-black text-lg truncate">{redTeamName}</p>
            <p className="text-xs text-white/30 uppercase tracking-widest">Equipo Rojo</p>
            {winner === 'red' && (
              <motion.p initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                className="text-red-400 text-sm font-black mt-1">🏆 VICTORIA</motion.p>
            )}
          </div>
        </div>

        {/* Quick team objectives */}
        <div className="grid grid-cols-5 gap-2 mt-4 pt-4 border-t border-white/[0.05]">
          {[
            { label: 'Dragones', blueV: blueObjectives.dragonKills, redV: redObjectives.dragonKills, icon: '🐉' },
            { label: 'Barón',    blueV: blueObjectives.baronKills,  redV: redObjectives.baronKills,  icon: '🐲' },
            { label: 'Torres',   blueV: blueObjectives.towerKills,  redV: redObjectives.towerKills,  icon: '🗼' },
            { label: 'Heraldo',  blueV: blueObjectives.riftHeraldKills, redV: redObjectives.riftHeraldKills, icon: '👁️' },
            { label: 'Inhibs',   blueV: blueObjectives.inhibitorKills, redV: redObjectives.inhibitorKills, icon: '💎' },
          ].map(o => (
            <div key={o.label} className="text-center">
              <div className="text-base mb-0.5">{o.icon}</div>
              <div className="flex items-center justify-center gap-1.5 text-sm font-bold">
                <span className="text-blue-400">{o.blueV}</span>
                <span className="text-white/20">—</span>
                <span className="text-red-400">{o.redV}</span>
              </div>
              <div className="text-[9px] text-white/25 uppercase">{o.label}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/[0.06] mb-5 overflow-x-auto">
        {TABS_STATS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all border-b-2 -mb-px',
              tab === t.key ? 'border-white text-white' : 'border-transparent text-white/30 hover:text-white/60'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Tabla */}
        {tab === 'tabla' && (
          <motion.div key="tabla" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <TeamTable participants={blueTeam} teamColor="blue" teamName={blueTeamName} />
            <TeamTable participants={redTeam}  teamColor="red"  teamName={redTeamName}  />
          </motion.div>
        )}

        {/* Daño */}
        {tab === 'daño' && (
          <motion.div key="damage" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-[24px] bg-white/[0.02] p-5 shadow-[0_18px_50px_-22px_rgba(0,0,0,0.8)]">
            <DamageChart blueTeam={blueTeam} redTeam={redTeam} />
          </motion.div>
        )}

        {/* Oro */}
        {tab === 'oro' && (
          <motion.div key="gold" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-[24px] bg-white/[0.02] p-5 shadow-[0_18px_50px_-22px_rgba(0,0,0,0.8)]">
            <GoldChart blueTeam={blueTeam} redTeam={redTeam} />
          </motion.div>
        )}

        {/* Objetivos */}
        {tab === 'objetivos' && (
          <motion.div key="objectives" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-[24px] bg-white/[0.02] p-5 shadow-[0_18px_50px_-22px_rgba(0,0,0,0.8)]">
            <ObjectivesChart blue={blueObjectives} red={redObjectives} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top performers */}
      {isComplete && (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="mt-5 rounded-[24px] bg-gradient-to-b from-yellow-500/[0.10] to-transparent p-5 shadow-[0_18px_50px_-22px_rgba(0,0,0,0.8)]"
        >
          <p className="text-xs text-yellow-400/60 uppercase tracking-widest font-bold mb-4">⭐ Top Performers</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Mayor Daño',  value: [...blueTeam, ...redTeam].sort((a,b) => b.totalDamageDealt - a.totalDamageDealt)[0] },
              { label: 'Mayor KDA',   value: [...blueTeam, ...redTeam].sort((a,b) => b.kda - a.kda)[0] },
              { label: 'Mayor Oro',   value: [...blueTeam, ...redTeam].sort((a,b) => b.goldEarned - a.goldEarned)[0] },
              { label: 'Mejor Visión',value: [...blueTeam, ...redTeam].sort((a,b) => b.visionScore - a.visionScore)[0] },
            ].map(({ label, value: p }) => p && (
              <motion.div key={label}
                whileHover={{ y: -5, scale: 1.04 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="rounded-2xl bg-white/[0.04] p-3 text-center shadow-[0_12px_34px_-18px_rgba(0,0,0,0.85)]">
                <ChampIcon name={p.championName} size="sm" />
                <p className="text-xs font-semibold text-white mt-2 truncate">{p.summonerName}</p>
                <p className="text-[10px] text-yellow-400 mt-0.5">{label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
