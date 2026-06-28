// src/components/TournamentBracket.tsx — glass redesign with connector lines
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Copy, Check, Trophy, Swords, Zap, BarChart2, X, Crown, Radio } from 'lucide-react';
import { TournamentMatchStats } from '@/components/TournamentMatchStats';

// Team identity bubble — gives every team a consistent icon in the bracket.
// ATAK palette only (red family + warm neutrals), never purple/blue/cyan.
const TEAM_GRADIENTS = [
  'from-red-700 to-red-900', 'from-rose-800 to-red-950',
  'from-zinc-700 to-zinc-900', 'from-stone-700 to-stone-900', 'from-amber-700 to-amber-900',
];
function TeamAvatar({ name, size = 22, dimmed = false }: { name?: string | null; size?: number; dimmed?: boolean }) {
  if (!name || name === 'BYE') {
    return (
      <div style={{ width: size, height: size }}
        className="rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-[10px] text-gray-600 flex-shrink-0">–</div>
    );
  }
  const g = TEAM_GRADIENTS[name.charCodeAt(0) % TEAM_GRADIENTS.length];
  return (
    <div style={{ width: size, height: size }}
      className={`rounded-lg bg-gradient-to-br ${g} border border-white/15 flex items-center justify-center text-[11px] font-black text-white flex-shrink-0 ${dimmed ? 'opacity-50 grayscale' : ''}`}>
      {name[0]?.toUpperCase()}
    </div>
  );
}

type MatchStatus = 'pending' | 'ready' | 'active' | 'complete';

interface BracketMatch {
  id: string; round: number; matchNumber: number;
  team1: string | null; team2: string | null; winner: string | null;
  code: string | null; matchStatus: MatchStatus; score1?: number; score2?: number;
  gameId?: number; gameRegion?: string;
}

interface TournamentBracketProps {
  bracket: BracketMatch[];
  maxRound: number;
  isActive: boolean;
  tournamentId: string;
  canViewCodes?: boolean;
  canManage?: boolean;
  onActivateMatch: (matchId: string) => Promise<string | null>;
  onReportResult: (matchId: string, winner: string, score1: number, score2: number) => void;
  reportingMatch: string | null;
}

// Layout constants — the connector math relies on a common row unit so each
// next-round match lines up with the midpoint of its two feeder matches.
const CARD_W = 208;   // px — match card width
const STUB   = 22;    // px — horizontal connector stub on each side
const COL_W  = CARD_W + STUB * 2;
const ROW    = 128;   // px — vertical space allotted per first-round match
const LINE   = 'rgba(255,255,255,0.14)';

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button onClick={copy} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-300 transition w-full" title="Copiar código">
      {copied ? <Check className="h-3 w-3 text-green-400 flex-shrink-0" /> : <Copy className="h-3 w-3 flex-shrink-0" />}
      <span className="font-mono truncate">{code}</span>
    </button>
  );
}

function getRoundLabel(round: number, maxRound: number): string {
  const diff = maxRound - round;
  if (diff === 0) return 'Gran Final';
  if (diff === 1) return 'Semifinal';
  if (diff === 2) return 'Cuartos de Final';
  if (diff === 3) return 'Octavos de Final';
  return `Ronda ${round}`;
}

