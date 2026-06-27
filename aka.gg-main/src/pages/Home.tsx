// src/pages/Home.tsx — ATAK.GG Premium Red/Black Landing Page
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import Hls from 'hls.js';
import { axiosInstance } from '@/lib/axios';
import { ScrollVideoBg } from '@/components/ScrollVideoBg';
import {
  Search, Trophy, Zap, BarChart3, Target,
  ArrowRight, Globe, Users, Shield, Star,
  Compass, Flame
} from 'lucide-react';

// ─── Validation ───────────────────────────────────────────────────────────────
const schema = z.object({
  riotId: z.string().min(3).regex(/.+#.+/, 'Formato: Nombre#Tag'),
  region: z.string().min(1),
});
type FormData = z.infer<typeof schema>;

const REGIONS = [
  { value: 'la1',  label: 'LAN',  flag: '🇲🇽' },
  { value: 'la2',  label: 'LAS',  flag: '🇦🇷' },
  { value: 'na1',  label: 'NA',   flag: '🇺🇸' },
  { value: 'euw1', label: 'EUW',  flag: '🇪🇺' },
  { value: 'eun1', label: 'EUNE', flag: '🇪🇺' },
  { value: 'kr',   label: 'KR',   flag: '🇰🇷' },
  { value: 'br1',  label: 'BR',   flag: '🇧🇷' },
  { value: 'oc1',  label: 'OCE',  flag: '🇦🇺' },
  { value: 'ru',   label: 'RU',   flag: '🇷🇺' },
  { value: 'tr1',  label: 'TR',   flag: '🇹🇷' },
  { value: 'jp1',  label: 'JP',   flag: '🇯🇵' },
];

const QUICK_LOOKUPS = ['Faker#KR1', 'Caps#EUW', 'Doublelift#NA1'];

// Animation helper
const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 25 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] },
});

// Word Reveal Component helper
const Word = ({ children, progress, range, isHighlighted }: { children: string; progress: any; range: [number, number]; isHighlighted: boolean }) => {
  const opacity = useTransform(progress, range, [0.15, 1]);
  return (
    <motion.span 
      style={{ opacity }} 
      className={`inline-block mr-2 md:mr-3 ${isHighlighted ? 'text-red-500 font-black' : 'text-gray-100 font-medium'}`}
    >
      {children}
    </motion.span>
  );
};

const ParagraphReveal = ({ text, highlightWords, scrollProgress, range }: { text: string; highlightWords: string[]; scrollProgress: any; range: [number, number] }) => {
  const words = text.split(" ");
  return (
    <p className="text-xl md:text-3xl lg:text-4xl font-medium tracking-tight leading-relaxed">
      {words.map((word, i) => {
        const start = range[0] + (i / words.length) * (range[1] - range[0]);
        const end = start + (1 / words.length) * (range[1] - range[0]);
        const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
        const isHighlighted = highlightWords.some(h => cleanWord.toLowerCase() === h.toLowerCase());
        
        return (
          <Word key={i} progress={scrollProgress} range={[start, end]} isHighlighted={isHighlighted}>
            {word}
          </Word>
        );
      })}
    </p>
  );
};

