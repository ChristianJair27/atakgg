// src/pages/Tournaments.tsx — glass/space · GSAP · MySQL-backed
import { useState, useMemo, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/sonner';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion, AnimatePresence } from 'framer-motion';
import { TournamentRegisterModal } from '@/components/TournamentRegisterModal';
import { TournamentCreateModal } from '@/components/TournamentCreateModal';
import { ScrollVideoBg } from '@/components/ScrollVideoBg';
import { Skeleton } from '@/components/ui/skeleton';
import { Tip } from '@/components/ui/Tip';
import { useTournaments } from '@/hooks/queries/tournaments';
import { qk } from '@/hooks/queries/keys';
import {
  Trophy, Calendar, Users, Plus, ArrowRight,
  Zap, Shield, Clock, CheckCircle,
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

// ─── Types ────────────────────────────────────────────────────────────────────
interface Tournament {
  id: string; name: string;
  phase: 'registration' | 'checkin' | 'active' | 'complete';
  status: string; participants: number; maxParticipants: number;
  prize: string; startDate: string; format: string; description: string;
  riotTournamentId?: number; codesAvailable?: number;
}

const PHASE_CONFIG = {
  registration: { label: 'Inscripciones',  dot: 'bg-green-400',  badge: 'border-green-500/40 text-green-300 bg-green-500/10',  icon: <Users className="h-3.5 w-3.5" /> },
  checkin:      { label: 'Check-in',        dot: 'bg-yellow-400', badge: 'border-yellow-500/40 text-yellow-300 bg-yellow-500/10', icon: <CheckCircle className="h-3.5 w-3.5" /> },
  active:       { label: 'En Curso',        dot: 'bg-blue-400',   badge: 'border-blue-500/40 text-blue-300 bg-blue-500/10',   icon: <Zap className="h-3.5 w-3.5" /> },
  complete:     { label: 'Finalizado',      dot: 'bg-gray-500',   badge: 'border-gray-600/40 text-gray-400 bg-gray-500/10',   icon: <Shield className="h-3.5 w-3.5" /> },
} as const;

const FILTERS = [
  { key: 'todos',        label: 'Todos' },
  { key: 'registration', label: 'Inscripción' },
  { key: 'checkin',      label: 'Check-in' },
  { key: 'active',       label: 'En Curso' },
  { key: 'complete',     label: 'Finalizados' },
] as const;

// ─── Tournament card ──────────────────────────────────────────────────────────
function TournamentCard({
  t, index, onRegister,
}: {
  t: Tournament; index: number;
  onRegister: (t: { id: string; name: string }) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const phase = PHASE_CONFIG[t.phase] ?? PHASE_CONFIG.complete;
  const pct   = Math.min(100, Math.round((t.participants / t.maxParticipants) * 100));
  const date  = new Date(t.startDate).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });

  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(ref.current,
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 0.55, delay: index * 0.07, ease: 'power2.out',
        scrollTrigger: { trigger: ref.current, start: 'top 90%', once: true } }
    );
  }, [index]);

  return (
    <div ref={ref}
      className="group relative rounded-2xl overflow-hidden transition-all duration-300
        hover:-translate-y-0.5"
      style={{
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 22%, rgba(255,255,255,0) 70%), rgba(13,13,17,0.30)',
        backdropFilter: 'blur(20px) saturate(120%)',
        WebkitBackdropFilter: 'blur(20px) saturate(120%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 44px -30px rgba(0,0,0,.6)',
      }}
    >
      {/* Subtle top glow on hover */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/0 to-transparent
        group-hover:via-white/20 transition-all duration-500" />

      <div className="p-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${phase.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${phase.dot} animate-pulse`} />
                {phase.icon}
                {phase.label}
              </span>
              {t.riotTournamentId && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs
                  border border-purple-500/40 text-purple-300 bg-purple-500/10">
                  <Zap className="h-3 w-3" /> Riot Oficial
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-white group-hover:text-white/80 transition-colors truncate">
              {t.name}
            </h3>
            <p className="text-gray-500 text-sm mt-1 line-clamp-2">{t.description}</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-gray-500">
              <Trophy className="h-3.5 w-3.5 text-red-500/70" />
              <span className="text-xs uppercase tracking-wider">Premio</span>
            </div>
            <span className="text-sm font-semibold text-white truncate">{t.prize}</span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-gray-500">
              <Calendar className="h-3.5 w-3.5 text-red-500/70" />
              <span className="text-xs uppercase tracking-wider">Inicio</span>
            </div>
            <span className="text-sm font-semibold text-white">{date}</span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-gray-500">
              <Clock className="h-3.5 w-3.5 text-red-500/70" />
              <span className="text-xs uppercase tracking-wider">Formato</span>
            </div>
            <span className="text-sm font-semibold text-white truncate">{t.format.split(' ')[0]}</span>
          </div>
        </div>

        {/* Teams + progress */}
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-gray-500 flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {t.participants} / {t.maxParticipants} equipos
            </span>
            <span className={`font-bold ${pct >= 75 ? 'text-red-400' : 'text-gray-400'}`}>{pct}%</span>
          </div>
          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-white/60 to-white/80 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1, ease: 'easeOut', delay: index * 0.07 + 0.3 }}
            />
          </div>
          {t.participants >= t.maxParticipants && (
            <p className="text-xs text-red-400 mt-1">Torneo lleno</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <Link to={`/tournaments/${t.id}`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
              border border-white/[0.12] text-gray-300 hover:border-red-500/40 hover:text-white
              hover:bg-red-500/5 transition-all duration-200">
            Ver detalles
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          {t.phase === 'registration' && t.participants < t.maxParticipants && (
            <button
              onClick={() => onRegister({ id: t.id, name: t.name })}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                bg-foreground text-background hover:bg-foreground/90
                transition-all duration-200">
              <Plus className="h-4 w-4" />
              Inscribirse
            </button>
          )}
          {t.phase === 'checkin' && (
            <Link to={`/tournaments/${t.id}`}
              className="flex items-center gap-1.5 text-sm text-yellow-400 font-medium">
              <CheckCircle className="h-4 w-4" /> Hacer check-in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Card skeleton (content-shaped, matches TournamentCard layout) ──────────────
function TournamentCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden"
      style={{
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 70%), rgba(13,13,17,0.30)',
        backdropFilter: 'blur(20px) saturate(120%)',
        WebkitBackdropFilter: 'blur(20px) saturate(120%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 44px -30px rgba(0,0,0,.6)',
      }}>
      <div className="p-6 space-y-4">
        <Skeleton width={130} height={24} style={{ borderRadius: 999 }} />
        <Skeleton width="70%" height={22} />
        <Skeleton width="90%" height={14} />
        <div className="grid grid-cols-3 gap-3 pt-1">
          {[0, 1, 2].map(i => <Skeleton key={i} height={36} />)}
        </div>
        <Skeleton height={6} style={{ borderRadius: 999 }} />
        <div className="flex gap-3 pt-1">
          <Skeleton width={120} height={38} style={{ borderRadius: 12 }} />
          <Skeleton width={120} height={38} style={{ borderRadius: 12 }} />
        </div>
      </div>
    </div>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────
function StatBar({ tournaments }: { tournaments: Tournament[] }) {
  const active = tournaments.filter(t => t.phase === 'active').length;
  const open   = tournaments.filter(t => t.phase === 'registration').length;
  const done   = tournaments.filter(t => t.phase === 'complete').length;
  const ref    = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(ref.current.children,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, stagger: 0.08, duration: 0.5, ease: 'power2.out', delay: 0.5 }
    );
  }, []);
  return (
    <div ref={ref} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
      {[
        { label:'Total',       value: tournaments.length, color:'text-white' },
        { label:'En curso',    value: active,             color:'text-blue-400' },
        { label:'Inscripción', value: open,               color:'text-green-400' },
        { label:'Finalizados', value: done,               color:'text-gray-400' },
      ].map(s => (
        <Tip key={s.label} label={`${s.value} ${s.label.toLowerCase()}`}>
          <div
            className="rounded-2xl p-5 text-center"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 70%), rgba(13,13,17,0.30)',
              backdropFilter: 'blur(20px) saturate(120%)',
              WebkitBackdropFilter: 'blur(20px) saturate(120%)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 44px -30px rgba(0,0,0,.6)',
            }}>
            <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-600 uppercase tracking-widest mt-1">{s.label}</div>
          </div>
        </Tip>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TournamentsPage() {
  const navigate = useNavigate();
  const [filter,             setFilter]             = useState<string>('todos');
  const [registerOpen,       setRegisterOpen]       = useState(false);
  const [createOpen,         setCreateOpen]         = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<{ id:string; name:string }|null>(null);
  const [mousePos,           setMousePos]           = useState({ x:0, y:0 });
  const headerRef = useRef<HTMLDivElement>(null);

  const qc = useQueryClient();
  const { data: tournaments = [], isLoading: loading } = useTournaments();
  // After a register/create mutation, refetch the cached list.
  const refetchTournaments = () => qc.invalidateQueries({ queryKey: qk.tournaments() });

  useEffect(() => {
    if (loading || !headerRef.current) return;
    gsap.fromTo(headerRef.current.querySelectorAll('[data-h]'),
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, stagger: 0.1, duration: 0.7, ease: 'power3.out' }
    );
  }, [loading]);

  const filtered = useMemo(() =>
    filter === 'todos' ? tournaments : tournaments.filter(t => t.phase === filter),
    [tournaments, filter]
  );

  const isAuth = !!localStorage.getItem('access_token');

  return (
    <div className="min-h-screen text-white"
      onMouseMove={e => setMousePos({ x: e.clientX, y: e.clientY })}>

      {/* Living scroll-scrubbed dagger background (shared) */}
      <ScrollVideoBg />

      {/* Background accents (kept translucent so the video reads through) */}
      <div className="fixed inset-0 -z-10 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(127,29,29,0.22) 0%, transparent 70%)' }} />
      <div className="fixed inset-0 pointer-events-none -z-10"
        style={{ background: `radial-gradient(500px circle at ${mousePos.x}px ${mousePos.y}px, rgba(239,68,68,0.05), transparent 70%)` }} />
      {/* Grid */}
      <div className="fixed inset-0 -z-10 opacity-[0.025]"
        style={{ backgroundImage:'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)', backgroundSize:'60px 60px' }} />

      <div className="max-w-6xl mx-auto px-4 py-16 relative z-[1]">

        {/* Header */}
        <div ref={headerRef} className="text-center mb-14">
          <div data-h className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6
            border border-white/10 bg-white/[0.03] text-muted-foreground text-xs tracking-[3px] uppercase">
            <Trophy className="h-3.5 w-3.5" />
            <span>Torneos oficiales · Riot Games</span>
            <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" />
          </div>
          <h1 data-h className="text-5xl md:text-6xl font-medium tracking-[-2px] text-white mb-4">
            Torneos <span className="font-serif italic font-normal">ATAK.GG</span>
          </h1>
          <p data-h className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8 font-light leading-relaxed">
            La escena competitiva de Querétaro. Torneos con códigos oficiales Riot, brackets automáticos y stats en vivo.
          </p>
          {isAuth && (
            <button data-h
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm
                bg-foreground text-background hover:bg-foreground/90
                transition-all duration-200 transform hover:scale-[1.02]">
              <Plus className="h-4 w-4" />
              Crear Torneo
            </button>
          )}
        </div>

        {/* Stats bar */}
        <StatBar tournaments={tournaments} />

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2 justify-center mb-10">
          {FILTERS.map(f => (
            <Tip key={f.key} label={`Filtrar: ${f.label}`}>
              <button
                onClick={() => setFilter(f.key)}
                className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  filter === f.key
                    ? 'bg-foreground text-background'
                    : 'border border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:border-white/20 hover:text-white'
                }`}>
                {f.label}
                <span className={`ml-1.5 text-xs ${filter === f.key ? 'text-background/60' : 'text-white/20'}`}>
                  {f.key === 'todos' ? tournaments.length : tournaments.filter(t => t.phase === f.key).length}
                </span>
              </button>
            </Tip>
          ))}
        </div>

        {/* Grid */}
        <AnimatePresence mode="wait">
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {Array.from({ length: 4 }).map((_, i) => <TournamentCardSkeleton key={i} />)}
            </div>
          ) : filtered.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {filtered.map((t, i) => (
                <TournamentCard key={t.id} t={t} index={i}
                  onRegister={sel => {
                    if (!isAuth) {
                      toast.error('Inicia sesión para inscribir tu equipo');
                      navigate('/login');
                      return;
                    }
                    setSelectedTournament(sel);
                    setRegisterOpen(true);
                  }} />
              ))}
            </div>
          ) : (
            <motion.div key="empty"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="text-center py-24">
              <Trophy className="h-16 w-16 text-gray-800 mx-auto mb-5" />
              <p className="text-gray-500 text-lg mb-3">No hay torneos en esta categoría</p>
              {filter !== 'todos' && (
                <button onClick={() => setFilter('todos')}
                  className="text-red-400 text-sm hover:text-red-300 transition-colors">
                  Ver todos los torneos →
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      {selectedTournament && (
        <TournamentRegisterModal
          tournamentId={selectedTournament.id}
          tournamentName={selectedTournament.name}
          open={registerOpen}
          onOpenChange={setRegisterOpen}
          onRegistered={refetchTournaments}
        />
      )}
      <TournamentCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={refetchTournaments}
      />
    </div>
  );
}