function ReportForm({ match, onReport, loading }: {
  match: BracketMatch; onReport: (winner: string, s1: number, s2: number) => void; loading: boolean;
}) {
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [winner, setWinner] = useState('');
  if (!match.team1 || !match.team2) return null;
  const numCls = 'w-12 h-7 text-xs text-center px-1 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white outline-none focus:border-red-500/50';
  return (
    <div className="mt-2 p-2.5 rounded-xl bg-black/40 border border-white/[0.08] space-y-2">
      <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Resultado</p>
      <div className="flex gap-2 items-center justify-center">
        <input type="number" placeholder="0" value={score1} onChange={e => setScore1(e.target.value)} className={numCls} min={0} />
        <span className="text-gray-600 text-xs">vs</span>
        <input type="number" placeholder="0" value={score2} onChange={e => setScore2(e.target.value)} className={numCls} min={0} />
      </div>
      <div className="grid grid-cols-1 gap-1">
        {[match.team1, match.team2].map(team => (
          <button key={team} onClick={() => setWinner(team!)}
            className={`text-xs px-2 py-1 rounded-lg border transition truncate ${
              winner === team ? 'bg-green-600/80 border-green-500 text-white' : 'border-white/10 text-gray-200 hover:border-green-600/60'
            }`}>
            {team} gana
          </button>
        ))}
      </div>
      <Button size="sm" onClick={() => onReport(winner, Number(score1) || 0, Number(score2) || 0)}
        disabled={loading || !winner} className="gradient-red border-0 h-7 text-xs w-full hover:opacity-90">
        {loading ? 'Guardando...' : 'Confirmar'}
      </Button>
    </div>
  );
}

