// src/pages/TournamentDetailsPage.tsx — glass/space redesign
import { useParams, Link } from 'react-router-dom';
import {
  Trophy, Calendar, Users, ArrowLeft, Copy, Check, Zap,
  BarChart2, GitBranch, List, Play, RefreshCw, UserCheck,
  Lock, Shield, Activity, Clock,
} from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import gsap from 'gsap';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useTournament,
  useRegistrations,
  useCheckin,
  useCloseRegistration,
  useStartTournament,
  useGenerateCodes,
  useActivateMatch,
  useReportResult,
  useSyncGames,
  type Registration as RegistrationType,
  type Tournament as TournamentType,
} from '@/hooks/queries/tournaments';
import { useAuth } from '@/features/auth/useAuth';
import { TournamentBracket } from '@/components/TournamentBracket';
import { MatchStatsDetail } from '@/components/MatchStatsDetail';
import { TournamentGlobalStats } from '@/components/TournamentGlobalStats';
import { useMatchStats } from '@/hooks/useMatchStats';
import { useTournamentGlobalStats } from '@/hooks/useTournamentGlobalStats';
import { Toast } from '@/components/Toast';
import { toast } from '@/components/ui/sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

// Confirmation dialog wrapping any trigger button (replaces native confirm()).
function ConfirmButton({ trigger, title, description, onConfirm }: {
  trigger: React.ReactNode; title: string; description: string; onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="bg-[#0a0a0c]/95 backdrop-blur-xl border border-white/[0.08] text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-gray-400">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-white">Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="gradient-red border-0 hover:opacity-90">Confirmar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type TournamentPhase = 'registration' | 'checkin' | 'active' | 'complete';

// Shapes live in the query-hook module (single source of truth); alias here.
type Tournament = TournamentType;
type Registration = RegistrationType;

// ─── Glass card ───────────────────────────────────────────────────────────────
function GlassCard({ children, className='' }: { children:React.ReactNode; className?:string }) {
  return (
    <div className={`rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md ${className}`}>
      {children}
    </div>
  );
}

// ─── Phase stepper ────────────────────────────────────────────────────────────
const PHASES: { key: TournamentPhase; label: string }[] = [
  { key:'registration', label:'Inscripciones' },
  { key:'checkin',      label:'Check-in' },
  { key:'active',       label:'En Curso' },
  { key:'complete',     label:'Finalizado' },
];
const PHASE_ORDER: Record<TournamentPhase, number> = { registration:0, checkin:1, active:2, complete:3 };

function PhaseStepper({ phase }: { phase: TournamentPhase }) {
  const current = PHASE_ORDER[phase];
  return (
    <div className="flex items-center justify-center gap-0 mb-10 overflow-x-auto pb-2">
      {PHASES.map((p, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <div key={p.key} className="flex items-center">
            <div className="flex flex-col items-center gap-2">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold
                border-2 transition-all duration-500 ${
                  done   ? 'bg-red-600 border-red-600 text-white shadow-[0_0_12px_rgba(239,68,68,0.5)]' :
                  active ? 'bg-white border-white text-black shadow-[0_0_16px_rgba(255,255,255,0.3)]' :
                           'bg-transparent border-gray-800 text-gray-700'
                }`}>
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-xs whitespace-nowrap font-medium ${
                active ? 'text-white' : done ? 'text-red-400' : 'text-gray-700'
              }`}>{p.label}</span>
            </div>
            {i < PHASES.length - 1 && (
              <div className={`h-px w-12 sm:w-20 mb-5 mx-2 transition-all duration-500 ${
                i < current ? 'bg-gradient-to-r from-red-600 to-red-700' : 'bg-gray-800'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  return (
    <button onClick={copy} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.08] transition-all" title="Copiar">
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// ─── Check-in panel ───────────────────────────────────────────────────────────
function CheckinPanel({ tournamentId }: { tournamentId:string }) {
  const [teamName, setTeamName]       = useState('');
  const [captainRiotId, setCaptain]   = useState('');
  const [success, setSuccess]         = useState('');
  const checkin = useCheckin(tournamentId);
  const loading = checkin.isPending;

  const handle = () => {
    if (!teamName) return;
    checkin.mutate(
      { teamName, captainRiotId },
      {
        onSuccess: (data) => {
          setSuccess(`✓ Check-in confirmado! ${data.checkedIn}/${data.total} equipos listos.`);
          toast.success('Check-in confirmado', { description: `${data.checkedIn}/${data.total} equipos listos` });
        },
      },
    );
  };

  if (success) return (
    <div className="mb-6 p-4 rounded-xl border border-green-500/30 bg-green-500/10 text-green-300 text-sm">{success}</div>
  );

  return (
    <GlassCard className="border-yellow-500/20 bg-yellow-500/5 mb-6 p-5">
      <div className="flex items-center gap-2 text-yellow-300 font-semibold mb-1">
        <UserCheck className="h-5 w-5" />
        Confirmar participación (Check-in)
      </div>
      <p className="text-gray-400 text-sm mb-4">Confirma antes de que inicie el torneo.</p>
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-44">
          <label htmlFor="checkin-team" className="text-xs text-gray-500 block mb-1">Nombre del equipo</label>
          <input id="checkin-team" value={teamName} onChange={e=>setTeamName(e.target.value)}
            placeholder="Exactamente como te inscribiste"
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white
              placeholder:text-gray-600 outline-none focus:border-yellow-500/50 transition-colors" />
        </div>
        <div className="flex-1 min-w-44">
          <label htmlFor="checkin-captain" className="text-xs text-gray-500 block mb-1">Riot ID del capitán</label>
          <input id="checkin-captain" value={captainRiotId} onChange={e=>setCaptain(e.target.value)} placeholder="Player#LA1"
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white
              placeholder:text-gray-600 outline-none focus:border-yellow-500/50 transition-colors" />
        </div>
        <button onClick={handle} disabled={loading || !teamName}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-yellow-600 hover:bg-yellow-500
            text-black font-bold text-sm transition-all disabled:opacity-40">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
          Check-in
        </button>
      </div>
    </GlassCard>
  );
}

// ─── Admin panel ──────────────────────────────────────────────────────────────
function AdminPanel({ tournament, registrations }: {
  tournament:Tournament; registrations:Registration[];
}) {
  const closeReg = useCloseRegistration(tournament.id);
  const start    = useStartTournament(tournament.id);
  const codes    = useGenerateCodes(tournament.id);
  const sync     = useSyncGames(tournament.id);
  const checkedIn = registrations.filter(r=>r.checkedIn).length;

  return (
    <GlassCard className="border-purple-500/20 bg-purple-500/5 mb-6 p-5">
      <p className="text-xs text-purple-400 uppercase tracking-widest font-semibold mb-4 flex items-center gap-2">
        <Shield className="h-4 w-4" /> Panel de Administrador
      </p>
      <div className="flex flex-wrap gap-2">
        {tournament.phase === 'registration' && (
          <>
            <button disabled={closeReg.isPending||registrations.length<2}
              onClick={()=>closeReg.mutate()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-700 hover:bg-orange-600
                text-white text-sm font-semibold transition-all disabled:opacity-40">
              {closeReg.isPending?<RefreshCw className="h-4 w-4 animate-spin"/>:<Lock className="h-4 w-4"/>}
              Cerrar inscripciones ({registrations.length})
            </button>
            {registrations.length >= 2 && (
              <ConfirmButton
                title="Iniciar torneo directo"
                description={`Se generará el bracket con ${registrations.length} equipos inscritos y comenzará el torneo. Esta acción no se puede deshacer.`}
                onConfirm={()=>start.mutate()}
                trigger={
                  <button disabled={start.isPending}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-700 hover:bg-green-600
                      text-white text-sm font-semibold transition-all disabled:opacity-40">
                    {start.isPending?<RefreshCw className="h-4 w-4 animate-spin"/>:<Play className="h-4 w-4"/>}
                    Iniciar directo
                  </button>
                }
              />
            )}
          </>
        )}
        {tournament.phase === 'checkin' && (
          <ConfirmButton
            title="Iniciar torneo"
            description={`Se generará el bracket con ${checkedIn} equipos que hicieron check-in. Esta acción no se puede deshacer.`}
            onConfirm={()=>start.mutate()}
            trigger={
              <button disabled={start.isPending||checkedIn<2}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-700 hover:bg-green-600
                  text-white text-sm font-semibold transition-all disabled:opacity-40">
                {start.isPending?<RefreshCw className="h-4 w-4 animate-spin"/>:<Play className="h-4 w-4"/>}
                Iniciar torneo ({checkedIn}/{registrations.length} check-in)
              </button>
            }
          />
        )}
        {tournament.riotTournamentId && (
          <button disabled={codes.isPending}
            onClick={()=>codes.mutate(20)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-600
              text-white text-sm font-semibold transition-all disabled:opacity-40">
            {codes.isPending?<RefreshCw className="h-4 w-4 animate-spin"/>:<Zap className="h-4 w-4"/>}
            Generar códigos ({tournament.codesAvailable})
          </button>
        )}
        {(tournament.phase === 'active' || tournament.phase === 'complete') && (
          <button disabled={sync.isPending}
            onClick={() => sync.mutate()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-600
              text-white text-sm font-semibold transition-all disabled:opacity-40">
            {sync.isPending ? <RefreshCw className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4"/>}
            Sincronizar stats
          </button>
        )}
      </div>
      {tournament.phase==='checkin' && tournament.checkinDeadline && (
        <p className="text-xs text-yellow-400 mt-3 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Check-in cierra: {new Date(tournament.checkinDeadline).toLocaleString('es-MX')}
        </p>
      )}
    </GlassCard>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { key:'bracket',   label:'Bracket',    icon:<GitBranch className="h-4 w-4"/> },
  { key:'standings', label:'Standings',  icon:<BarChart2 className="h-4 w-4"/> },
  { key:'equipos',   label:'Equipos',    icon:<List className="h-4 w-4"/> },
  { key:'stats',     label:'Stats',      icon:<Activity className="h-4 w-4"/> },
];

// ─── Stats tab inner component ────────────────────────────────────────────────
function MatchStatsPicker({
  tournament, registrations,
}: { tournament: Tournament; registrations: Registration[] }) {
  const matches = (tournament.bracket ?? []).filter(
    m => m.matchStatus === 'active' || m.matchStatus === 'complete' || !!m.code
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    matches.find(m => m.gameId)?.id ?? matches[0]?.id ?? null
  );
  const selected = matches.find(m => m.id === selectedId) ?? null;

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const getTeamName = (team: string | null) =>
    registrations.find(r => r.teamName === team)?.teamName ?? team;

  const { stats, loading, error, waitingForGame } = useMatchStats({
    tournamentId: tournament.id,
    bracketMatchId: selected?.id ?? '',
    gameId: selected?.gameId,
    tournamentCode: selected?.code,
    enabled: !!selected?.id,
    onComplete: (s) => {
      const winner = s.winner === 'blue'
        ? (selected?.team1 ?? 'Equipo Azul')
        : (selected?.team2 ?? 'Equipo Rojo');
      setToastMsg(`🏆 ¡${winner} ganó la partida! Stats cargados.`);
    },
  });

  if (matches.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] py-20 text-center">
        <Activity className="h-12 w-12 mx-auto mb-4 text-white/10" />
        <p className="text-white/30 text-sm">Stats disponibles cuando el torneo esté activo</p>
      </div>
    );
  }

  return (
    <div>
      {toastMsg && (
        <Toast
          message={toastMsg}
          type="success"
          duration={6000}
          onClose={() => setToastMsg(null)}
        />
      )}

      {/* Match selector */}
      {matches.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {matches.map(m => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                selectedId === m.id
                  ? 'bg-white text-black border-white'
                  : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/70'
              }`}
            >
              R{m.round}P{m.matchNumber}: {m.team1 ?? '?'} vs {m.team2 ?? '?'}
              {m.matchStatus === 'complete' && ' ✓'}
              {!m.gameId && ' (sin ID)'}
            </button>
          ))}
        </div>
      )}

      {selected && !selected.gameId && !selected.code && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] py-12 text-center">
          <Activity className="h-10 w-10 mx-auto mb-3 text-white/10" />
          <p className="text-white/30 text-sm">Este partido aún no tiene código asignado</p>
        </div>
      )}

      {selected && (selected.gameId || selected.code) && (
        <MatchStatsDetail
          stats={stats}
          loading={loading}
          error={waitingForGame ? null : error}
          bracketMatchId={selected.id}
          gameId={selected.gameId}
          team1={getTeamName(selected.team1)}
          team2={getTeamName(selected.team2)}
        />
      )}

      {waitingForGame && selected?.code && (
        <p className="text-center text-white/30 text-xs mt-4 animate-pulse">
          Esperando que Riot registre la partida del código {selected.code}…
        </p>
      )}
    </div>
  );
}

