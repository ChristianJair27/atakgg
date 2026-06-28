// src/pages/StatsSearch.tsx — Immersive stats search · glass/space
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import gsap from 'gsap';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { resolveRiotIdQueryOptions } from '@/hooks/queries/stats';
import {
  Search, Clock, X, BarChart3, Trophy,
  Target, Zap, TrendingUp, Users, Globe, ArrowRight,
} from 'lucide-react';

// ─── Validation ───────────────────────────────────────────────────────────────
const schema = z.object({
  riotId: z.string().min(3).regex(/.+#.+/, 'Formato: Nombre#Tag'),
  region: z.string().min(1),
});
type FormData = z.infer<typeof schema>;

const regions = [
  { value: 'na1',  label: 'North America',        short: 'NA',   flag: '🇺🇸' },
  { value: 'euw1', label: 'Europe West',           short: 'EUW',  flag: '🇪🇺' },
  { value: 'eun1', label: 'Europe Nordic & East',  short: 'EUNE', flag: '🇸🇪' },
  { value: 'kr',   label: 'Korea',                 short: 'KR',   flag: '🇰🇷' },
  { value: 'br1',  label: 'Brazil',                short: 'BR',   flag: '🇧🇷' },
  { value: 'la1',  label: 'Latin America North',   short: 'LAN',  flag: '🇲🇽' },
  { value: 'la2',  label: 'Latin America South',   short: 'LAS',  flag: '🇦🇷' },
  { value: 'oc1',  label: 'Oceania',               short: 'OCE',  flag: '🇦🇺' },
  { value: 'ru',   label: 'Russia',                short: 'RU',   flag: '🇷🇺' },
  { value: 'tr1',  label: 'Turkey',                short: 'TR',   flag: '🇹🇷' },
  { value: 'jp1',  label: 'Japan',                 short: 'JP',   flag: '🇯🇵' },
];

const POPULAR = [
  { id: 'Faker#KR1',       region: 'kr',   label: 'Faker',       role: 'Mid · Challenger' },
  { id: 'Caps#EUW',        region: 'euw1', label: 'Caps',        role: 'Mid · Challenger' },
  { id: 'Doublelift#NA1',  region: 'na1',  label: 'Doublelift',  role: 'ADC · Challenger' },
  { id: 'Rekkles#EUW',     region: 'euw1', label: 'Rekkles',     role: 'ADC · Grandmaster' },
  { id: 'Perkz#EUW',       region: 'euw1', label: 'Perkz',       role: 'Mid · Challenger' },
  { id: 'Ruler#KR1',       region: 'kr',   label: 'Ruler',       role: 'ADC · Challenger' },
];

const FEATURES = [
  { icon: <BarChart3 className="h-5 w-5" />, label: 'Stats detallados' },
  { icon: <Trophy className="h-5 w-5" />,    label: 'Rank tracking' },
  { icon: <Target className="h-5 w-5" />,    label: 'Campeón 3D' },
  { icon: <Zap className="h-5 w-5" />,       label: 'AI Insights' },
  { icon: <TrendingUp className="h-5 w-5" />,label: 'Match history' },
  { icon: <Users className="h-5 w-5" />,     label: 'Torneos' },
];

const RECENT_KEY = 'atakgg_recent_searches';

function getRecent(): Array<{ id: string; region: string }> {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function saveRecent(id: string, region: string) {
  const list = [{ id, region }, ...getRecent().filter(r => r.id !== id)].slice(0, 6);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}
function removeRecent(id: string) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(getRecent().filter(r => r.id !== id)));
}

// ─── Animated orb ─────────────────────────────────────────────────────────────
function Orb({ size, x, y, delay, color }: { size: number; x: string; y: string; delay: number; color: string }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{ width: size, height: size, left: x, top: y, background: color }}
      animate={{ scale: [1, 1.15, 1], opacity: [0.12, 0.2, 0.12] }}
      transition={{ duration: 6 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  );
}

// ─── Radar scan animation (shown while searching) ─────────────────────────────
function RadarScan() {
  return (
    <div className="relative w-32 h-32 mx-auto">
      {[0, 1, 2].map(i => (
        <motion.div key={i}
          className="absolute inset-0 rounded-full border border-red-500/40"
          animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.6, ease: 'easeOut' }}
        />
      ))}
      <div className="absolute inset-0 rounded-full border-2 border-red-600/60 flex items-center justify-center">
        {/* Sweep arm */}
        <motion.div
          className="absolute inset-0 rounded-full overflow-hidden"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <div className="absolute top-1/2 left-1/2 w-14 h-0.5 origin-left"
            style={{ background: 'linear-gradient(90deg, rgba(239,68,68,0.9), transparent)' }} />
        </motion.div>
        <Search className="h-6 w-6 text-red-400 relative z-10" />
      </div>
    </div>
  );
}