function MatchCard({ match, isActive, isReporting, onActivate, onReport, onToggleStats, statsOpen, canViewCodes, canManage }: {
  match: BracketMatch; isActive: boolean; isReporting: boolean;
  onActivate: () => Promise<string | null>;
  onReport: (winner: string, s1: number, s2: number) => void;
  onToggleStats: () => void; statsOpen: boolean;
  canViewCodes?: boolean; canManage?: boolean;
}) {
  const [showReport, setShowReport] = useState(false);
  const [activating, setActivating] = useState(false);

  const handleActivate = async () => { setActivating(true); await onActivate(); setActivating(false); };

  const teamCls = (team: string | null) =>
    `px-2 py-1.5 text-sm rounded-lg flex items-center gap-2 transition ${
      team === match.winner   ? 'bg-green-500/15 text-green-300 font-bold border border-green-500/30' :
      !team || team === 'BYE' ? 'bg-white/[0.02] text-gray-600 italic border border-transparent' :
      match.winner            ? 'bg-white/[0.02] text-gray-500 border border-transparent' :
                                'bg-white/[0.05] text-gray-100 border border-white/[0.06]'
    }`;

  const isEmpty = !match.team1 && !match.team2;
  const canShowStats = !!match.gameId || match.matchStatus === 'complete';

  const TeamRow = ({ team, score }: { team: string | null; score?: number }) => {
    const isWin = !!team && team === match.winner;
    const isLoss = !!match.winner && !isWin && !!team && team !== 'BYE';
    return (
      <div className={teamCls(team)}>
        <TeamAvatar name={team} dimmed={isLoss} />
        <span className={`truncate flex-1 ${isLoss ? 'line-through' : ''}`}>{team || 'Por definir'}</span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {score !== undefined && match.winner && <span className="text-xs opacity-60 tabular-nums">{score}</span>}
          {isWin && <Crown className="h-3.5 w-3.5 text-yellow-400" />}
        </span>
      </div>
    );
  };

  return (
    <div className={`rounded-xl overflow-hidden backdrop-blur-md transition ${
      match.matchStatus === 'complete' ? 'border border-green-500/25 bg-green-500/[0.04]' :
      match.matchStatus === 'active'   ? 'border border-red-500/40 bg-red-500/[0.06] shadow-[0_0_18px_rgba(225,36,46,0.14)]' :
      match.matchStatus === 'ready'    ? 'border border-white/[0.10] bg-white/[0.03]' :
                                         'border border-white/[0.05] bg-white/[0.01] opacity-50'
    }`} style={{ width: CARD_W }}>
      {!isEmpty && (
        <div className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-center flex items-center justify-center gap-1.5 ${
          match.matchStatus === 'complete' ? 'bg-green-500/10 text-green-400' :
          match.matchStatus === 'active'   ? 'bg-red-500/15 text-red-300' :
          match.matchStatus === 'ready'    ? 'bg-white/[0.04] text-gray-400' :
                                             'bg-white/[0.02] text-gray-600'
        }`}>
          {match.matchStatus === 'active' && <Radio className="h-2.5 w-2.5 animate-pulse" />}
          {match.matchStatus === 'complete' ? 'Completado' :
           match.matchStatus === 'active'   ? 'En curso' :
           match.matchStatus === 'ready'    ? 'Por iniciar' : 'Esperando'}
        </div>
      )}

      <div className="p-2 space-y-1">
        <TeamRow team={match.team1} score={match.score1} />
        <div className="flex items-center justify-center -my-0.5">
          <span className="text-[9px] font-black text-gray-700 tracking-widest">VS</span>
          <Swords className="h-3 w-3 text-gray-700 ml-1" />
        </div>
        <TeamRow team={match.team2} score={match.score2} />
      </div>

      {canViewCodes && match.code && (
        <div className="px-2 pb-1.5 pt-0.5 border-t border-white/[0.06]">
          <CopyCode code={match.code} />
        </div>
      )}
      {!canViewCodes && (match.matchStatus === 'active' || match.matchStatus === 'ready') && !isEmpty && (
        <div className="px-2 pb-1.5 pt-0.5 border-t border-white/[0.06]">
          <p className="text-[10px] text-gray-600 text-center py-1">Código solo para jugadores inscritos</p>
        </div>
      )}

      {canManage && isActive && !isEmpty && match.matchStatus !== 'complete' && match.team1 !== 'BYE' && match.team2 !== 'BYE' && (
        <div className="px-2 pb-2 space-y-1">
          {match.matchStatus === 'ready' && !match.code && (
            <Button size="sm" onClick={handleActivate} disabled={activating}
              className="w-full h-7 text-xs bg-red-600 hover:bg-red-500 border-0">
              {activating ? '...' : <><Zap className="h-3 w-3 mr-1" />Obtener código</>}
            </Button>
          )}
          {(match.matchStatus === 'active' || match.matchStatus === 'ready') && (
            <>
              <button onClick={() => setShowReport(!showReport)}
                className="text-xs text-red-400 hover:text-red-300 w-full text-center transition py-0.5">
                {showReport ? 'Cancelar' : '+ Reportar resultado'}
              </button>
              {showReport && (
                <ReportForm match={match} loading={isReporting}
                  onReport={(w, s1, s2) => { onReport(w, s1, s2); setShowReport(false); }} />
              )}
            </>
          )}
        </div>
      )}

      {canShowStats && (
        <button onClick={onToggleStats}
          className={`w-full flex items-center justify-center gap-1.5 text-xs py-1.5 border-t border-white/[0.06] transition ${
            statsOpen ? 'text-red-200 bg-red-500/10' : 'text-red-300/80 hover:text-red-200 hover:bg-red-500/[0.06]'
          }`}>
          <BarChart2 className="h-3 w-3" />
          {statsOpen ? 'Ocultar stats' : 'Ver stats'}
        </button>
      )}
    </div>
  );
}

// Connector lines drawn at the right edge of a (non-final) match toward the
// midpoint shared with its pair partner. vSpan is half the center-to-center
// distance between paired matches, so the elbow lands on the next match center.
function Connector({ matchIndex, vSpan }: { matchIndex: number; vSpan: number }) {
  const isTop = matchIndex % 2 === 0;
  return (
    <>
      {/* horizontal stub out of this match */}
      <div className="absolute top-1/2 -translate-y-1/2 h-px" style={{ right: 0, width: STUB, background: LINE }} />
      {/* vertical run toward the pair midpoint */}
      <div className="absolute w-px" style={{ right: 0, height: vSpan, background: LINE, top: isTop ? '50%' : 'auto', bottom: isTop ? 'auto' : '50%' }} />
      {/* horizontal stub from the midpoint into the next round (drawn once, by the top match) */}
      {isTop && (
        <div className="absolute h-px" style={{ right: -STUB, width: STUB, background: LINE, top: `calc(50% + ${vSpan}px)` }} />
      )}
    </>
  );
}

export function TournamentBracket({
  bracket, maxRound, isActive, tournamentId, canViewCodes = false, canManage = false,
  onActivateMatch, onReportResult, reportingMatch,
}: TournamentBracketProps) {
  const [expandedStats, setExpandedStats] = useState<string | null>(null);
  const rounds = Array.from({ length: maxRound }, (_, i) => i + 1);
  const champion = bracket.find(m => m.round === maxRound)?.winner;
  const expandedMatch = bracket.find(m => m.id === expandedStats) ?? null;

  // Body height drives the justify-around distribution and the connector math.
  const firstRoundCount = bracket.filter(m => m.round === 1).length || 1;
  const bodyHeight = Math.max(firstRoundCount * ROW, ROW);

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-md p-5">
      <div className="flex items-center gap-2 mb-5">
        <Trophy className="h-5 w-5 text-red-400" />
        <h2 className="text-xl font-bold text-white">Bracket del torneo</h2>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="min-w-max">
          {/* Round headers */}
          <div className="flex">
            {rounds.map(round => (
              <div key={round} className="text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider pb-3"
                style={{ width: COL_W }}>
                {getRoundLabel(round, maxRound)}
              </div>
            ))}
            {champion && <div style={{ width: 168 }} className="text-center text-[11px] font-semibold text-yellow-500/70 uppercase tracking-wider pb-3">Campeón</div>}
          </div>

          {/* Bracket body — equal-height columns distribute matches evenly */}
          <div className="flex" style={{ height: bodyHeight }}>
            {rounds.map(round => {
              const matchesInRound = bracket.filter(m => m.round === round);
              const vSpan = bodyHeight / (2 * matchesInRound.length);
              return (
                <div key={round} className="flex flex-col justify-around" style={{ width: COL_W }}>
                  {matchesInRound.map((match, mi) => (
                    <motion.div key={match.id} className="relative flex items-center justify-center" style={{ width: COL_W }}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: (round - 1) * 0.08 + mi * 0.04, ease: [0.22, 1, 0.36, 1] }}>
                      <MatchCard
                        match={match} isActive={isActive}
                        isReporting={reportingMatch === match.id}
                        onActivate={() => onActivateMatch(match.id)}
                        onReport={(w, s1, s2) => onReportResult(match.id, w, s1, s2)}
                        statsOpen={expandedStats === match.id}
                        onToggleStats={() => setExpandedStats(expandedStats === match.id ? null : match.id)}
                        canViewCodes={canViewCodes}
                        canManage={canManage}
                      />
                      {round < maxRound && <Connector matchIndex={mi} vSpan={vSpan} />}
                    </motion.div>
                  ))}
                </div>
              );
            })}

            {/* Champion */}
            {champion && (
              <div className="flex flex-col justify-center" style={{ width: 168 }}>
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: maxRound * 0.1, ease: [0.22, 1, 0.36, 1] }}
                  className="p-4 rounded-2xl text-center border border-yellow-500/40 bg-gradient-to-b from-yellow-500/15 to-yellow-900/10 shadow-[0_0_24px_rgba(234,179,8,0.15)]">
                  <Crown className="h-9 w-9 text-yellow-400 mx-auto mb-2" />
                  <div className="flex justify-center mb-2"><TeamAvatar name={champion} size={40} /></div>
                  <p className="text-[10px] text-yellow-400/70 uppercase tracking-wider">Campeón</p>
                  <p className="text-lg font-bold text-yellow-300 mt-1 break-words">{champion}</p>
                </motion.div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expanded stats — full width below the bracket so the grid stays aligned */}
      {expandedMatch && (
        <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/30 p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-white">
              {expandedMatch.team1} <span className="text-gray-600">vs</span> {expandedMatch.team2}
            </p>
            <button onClick={() => setExpandedStats(null)}
              className="p-1 rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.08] transition">
              <X className="h-4 w-4" />
            </button>
          </div>
          <TournamentMatchStats tournamentId={tournamentId} match={expandedMatch} isActive={isActive} />
        </div>
      )}
    </div>
  );
}
