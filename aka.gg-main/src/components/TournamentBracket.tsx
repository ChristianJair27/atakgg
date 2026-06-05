// src/components/TournamentBracket.tsx
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Check, Trophy, Swords, Zap, BarChart2 } from 'lucide-react';
import { TournamentMatchStats } from '@/components/TournamentMatchStats';

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
  onActivateMatch: (matchId: string) => Promise<string | null>;
  onReportResult: (matchId: string, winner: string, score1: number, score2: number) => void;
  reportingMatch: string | null;
}

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button onClick={copy} className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition mt-1 max-w-full" title="Copiar código">
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
  match: BracketMatch;
  onReport: (winner: string, s1: number, s2: number) => void;
  loading: boolean;
}) {
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [winner, setWinner] = useState('');
  if (!match.team1 || !match.team2) return null;
  return (
    <div className="mt-2 p-2 bg-black/40 rounded border border-gray-700 space-y-2">
      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Resultado</p>
      <div className="flex gap-2 items-center">
        <Input type="number" placeholder="0" value={score1} onChange={e => setScore1(e.target.value)}
          className="w-14 h-7 text-xs bg-gray-800 border-gray-700 text-center px-1" min={0} />
        <span className="text-gray-600 text-xs">vs</span>
        <Input type="number" placeholder="0" value={score2} onChange={e => setScore2(e.target.value)}
          className="w-14 h-7 text-xs bg-gray-800 border-gray-700 text-center px-1" min={0} />
      </div>
      <div className="flex gap-1 flex-wrap">
        {[match.team1, match.team2].map(team => (
          <button key={team} onClick={() => setWinner(team!)}
            className={`text-xs px-2 py-1 rounded border transition ${winner === team ? 'bg-green-700 border-green-500 text-white' : 'border-gray-700 text-gray-300 hover:border-green-600'}`}>
            {team} gana
          </button>
        ))}
      </div>
      <Button size="sm" onClick={() => onReport(winner, Number(score1) || 0, Number(score2) || 0)}
        disabled={loading || !winner} className="bg-red-700 hover:bg-red-800 h-7 text-xs w-full">
        {loading ? 'Guardando...' : 'Confirmar'}
      </Button>
    </div>
  );
}