// ─── Stats tab — global overview + per-match picker ──────────────────────────
function StatsTabView({
  tournament, registrations,
}: { tournament: Tournament; registrations: Registration[] }) {
  const [subTab, setSubTab] = useState<'resumen' | 'partidas'>('resumen');
  const [toast, setToast]   = useState<string | null>(null);

  // Trigger backend auto-sync when viewing stats on active tournaments
  useEffect(() => {
    if (tournament.phase !== 'active' && tournament.phase !== 'complete') return;
    import('@/lib/axios').then(({ axiosInstance }) => {
      axiosInstance.post(`/api/tournaments/${tournament.id}/auto-sync`).catch(() => {});
    });
  }, [tournament.id, tournament.phase]);

  const { data: globalStats, loading: globalLoading, refresh: globalRefresh } = useTournamentGlobalStats({
    tournamentId: tournament.id,
    enabled: true,
    onNewMatch: () => setToast('¡Nueva partida completada! Stats del torneo actualizados.'),
  });

  return (
    <div>
      {toast && (
        <Toast message={toast} type="success" duration={6000} onClose={() => setToast(null)} />
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] w-fit">
        <button
          onClick={() => setSubTab('resumen')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            subTab === 'resumen' ? 'bg-white text-black' : 'text-white/40 hover:text-white/70'
          }`}
        >
          <BarChart2 className="h-4 w-4" /> Resumen Global
        </button>
        <button
          onClick={() => setSubTab('partidas')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            subTab === 'partidas' ? 'bg-white text-black' : 'text-white/40 hover:text-white/70'
          }`}
        >
          <Activity className="h-4 w-4" /> Partidas
        </button>
      </div>

      <AnimatePresence mode="wait">
        {subTab === 'resumen' && (
          <motion.div key="resumen" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {globalStats ? (
              <TournamentGlobalStats
                data={globalStats}
                loading={globalLoading}
                onRefresh={globalRefresh}
              />
            ) : globalLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="h-7 w-7 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                <p className="text-white/30 text-sm animate-pulse">Cargando stats globales...</p>
              </div>
            ) : (
              <GlassCard className="py-20 text-center">
                <BarChart2 className="h-12 w-12 mx-auto mb-4 text-gray-800" />
                <p className="text-gray-500">Disponible cuando haya partidas completadas</p>
              </GlassCard>
            )}
          </motion.div>
        )}

        {subTab === 'partidas' && (
          <motion.div key="partidas" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <MatchStatsPicker tournament={tournament} registrations={registrations} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TournamentDetailsPage() {
  const { id } = useParams<{ id:string }>();
  const { user } = useAuth();
  const [tab, setTab]               = useState('');
  const [tabInit, setTabInit]       = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  // Cached reads (React Query): tournament + its registrations.
  const tournamentQ   = useTournament(id, { pollWhenActive: true });
  const registrationsQ = useRegistrations(id);
  const tournament = tournamentQ.data ?? null;
  const registrations: Registration[] = registrationsQ.data ?? [];
  const loading = tournamentQ.isPending;

  // Mutations.
  const activate = useActivateMatch(id ?? '');
  const report   = useReportResult(id ?? '');
  const reportingMatch = report.isPending ? (report.variables?.matchId ?? null) : null;

  // Default tab once the tournament resolves (active/complete → bracket, else equipos).
  useEffect(() => {
    if (tabInit || !tournament) return;
    setTab(tournament.phase==='active'||tournament.phase==='complete' ? 'bracket' : 'equipos');
    setTabInit(true);
  }, [tournament, tabInit]);

  useEffect(() => {
    if (loading || !headerRef.current) return;
    gsap.fromTo(headerRef.current.querySelectorAll('[data-h]'),
      { opacity:0, y:25 },
      { opacity:1, y:0, stagger:0.1, duration:0.65, ease:'power2.out', delay:0.1 }
    );
  }, [loading]);

  const handleActivate = async (matchId:string): Promise<string|null> => {
    try {
      return await activate.mutateAsync(matchId);
    } catch {
      return null; // error toast handled by the mutation
    }
  };

  const handleResult = (matchId:string, winner:string, score1:number, score2:number) => {
    report.mutate({ matchId, winner, score1, score2 });
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <RefreshCw className="h-8 w-8 text-red-500 animate-spin" />
    </div>
  );
  if (!tournament) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
      <Trophy className="h-16 w-16 text-gray-800" />
      <p className="text-gray-400">Torneo no encontrado</p>
      <Link to="/tournaments" className="text-red-400 text-sm hover:text-red-300">← Volver</Link>
    </div>
  );

  const maxRound  = tournament.bracket?.length ? Math.max(...tournament.bracket.map(m=>m.round)) : 0;
  const checkedIn = registrations.filter(r=>r.checkedIn).length;
  const pct       = Math.min(100, Math.round((tournament.participants/tournament.maxParticipants)*100));
  const userId    = user?.id != null ? Number(user.id) : null;
  const canManage = userId != null && (
    user?.role === 'admin' || (tournament.createdBy != null && userId === tournament.createdBy)
  );
  const canViewCodes = tournament.viewerAccess === 'owner' || tournament.viewerAccess === 'participant';

  return (
    <div className="min-h-screen text-white">
      <div className="fixed inset-0 bg-black -z-20" />
      <div className="fixed inset-0 -z-10 pointer-events-none"
        style={{ background:'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(127,29,29,0.25) 0%, transparent 60%)' }} />

      <div className="max-w-5xl mx-auto px-4 py-12">

        {/* Back + Live button */}
        <div className="flex items-center justify-between mb-8">
          <Link to="/tournaments"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-white text-sm transition-colors group">
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            Volver a Torneos
          </Link>
          {tournament?.phase === 'active' && (
            <Link to={`/tournaments/${tournament.id}/live`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold
                bg-gradient-to-r from-green-700 to-green-600 hover:from-green-600 hover:to-green-500
                text-white shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.45)]
                transition-all duration-200">
              <Zap className="h-4 w-4" />
              Ver en Vivo
              <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
            </Link>
          )}
        </div>

        {/* Header */}
        <div ref={headerRef} className="mb-10">
          <div data-h className="flex flex-wrap items-center gap-2 mb-3">
            {tournament.riotTournamentId && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
                border border-purple-500/40 bg-purple-500/10 text-purple-300">
                <Zap className="h-3 w-3" /> Riot Oficial · ID {tournament.riotTournamentId}
              </span>
            )}
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              tournament.phase==='registration' ? 'border-green-500/40 bg-green-500/10 text-green-300' :
              tournament.phase==='checkin'      ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300' :
              tournament.phase==='active'       ? 'border-blue-500/40 bg-blue-500/10 text-blue-300' :
                                                  'border-gray-600/40 bg-gray-500/10 text-gray-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                tournament.phase==='registration'?'bg-green-400':tournament.phase==='checkin'?'bg-yellow-400':
                tournament.phase==='active'?'bg-blue-400':'bg-gray-500'}`}/>
              {{registration:'Inscripciones abiertas',checkin:'Check-in activo',active:'En curso',complete:'Finalizado'}[tournament.phase]}
            </span>
          </div>
          <h1 data-h className="text-4xl md:text-5xl font-black text-white mb-3">{tournament.name}</h1>
          <p data-h className="text-gray-400 max-w-2xl">{tournament.description}</p>
        </div>

        {/* Phase stepper */}
        <PhaseStepper phase={tournament.phase} />

        {/* Info cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon:<Trophy className="h-6 w-6 text-red-400"/>,   label:'Premio',  value:tournament.prize },
            { icon:<Calendar className="h-6 w-6 text-red-400"/>, label:'Inicio',  value:new Date(tournament.startDate).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}) },
            { icon:<Users className="h-6 w-6 text-red-400"/>,    label:'Equipos', value:`${tournament.participants}/${tournament.maxParticipants}` },
            { icon:<GitBranch className="h-6 w-6 text-red-400"/>,label:'Formato', value:tournament.format.split(' ').slice(0,2).join(' ') },
          ].map(({ icon, label, value }) => (
            <GlassCard key={label} className="p-4 flex flex-col items-center text-center gap-2">
              <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20">{icon}</div>
              <span className="text-xs text-gray-600 uppercase tracking-wider">{label}</span>
              <span className="font-bold text-sm text-white">{value}</span>
            </GlassCard>
          ))}
        </div>

        {/* Progress */}
        <GlassCard className="p-5 mb-8">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Inscripciones</span>
            <span className="font-bold text-white">{pct}%</span>
          </div>
          <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
            <motion.div className="h-full bg-gradient-to-r from-red-600 to-red-500 rounded-full"
              initial={{ width:0 }} animate={{ width:`${pct}%` }} transition={{ duration:1, ease:'easeOut' }}/>
          </div>
        </GlassCard>

        {/* Check-in panel */}
        {tournament.phase === 'checkin' && (
          <CheckinPanel tournamentId={tournament.id} />
        )}

        {/* Admin panel — solo creador o admin */}
        {canManage && (tournament.phase==='registration'||tournament.phase==='checkin'||tournament.phase==='active') && (
          <AdminPanel tournament={tournament} registrations={registrations} />
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-white/[0.08] mb-6 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold whitespace-nowrap transition-all border-b-2 -mb-px ${
                tab===t.key ? 'border-red-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}>
              {t.icon} {t.label}
              {t.key==='equipos' && <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/[0.06]">{registrations.length}</span>}
              {t.key==='equipos' && tournament.phase==='checkin' && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300">{checkedIn}✓</span>
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Bracket */}
          {tab === 'bracket' && (
            <motion.div key="bracket" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
              {tournament.bracket?.length ? (
                <TournamentBracket
                  bracket={tournament.bracket as React.ComponentProps<typeof TournamentBracket>['bracket']} maxRound={maxRound}
                  tournamentId={tournament.id}
                  canViewCodes={canViewCodes}
                  canManage={canManage}
                  onActivateMatch={handleActivate}
                  onReportResult={handleResult}
                  reportingMatch={reportingMatch}
                  isActive={tournament.phase==='active'}
                />
              ) : (
                <GlassCard className="py-24 text-center">
                  <GitBranch className="h-16 w-16 mx-auto mb-4 text-gray-800" />
                  <p className="text-gray-500 text-lg">
                    {tournament.phase==='registration' ? `${registrations.length}/${tournament.maxParticipants} equipos inscritos` :
                     tournament.phase==='checkin'      ? `${checkedIn}/${registrations.length} con check-in` : 'Sin bracket'}
                  </p>
                </GlassCard>
              )}
            </motion.div>
          )}

          {/* Standings */}
          {tab === 'standings' && (
            <motion.div key="standings" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
              {tournament.standings?.length ? (
                <GlassCard className="overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/[0.06] text-gray-500 text-xs uppercase tracking-wider">
                        <th className="px-6 py-4">#</th>
                        <th className="px-6 py-4">Equipo</th>
                        <th className="px-6 py-4 text-center">V</th>
                        <th className="px-6 py-4 text-center">D</th>
                        <th className="px-6 py-4 text-center">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tournament.standings.map(s => (
                        <tr key={s.position}
                          className={`border-b border-white/[0.04] transition-colors hover:bg-white/[0.03] ${s.position===1?'bg-yellow-500/5':''}`}>
                          <td className="px-6 py-4 text-lg">{s.position===1?'🥇':s.position===2?'🥈':s.position===3?'🥉':<span className="text-gray-600">{s.position}</span>}</td>
                          <td className="px-6 py-4 font-bold text-white">{s.team}</td>
                          <td className="px-6 py-4 text-center text-green-400 font-bold">{s.wins}</td>
                          <td className="px-6 py-4 text-center text-red-400">{s.losses}</td>
                          <td className="px-6 py-4 text-center font-black text-xl text-red-400">{s.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </GlassCard>
              ) : (
                <GlassCard className="py-20 text-center">
                  <BarChart2 className="h-14 w-14 mx-auto mb-4 text-gray-800" />
                  <p className="text-gray-500">Disponible cuando inicie el torneo</p>
                </GlassCard>
              )}
            </motion.div>
          )}

          {/* Stats */}
          {tab === 'stats' && (
            <motion.div key="stats" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
              <StatsTabView tournament={tournament} registrations={registrations} />
            </motion.div>
          )}

          {/* Equipos */}
          {tab === 'equipos' && (
            <motion.div key="equipos" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
              {registrations.length === 0 ? (
                <GlassCard className="py-20 text-center">
                  <Users className="h-14 w-14 mx-auto mb-4 text-gray-800" />
                  <p className="text-gray-500">Aún no hay equipos inscritos</p>
                </GlassCard>
              ) : (
                <div className="space-y-3">
                  {registrations.map((reg, i) => (
                    <GlassCard key={i}
                      className={`p-4 transition-all ${tournament.phase==='checkin'&&!reg.checkedIn?'opacity-50':''}`}>
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-700/40 to-red-900/40
                          border border-red-700/30 flex items-center justify-center text-sm font-black text-red-300 flex-shrink-0">
                          {i+1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1 flex-wrap">
                            <span className="font-bold text-red-400">{reg.teamName}</span>
                            {reg.checkedIn && (
                              <span className="inline-flex items-center gap-1 text-xs text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full bg-green-500/10">
                                <Check className="h-3 w-3" /> Check-in
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-400 font-mono">{reg.captainRiotId}</p>
                          <p className="text-xs text-gray-600 mt-1">
                            {reg.players.map(p =>
                              p.inviteStatus === 'pending'
                                ? `${p.name} (invitación pendiente)`
                                : (p.riotId || p.name)
                            ).join(' · ')}
                          </p>
                        </div>
                        {reg.contact && (
                          <span className="text-xs text-gray-600 flex-shrink-0">{reg.contact}</span>
                        )}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-xs text-gray-600 hidden sm:inline">{reg.players.length} jug.</span>
                          <CopyButton text={reg.captainRiotId} />
                        </div>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