export default function Home() {
  const navigate = useNavigate();
  const searchSectionRef = useRef<HTMLDivElement>(null);
  
  // Search Form State
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const [focused, setFocused]         = useState(false);
  const [regionOpen, setRegionOpen]   = useState(false);
  const [region, setRegion]           = useState('na1');
  const inputRef    = useRef<HTMLInputElement>(null);
  const dropRef     = useRef<HTMLDivElement>(null);
  const hlsVideoRef = useRef<HTMLVideoElement>(null);
  const heroVideoRef = useRef<HTMLVideoElement>(null);

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<FormData>({
    resolver: zodResolver(schema), 
    defaultValues: { region: 'na1' },
  });

  // Close region dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setRegionOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Hero video manual play
  useEffect(() => {
    const v = heroVideoRef.current;
    if (!v) return;
    v.load();
    v.play().catch(() => {});
  }, []);

  // HLS Video Setup for CTA
  useEffect(() => {
    const video = hlsVideoRef.current;
    if (!video) return;

    const streamUrl = "https://stream.mux.com/8wrHPCX2dC3msyYU9ObwqNdm00u3ViXvOSHUMRYSEe5Q.m3u8";

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      return () => {
        hls.destroy();
      };
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl;
      video.addEventListener("loadedmetadata", () => {
        video.play().catch(() => {});
      });
    }
  }, []);

  const selectedRegion = REGIONS.find(r => r.value === region) || REGIONS[0];

  const onSubmit = async (form: FormData) => {
    setIsSearching(true); 
    setErrorMsg(null);
    try {
      const [gameName = '', tagLine = ''] = form.riotId.trim().split('#');
      const { data } = await axiosInstance.get('/api/stats/resolve', {
        params: { region: form.region, gameName, tagLine },
      });
      const encoded = encodeURIComponent(`${data.gameName}#${data.tagLine}`);
      navigate(`/stats/${form.region}/${encoded}`, { state: { puuid: data.puuid } });
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Invocador no encontrado. Verifica el Riot ID y la región.');
    } finally { 
      setIsSearching(false); 
    }
  };

  const handleQuickFill = (riotId: string) => {
    setValue('riotId', riotId);
    if (inputRef.current) {
      inputRef.current.value = riotId;
      inputRef.current.focus();
    }
  };

  const scrollToSearch = () => {
    searchSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Scroll Progress for Mission Section
  const missionContainerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: missionContainerRef,
    offset: ["start end", "end start"]
  });

  return (
    <div className="relative bg-black text-white selection:bg-red-500/30 selection:text-white">

      {/* Living scroll-scrubbed dagger background (shared). Sits at fixed z-0;
          only reveals through sections whose own background is transparent (the
          Mission section below) — the hero keeps its own looping video. */}
      <ScrollVideoBg />

      {/* 1. HERO SECTION */}
      <section className="relative min-h-screen flex flex-col justify-center items-center overflow-hidden px-6 md:px-12 pt-20 bg-black">
        
        {/* Background Looping Video */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <video
            ref={heroVideoRef}
            loop
            muted
            playsInline
            preload="auto"
            className="absolute inset-0 w-full h-full object-cover opacity-55"
            style={{ display: 'block' }}
          >
            <source src="/HomeVideo/homevid.mp4" type="video/mp4" />
          </video>
        </div>

        {/* Ambient Overlay */}
        <div className="absolute inset-0 bg-radial-gradient from-transparent via-black/40 to-black z-0 pointer-events-none" />
        
        {/* Bottom Fade Gradient to Background */}
        <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-black to-transparent z-[1] pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 max-w-4xl w-full text-center flex flex-col items-center space-y-8 mt-12">
          
          {/* Avatar subscriber row */}
          <motion.div 
            {...fadeUp(0.1)}
            className="flex items-center gap-3 bg-white/[0.03] backdrop-blur-md px-4 py-2 rounded-full border border-white/[0.05]"
          >
            <div className="flex -space-x-2.5">
              <div className="w-7 h-7 rounded-full border border-black bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-[10px] font-black">A</div>
              <div className="w-7 h-7 rounded-full border border-black bg-gradient-to-br from-red-700 to-black flex items-center justify-center text-[10px] font-black">K</div>
              <div className="w-7 h-7 rounded-full border border-black bg-gradient-to-br from-black to-red-800 flex items-center justify-center text-[10px] font-black">R</div>
            </div>
            <span className="text-xs text-gray-400 font-medium tracking-tight">
              Más de <span className="text-red-400 font-bold">18,000+ invocadores</span> ya están subiendo de elo
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1 
            {...fadeUp(0.25)}
            className="text-4xl sm:text-6xl md:text-8xl font-black tracking-[-2px] leading-[0.95]"
          >
            Domina la Grieta con <span className="font-serif italic font-normal text-red-500">Nosotros</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p 
            {...fadeUp(0.4)}
            className="text-base sm:text-xl text-gray-300 max-w-2xl font-light leading-relaxed"
          >
            Estadísticas pro-level, análisis en tiempo real y asesoramiento de coach IA directo en tus partidas de League of Legends.
          </motion.p>

          {/* Search Form / Email subscription style */}
          <motion.div 
            {...fadeUp(0.55)}
            ref={searchSectionRef}
            className="w-full max-w-xl"
          >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className={`relative transition-all duration-300 rounded-2xl ${
                focused ? 'shadow-[0_0_30px_rgba(239,68,68,0.25)]' : ''
              }`}>
                <div className="flex items-center rounded-2xl p-1.5 border border-white/[0.08]"
                  style={{
                    background: 'rgba(255,255,255,0.015)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1), 0 8px 32px rgba(0,0,0,0.4)',
                  }}>

                  {/* Region Select */}
                  <div ref={dropRef} className="relative flex-shrink-0 z-30">
                    <button 
                      type="button" 
                      onClick={() => setRegionOpen(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-3 text-sm font-semibold text-gray-300 hover:bg-white/[0.05] rounded-xl transition-all duration-200 min-w-[85px] justify-center"
                    >
                      <span className="text-base">{selectedRegion.flag}</span>
                      <span className="text-xs font-mono">{selectedRegion.label}</span>
                    </button>
                    <AnimatePresence>
                      {regionOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -8, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.96 }}
                          transition={{ duration: 0.15 }}
                          className="absolute top-full left-0 mt-2 w-44 z-[9999] rounded-xl overflow-hidden bg-black/95 border border-white/10 shadow-2xl backdrop-blur-xl"
                        >
                          {REGIONS.map(r => (
                            <button 
                              key={r.value} 
                              type="button"
                              onClick={() => { setRegion(r.value); setValue('region', r.value); setRegionOpen(false); }}
                              className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left transition-colors ${
                                r.value === region ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                              }`}
                            >
                              <span className="text-base">{r.flag}</span>
                              <span className="font-medium">{r.label}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Input Search */}
                  <input
                    ref={inputRef}
                    {...register('riotId')}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder="KisterKata#NA1"
                    autoComplete="off"
                    spellCheck={false}
                    className="flex-1 bg-transparent px-4 py-3 text-white placeholder:text-gray-600 outline-none font-medium text-base sm:text-lg"
                  />

                  {/* Submit Button */}
                  <motion.button 
                    type="submit" 
                    disabled={isSearching}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center justify-center gap-2 px-6 py-3.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all duration-200 flex-shrink-0"
                  >
                    {isSearching ? (
                      <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    ) : (
                      <>
                        <Search className="h-4 w-4" />
                        <span>ANALIZAR</span>
                      </>
                    )}
                  </motion.button>
                </div>
              </div>

              {/* Error validation */}
              {errors.riotId && (
                <p className="text-red-400 text-sm font-medium animate-pulse">{errors.riotId.message}</p>
              )}
              {errorMsg && (
                <p className="text-red-400 text-sm font-medium animate-pulse">{errorMsg}</p>
              )}

              {/* Quick try options */}
              <div className="flex items-center justify-center gap-2 pt-2">
                <span className="text-xs text-gray-500 uppercase tracking-widest font-bold">Probar:</span>
                {QUICK_LOOKUPS.map(q => (
                  <button 
                    key={q} 
                    type="button" 
                    onClick={() => handleQuickFill(q)}
                    className="text-xs px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.02] text-gray-400 hover:text-white hover:border-red-500/40 hover:bg-red-500/10 transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </form>
          </motion.div>
        </div>
      </section>

      {/* 2. "SEARCH HAS CHANGED" SECTION */}
      <section className="relative py-32 md:py-48 px-6 md:px-12 border-t border-white/[0.04] bg-black">
        <div className="max-w-6xl mx-auto text-center space-y-24">
          
          <div className="space-y-6">
            <motion.h2 
              {...fadeUp(0.1)}
              className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-medium tracking-tight"
            >
              Las estadísticas han <span className="font-serif italic font-normal text-red-500">cambiado.</span> ¿Y tú?
            </motion.h2>
            <motion.p 
              {...fadeUp(0.25)}
              className="text-gray-400 text-lg max-w-2xl mx-auto font-light leading-relaxed"
            >
              Las webs convencionales solo te muestran el pasado. ATAK.GG rastrea tus partidas actuales en tiempo real, crea torneos a medida y te entrena mediante IA.
            </motion.p>
          </div>

          {/* 3 Cards Platform Grid */}
          <div className="grid md:grid-cols-3 gap-8 text-left">
            {[
              {
                icon: <BarChart3 className="h-10 w-10 text-red-500" />,
                title: "Live Game Tracker",
                desc: "Análisis instantáneo de cada oponente y aliado en tu partida actual. Conoce sus rachas, campeones predilectos y debilidades al instante."
              },
              {
                icon: <Trophy className="h-10 w-10 text-red-500" />,
                title: "Sistema de Torneos",
                desc: "Crea, administra y compite en torneos competitivos de LoL. Brackets automatizados, estadísticas de partidas de torneo y tablas de clasificación integradas."
              },
              {
                icon: <Zap className="h-10 w-10 text-red-500" />,
                title: "IA Coach Integrado",
                desc: "Un coach personalizado que analiza la partida en segundo plano y te da consejos en vivo sobre builds, posicionamiento y prioridades de objetivos."
              }
            ].map((card, i) => (
              <motion.div 
                key={card.title}
                {...fadeUp(i * 0.15)}
                className="liquid-glass border border-white/[0.05] p-8 rounded-2xl flex flex-col space-y-6 hover:shadow-[0_0_24px_rgba(239,68,68,0.08)] transition-all duration-300"
              >
                <div className="p-3 bg-red-500/10 border border-red-500/20 w-fit rounded-xl">
                  {card.icon}
                </div>
                <div className="space-y-2">
                  <h3 className="font-bold text-lg text-white font-sans">{card.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed font-light">{card.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.p 
            {...fadeUp(0.4)}
            className="text-gray-500 text-sm font-mono tracking-widest uppercase"
          >
            "Si no mejoras en cada partida, alguien más lo hará."
          </motion.p>
        </div>
      </section>

      {/* 3. MISSION SECTION WITH SCROLL REVEAL — transparent so the living
          dagger background reads through behind the word-by-word reveal. */}
      <section ref={missionContainerRef} className="relative py-32 md:py-48 px-6 md:px-12 overflow-hidden border-t border-white/[0.04]">
        {/* Soft scrim keeps the reveal text readable over the moving video */}
        <div className="absolute inset-0 -z-[1] pointer-events-none"
          style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.65) 100%)' }} />
        <div className="max-w-5xl mx-auto flex flex-col items-center space-y-16 relative z-[1]">

          {/* Centered Loop Video */}
          <div className="relative w-full max-w-xl aspect-square rounded-3xl overflow-hidden border border-white/[0.05] shadow-2xl">
            <video 
              autoPlay 
              loop 
              muted 
              playsInline
              className="w-full h-full object-cover"
            >
              <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260325_132944_a0d124bb-eaa1-4082-aa30-2310efb42b4b.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black pointer-events-none" />
          </div>

          {/* Scroll reveal word-by-word content */}
          <div className="space-y-12 text-center md:text-left">
            <ParagraphReveal 
              text="Creamos un espacio donde la competitividad se une con la claridad, donde los jugadores encuentran dirección, los equipos encuentran torneos y cada partida competitiva se convierte en una oportunidad de ascenso."
              highlightWords={["competitividad", "claridad", "dirección", "torneos", "oportunidad", "ascenso"]}
              scrollProgress={scrollYProgress}
              range={[0.1, 0.5]}
            />
            
            <ParagraphReveal 
              text="Una plataforma interactiva en la web y compañera in-game donde los datos de Riot, la comunidad y los consejos de inteligencia artificial fluyen sin fricciones. Menos ruido, más ELO."
              highlightWords={["plataforma", "in-game", "riot", "inteligencia", "artificial", "fricciones", "elo"]}
              scrollProgress={scrollYProgress}
              range={[0.5, 0.9]}
            />
          </div>
        </div>
      </section>

      {/* 4. SOLUTION SECTION */}
      <section className="py-32 md:py-48 px-6 md:px-12 border-t border-white/[0.04] bg-black">
        <div className="max-w-6xl mx-auto space-y-16">
          
          <div className="space-y-4">
            <span className="text-xs font-bold tracking-[4px] uppercase text-red-500">SOLUCIÓN INTEGRAL</span>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-black leading-tight">
              La plataforma definitiva para el juego <span className="font-serif italic font-normal text-red-500">competitivo</span>
            </h2>
          </div>

          {/* Panoramic Solutions Video */}
          <div className="relative w-full aspect-[2.4/1] rounded-3xl overflow-hidden border border-white/[0.05] shadow-2xl">
            <video 
              autoPlay 
              loop 
              muted 
              playsInline
              className="w-full h-full object-cover"
            >
              <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260325_125119_8e5ae31c-0021-4396-bc08-f7aebeb877a2.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black pointer-events-none" />
          </div>

          {/* 4 Column Feature Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                title: "Live Game Overlay",
                desc: "Overlay in-game que te muestra de forma limpia y transparente las estadísticas clave de los rivales sin salir del juego."
              },
              {
                title: "Bracket Maker",
                desc: "Sistema avanzado de torneos para crear ligas, fases eliminatorias y llaves competitivas de forma automatizada."
              },
              {
                title: "Coach de Partidas IA",
                desc: "Análisis predictivo de la partida en tiempo real que te alerta cuando debes pelear, rotar o prepararte para dragón/barón."
              },
              {
                title: "Estadísticas Premium",
                desc: "Rastreador de rendimiento global que genera gráficos fluidos con tus winrates, campeones preferidos y evolución competitiva."
              }
            ].map((feat, i) => (
              <motion.div 
                key={feat.title}
                {...fadeUp(i * 0.1)}
                className="space-y-3 p-4 rounded-xl border border-white/[0.02] bg-white/[0.01]"
              >
                <h3 className="font-bold text-base text-white font-mono flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                  {feat.title}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed font-light">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. CTA SECTION WITH HLS STREAMING VIDEO */}
      <section className="relative py-40 md:py-56 px-6 text-center overflow-hidden border-t border-white/[0.04]">
        
        {/* HLS Video Background */}
        <video 
          ref={hlsVideoRef}
          loop 
          muted 
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0 opacity-40 pointer-events-none"
        />

        {/* Overlay dark */}
        <div className="absolute inset-0 bg-black/70 z-[1] pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center space-y-8">
          
          {/* Logo concentric circles */}
          <div className="w-12 h-12 rounded-full border-2 border-red-500/50 flex items-center justify-center p-2 bg-black/60">
            <div className="w-6 h-6 rounded-full border border-red-500 bg-red-500/20 animate-pulse" />
          </div>

          <h2 className="text-4xl sm:text-6xl md:text-7xl font-bold font-sans">
            Comienza tu <span className="font-serif italic font-normal text-red-500">Ascenso</span>
          </h2>
          
          <p className="text-gray-300 text-base sm:text-lg max-w-lg font-light leading-relaxed">
            Busca tus estadísticas en la web o descarga el Companion App de ATAK para recibir consejos en tiempo real mientras juegas.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 justify-center w-full">
            <motion.button 
              onClick={scrollToSearch}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="w-full sm:w-auto px-8 py-3.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-[0_0_24px_rgba(239,68,68,0.3)] transition-all"
            >
              Buscar Invocador
            </motion.button>
            
            <motion.button 
              onClick={() => navigate('/stats')}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="w-full sm:w-auto px-8 py-3.5 liquid-glass text-white font-bold rounded-xl border border-white/[0.1] hover:bg-white/[0.05] transition-all"
            >
              Ver Estadísticas
            </motion.button>
          </div>
        </div>
      </section>

      {/* 6. FOOTER */}
      <footer className="py-16 px-6 md:px-12 border-t border-white/[0.04] bg-black">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-sm text-gray-500 font-mono flex items-center gap-3">
            <span>© 2026 ATAK.GG. Todos los derechos reservados.</span>
          </div>
          
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <a href="#" className="hover:text-white transition-colors">Privacidad</a>
            <a href="#" className="hover:text-white transition-colors">Términos</a>
            <a href="#" className="hover:text-white transition-colors">Contacto</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