function MatchCard({ match, isActive, isReporting, onActivate, onReport }: {
  match: BracketMatch; isActive: boolean; isReporting: boolean;
  onActivate: () => Promise<string | null>;
  onReport: (winner: string, s1: number, s2: number) => void;
}) {
  const [showReport, setShowReport] = useState(false);
  const [activating, setActivating] = useState(false);

  const handleActivate = async () => {
    setActivating(true);
    await onActivate();
    setActivating(false);
  };

  const teamCls = (team: string | null) =>
    `px-2 py-1.5 text-sm rounded flex items-center justify-between gap-1 ${
      team === match.winner         ? 'bg-green-800/50 text-green-300 font-bold' :
      !team || team === 'BYE'       ? 'bg-gray-800/20 text-gray-600 italic' :
      match.winner                  ? 'bg-gray-800/30 text-gray-500 line-through' :
                                      'bg-gray-800/50 text-gray-200'
    }`;

  const isEmpty = !match.team1 && !match.team2;

  return (
    <div className={`border rounded-lg overflow-hidden w-52 transition ${
      match.matchStatus === 'complete' ? 'border-green-800/50 bg-green-950/10' :
      match.matchStatus === 'active'   ? 'border-purple-700/60 bg-purple-950/10' :
      match.matchStatus === 'ready'    ? 'border-red-800/40 bg-gray-900/70' :
                                         'border-gray-800/30 bg-gray-900/20 opacity-40'
    }`}>
      {/* Status indicator */}
      {!isEmpty && (
        <div className={`px-2 py-0.5 text-xs font-semibold text-center ${
          match.matchStatus === 'complete' ? 'bg-green-900/50 text-green-400' :
          match.matchStatus === 'active'   ? 'bg-purple-900/50 text-purple-300' :
          match.matchStatus === 'ready'    ? 'bg-gray-800 text-gray-400' :
                                             'bg-gray-900 text-gray-600'
        }`}>
          {match.matchStatus === 'complete' ? '✓ Completado' :
           match.matchStatus === 'active'   ? '● En curso' :
           match.matchStatus === 'ready'    ? 'Por iniciar' : 'Esperando'}
        </div>
      )}

      <div className="p-2 space-y-1">
        <div className={teamCls(match.team1)}>
          <span className="truncate">{match.team1 || 'Por definir'}</span>
          {match.winner === match.team1 && <Trophy className="h-3 w-3 text-yellow-400 flex-shrink-0" />}
          {match.score1 !== undefined && match.winner && <span className="text-xs opacity-60 flex-shrink-0">{match.score1}</span>}
        </div>
        <div className="flex items-center justify-center"><Swords className="h-3 w-3 text-gray-700" /></div>
        <div className={teamCls(match.team2)}>
          <span className="truncate">{match.team2 || 'Por definir'}</span>
          {match.winner === match.team2 && <Trophy className="h-3 w-3 text-yellow-400 flex-shrink-0" />}
          {match.score2 !== undefined && match.winner && <span className="text-xs opacity-60 flex-shrink-0">{match.score2}</span>}
        </div>
      </div>

      {/* Code */}
      {match.code && (
        <div className="px-2 pb-1 border-t border-gray-800/50">
          <CopyCode code={match.code} />
        </div>
      )}

      {/* Actions */}
      {isActive && !isEmpty && match.matchStatus !== 'complete' && match.team1 !== 'BYE' && match.team2 !== 'BYE' && (
        <div className="px-2 pb-2 space-y-1">
          {/* Activate (get code) */}
          {match.matchStatus === 'ready' && !match.code && (
            <Button size="sm" onClick={handleActivate} disabled={activating}
              className="w-full h-7 text-xs bg-purple-700 hover:bg-purple-800">
              {activating ? '...' : <><Zap className="h-3 w-3 mr-1" />Obtener código</>}
            </Button>
          )}
          {/* Report result */}
          {(match.matchStatus === 'active' || match.matchStatus === 'ready') && (
            <>
              <button onClick={() => setShowReport(!showReport)}
                className="text-xs text-red-400 hover:text-red-300 w-full text-center transition">
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
    </div>
  );
}

export function TournamentBracket({
  bracket, maxRound, isActive, tournamentId, onActivateMatch, onReportResult, reportingMatch,
}: TournamentBracketProps) {
  const [expandedStats, setExpandedStats] = useState<string | null>(null);
  const rounds = Array.from({ length: maxRound }, (_, i) => i + 1);
  const champion = bracket.find(m => m.round === maxRound)?.winner;

  return (
    <Card className="bg-gray-900/80 border-red-800/40">
      <CardHeader>
        <CardTitle className="text-2xl text-red-400 flex items-center gap-2">
          <Trophy className="h-6 w-6" />
          Bracket del Torneo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-6 min-w-max items-start">
            {rounds.map(round => {
              const matchesInRound = bracket.filter(m => m.round === round);
              return (
                <div key={round} className="flex flex-col">
                  <h3 className="text-xs font-semibold text-gray-400 text-center uppercase tracking-wider mb-3">
                    {getRoundLabel(round, maxRound)}
                  </h3>
                  <div className="flex flex-col" style={{ gap: `${Math.pow(2, round - 1) * 12}px` }}>
                    {matchesInRound.map(match => (
                      <div key={match.id}>
                        <MatchCard
                          match={match}
                          isActive={isActive}
                          isReporting={reportingMatch === match.id}
                          onActivate={() => onActivateMatch(match.id)}
                          onReport={(w, s1, s2) => onReportResult(match.id, w, s1, s2)}
                        />
                        {/* Stats toggle — visible si hay gameId o partida completada */}
                        {(match.gameId || match.matchStatus === 'complete') && (
                          <button
                            onClick={() => setExpandedStats(expandedStats === match.id ? null : match.id)}
                            className="mt-1 w-52 flex items-center justify-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition py-1 border border-purple-800/30 rounded-lg bg-purple-950/20 hover:bg-purple-950/40"
                          >
                            <BarChart2 className="h-3 w-3" />
                            {expandedStats === match.id ? 'Ocultar stats' : 'Ver stats'}
                          </button>
                        )}
                        {expandedStats === match.id && (
                          <div className="mt-2 w-[600px] max-w-[90vw]">
                            <TournamentMatchStats
                              tournamentId={tournamentId}
                              match={match}
                              isActive={isActive}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Champion */}
            {champion && (
              <div className="flex flex-col items-center justify-start pt-8 px-3">
                <div className="p-4 bg-gradient-to-b from-yellow-600/30 to-yellow-900/20 border border-yellow-600/50 rounded-xl text-center">
                  <Trophy className="h-10 w-10 text-yellow-400 mx-auto mb-2" />
                  <p className="text-xs text-yellow-400/70 uppercase tracking-wider">Campeón</p>
                  <p className="text-xl font-bold text-yellow-300 mt-1">{champion}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