// ─── Region grid ──────────────────────────────────────────────────────────────
function RegionGrid({ selected, onSelect }: { selected: string; onSelect: (v: string) => void }) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-11 gap-2">
      {regions.map(r => (
        <button key={r.value} type="button" onClick={() => onSelect(r.value)}
          className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-semibold transition-all duration-200
            ${r.value === selected
              ? 'border-red-500 bg-red-500/20 text-red-300 shadow-[0_0_16px_rgba(239,68,68,0.3)]'
              : 'border-white/[0.06] bg-white/[0.02] text-gray-500 hover:border-white/20 hover:text-gray-300'
            }`}
        >
          <span className="text-xl leading-none">{r.flag}</span>
          <span className="leading-none">{r.short}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function StatsSearch() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);
  const [focused,     setFocused]     = useState(false);
  const [region,      setRegion]      = useState('na1');
  const [recent,      setRecent]      = useState<Array<{ id: string; region: string }>>(getRecent);
  const [mousePos,    setMousePos]    = useState({ x: 0, y: 0 });

  const inputRef   = useRef<HTMLInputElement>(null);
  const pageRef    = useRef<HTMLDivElement>(null);
  const cardRef    = useRef<HTMLDivElement>(null);
  const belowRef   = useRef<HTMLDivElement>(null);

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { region: 'na1' },
  });

  // GSAP entrance
  useEffect(() => {
    if (!cardRef.current) return;
    gsap.fromTo(cardRef.current,
      { opacity: 0, y: 60, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'power3.out', delay: 0.1 }
    );
    if (belowRef.current) {
      gsap.fromTo(belowRef.current.children,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'power2.out', delay: 0.4 }
      );
    }
  }, []);

  const onSubmit = async (form: FormData) => {
    setIsSearching(true);
    setErrorMsg(null);
    try {
      const [gameName = '', tagLine = ''] = form.riotId.trim().split('#');
      // Resolve through React Query so the result is cached (the profile page then
      // reuses this exact resolve entry — instant) and deduped.
      const data = await qc.fetchQuery(
        resolveRiotIdQueryOptions(form.region, gameName, tagLine),
      );
      const encoded = encodeURIComponent(`${data.gameName}#${data.tagLine}`);
      saveRecent(form.riotId, form.region);
      navigate(`/stats/${form.region}/${encoded}`, { state: { puuid: data.puuid } });
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Invocador no encontrado. Verifica el Riot ID y región.');
      setIsSearching(false);
    }
  };

  const fill = (id: string, reg: string) => {
    setValue('riotId', id);
    setValue('region', reg);
    setRegion(reg);
    if (inputRef.current) { inputRef.current.value = id; inputRef.current.focus(); }
  };

  const deleteRecent = (id: string) => {
    removeRecent(id);
    setRecent(getRecent());
  };

  return (
    <div ref={pageRef} className="min-h-screen text-white overflow-hidden relative"
      onMouseMove={e => setMousePos({ x: e.clientX, y: e.clientY })}>

      {/* ── Background ──────────────────────────────────────────────────── */}
      <div className="fixed inset-0 bg-black -z-20" />
      <div className="fixed inset-0 -z-10 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(127,29,29,0.3) 0%, transparent 70%)' }} />
      <div className="fixed inset-0 pointer-events-none -z-10 transition-all duration-700"
        style={{ background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(239,68,68,0.06), transparent 70%)` }} />

      {/* Floating orbs */}
      <div className="fixed inset-0 overflow-hidden -z-10 pointer-events-none">
        <Orb size={600} x="-10%" y="-5%"  delay={0} color="radial-gradient(circle, rgba(185,28,28,0.25), transparent 70%)" />
        <Orb size={400} x="70%"  y="50%"  delay={2} color="radial-gradient(circle, rgba(68,34,255,0.12), transparent 70%)" />
        <Orb size={300} x="20%"  y="70%"  delay={4} color="radial-gradient(circle, rgba(185,28,28,0.15), transparent 70%)" />
      </div>

      {/* Grid overlay */}
      <div className="fixed inset-0 -z-10 opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <motion.div className="text-center mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full
            bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-6">
            <Globe className="h-4 w-4" />
            <span>Stats en tiempo real · API oficial de Riot Games</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-4">
            Busca tu <span className="text-red-400 [text-shadow:0_0_40px_rgba(239,68,68,0.5)]">perfil</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-md mx-auto">
            Ingresa tu Riot ID y descubre estadísticas profundas, análisis IA y más.
          </p>
        </motion.div>

        {/* ── Main search card ─────────────────────────────────────────────── */}
        <div ref={cardRef} className="w-full max-w-2xl">
          <div className="relative p-px rounded-3xl overflow-hidden">
            {/* Animated border gradient */}
            <motion.div className="absolute inset-0 rounded-3xl"
              animate={{ background: focused
                ? 'linear-gradient(135deg, rgba(239,68,68,0.8) 0%, rgba(185,28,28,0.4) 50%, rgba(239,68,68,0.8) 100%)'
                : 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)'
              }}
              transition={{ duration: 0.4 }}
            />
            <div className="relative rounded-3xl bg-black/80 backdrop-blur-2xl p-8 space-y-8">

              {/* ── Search bar ─────────────────────────────────────────────── */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                    Riot ID
                  </label>
                  <div className={`relative flex items-center rounded-2xl overflow-hidden transition-all duration-300 ${focused
                    ? 'shadow-[0_0_0_2px_rgba(239,68,68,0.7),0_0_30px_rgba(239,68,68,0.15)]'
                    : 'shadow-[0_0_0_1px_rgba(255,255,255,0.08)]'
                  }`}>
                    <div className="absolute left-4 text-gray-600 pointer-events-none">
                      <Search className="h-5 w-5" />
                    </div>
                    <input
                      ref={inputRef}
                      {...register('riotId')}
                      onFocus={() => setFocused(true)}
                      onBlur={() => setFocused(false)}
                      placeholder="KisterKata#NA1"
                      autoComplete="off"
                      spellCheck={false}
                      className="flex-1 bg-white/[0.04] border border-white/[0.06] text-white text-xl
                        py-5 pl-12 pr-4 outline-none placeholder:text-gray-700 font-medium tracking-wide rounded-2xl"
                    />
                  </div>
                  <AnimatePresence>
                    {(errors.riotId || errorMsg) && (
                      <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }} className="text-red-400 text-sm mt-2 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full border border-red-400 flex items-center justify-center flex-shrink-0 text-xs">!</span>
                        {errors.riotId?.message || errorMsg}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* ── Region grid ────────────────────────────────────────── */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                    Región
                  </label>
                  <RegionGrid selected={region} onSelect={v => { setRegion(v); setValue('region', v); }} />
                </div>

                {/* ── Submit ─────────────────────────────────────────────── */}
                <AnimatePresence mode="wait">
                  {isSearching ? (
                    <motion.div key="scanning"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="py-4"
                    >
                      <RadarScan />
                      <p className="text-center text-gray-400 text-sm mt-4 animate-pulse">
                        Analizando invocador...
                      </p>
                    </motion.div>
                  ) : (
                    <motion.button key="btn" type="submit"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      className="w-full py-5 rounded-2xl font-black text-lg text-white
                        bg-gradient-to-r from-red-600 to-red-700
                        hover:from-red-500 hover:to-red-600
                        shadow-[0_0_30px_rgba(239,68,68,0.25)] hover:shadow-[0_0_50px_rgba(239,68,68,0.45)]
                        transition-all duration-300 flex items-center justify-center gap-3"
                    >
                      <Search className="h-5 w-5" />
                      Analizar perfil
                      <ArrowRight className="h-5 w-5" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </form>

              {/* ── Recent searches ──────────────────────────────────────── */}
              <AnimatePresence>
                {recent.length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="flex items-center gap-2 text-xs text-gray-600 uppercase tracking-widest mb-3">
                      <Clock className="h-3 w-3" />
                      Búsquedas recientes
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recent.map(r => (
                        <div key={r.id}
                          className="group flex items-center gap-2 px-3 py-1.5 rounded-xl
                            bg-white/[0.03] border border-white/[0.06]
                            hover:border-red-500/30 hover:bg-red-500/5 transition-all"
                        >
                          <button type="button" onClick={() => fill(r.id, r.region)}
                            className="text-sm text-gray-400 group-hover:text-white transition-colors">
                            {r.id}
                            <span className="ml-1 text-xs text-gray-600">
                              {regions.find(rg => rg.value === r.region)?.short}
                            </span>
                          </button>
                          <button type="button" onClick={() => { deleteRecent(r.id); setRecent(getRecent()); }}
                            className="text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ── Below card ──────────────────────────────────────────────────── */}
        <div ref={belowRef} className="w-full max-w-2xl mt-10 space-y-8">

          {/* Popular players */}
          <div>
            <p className="text-xs text-gray-600 uppercase tracking-widest mb-4 text-center">Jugadores populares</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {POPULAR.map(p => (
                <button key={p.id} type="button" onClick={() => fill(p.id, p.region)}
                  className="flex items-center gap-3 p-3.5 rounded-xl text-left
                    border border-white/[0.06] bg-white/[0.02]
                    hover:border-red-500/30 hover:bg-red-500/5 transition-all group"
                >
                  {/* Avatar initial */}
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-700/40 to-red-900/40
                    border border-red-700/30 flex items-center justify-center text-sm font-black text-red-300 flex-shrink-0">
                    {p.label[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-300 group-hover:text-white transition-colors truncate">
                      {p.label}
                    </div>
                    <div className="text-xs text-gray-600 truncate">{p.role}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 justify-center">
            {FEATURES.map(f => (
              <div key={f.label}
                className="flex items-center gap-2 px-3 py-2 rounded-full
                  bg-white/[0.03] border border-white/[0.06] text-gray-500 text-xs"
              >
                <span className="text-red-500/70">{f.icon}</span>
                {f.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
