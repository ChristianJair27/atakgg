// src/pages/SummonerPage.tsx — Live game detection + premium stats redesign
import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { axiosInstance } from '@/lib/axios';
import { useChampions, useStaticData } from '@/hooks/use-ddragon';
import { MatchRow } from '@/components/MatchRow';
import { ProfileComments } from '@/components/ProfileComments';
import LiveGameVisualizer from '@/components/LiveGameVisualizer';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Swords, Target, TrendingUp, Shield, Star,
  ChevronDown, Trophy, Zap, Crown, BarChart3,
  Flame, Clock, Users, ChevronUp, X,
  RefreshCw, AlertCircle, Play, Copy, Check, ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

gsap.registerPlugin(ScrollTrigger);

// ─── Types ────────────────────────────────────────────────────────────────────
type Platform  = 'la1'|'la2'|'na1'|'br1'|'oc1'|'euw1'|'eun1'|'tr1'|'ru'|'jp1'|'kr';
type Continent = 'americas'|'europe'|'asia';

const platformToContinent = (p: Platform): Continent =>
  ['la1','la2','na1','br1','oc1'].includes(p) ? 'americas' :
  ['euw1','eun1','tr1','ru'].includes(p) ? 'europe' : 'asia';

const normalizePlatform = (s?: string): Platform | undefined => {
  if (!s) return undefined;
  const m: Record<string,Platform> = {
    lan:'la1', la1:'la1', las:'la2', la2:'la2', na:'na1', na1:'na1',
    br:'br1', br1:'br1', euw:'euw1', euw1:'euw1', eune:'eun1', eun1:'eun1',
    kr:'kr', jp:'jp1', jp1:'jp1',
  };
  return m[s.toLowerCase()] || s as Platform;
};

const splitRiotId = (s: string) => {
  const [gameName='', tagLine=''] = decodeURIComponent(s).split('#');
  return { gameName, tagLine };
};

// ─── DDragon helpers ──────────────────────────────────────────────────────────
const TIER_COLORS: Record<string,string> = {
  IRON:'#a08070', BRONZE:'#cd7f32', SILVER:'#c0c0c0', GOLD:'#ffd700',
  PLATINUM:'#4dd0c0', EMERALD:'#50c878', DIAMOND:'#88ccff',
  MASTER:'#9966cc', GRANDMASTER:'#ff6633', CHALLENGER:'#f4c430',
};
const RANKED_EMBLEM = (tier?: string) =>
  tier ? `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${tier.toLowerCase()}.png` : '';

const getSplashUrl = (slug: string, skin: number) =>
  `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${slug}_${skin}.jpg`;
const getTileUrl = (slug: string, skin: number) =>
  `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${slug}_${skin}.jpg`;

const SPELL_KEYS: Record<number,string> = {
  1:'SummonerBoost',3:'SummonerExhaust',4:'SummonerFlash',6:'SummonerHaste',
  7:'SummonerHeal',11:'SummonerSmite',12:'SummonerTeleport',14:'SummonerDot',
  21:'SummonerBarrier',32:'SummonerSnowball',
};



// (Old champion card removed)

function GlassCard({ children, className='', accent=false }: {
  children: React.ReactNode; className?: string; accent?: boolean;
}) {
  return (
    <div className={`liquid-glass rounded-2xl border border-white/[0.05] hover:border-white/10 transition-all duration-300 ${className}`}>
      {children}
    </div>
  );
}

// ─── Rank Card ────────────────────────────────────────────────────────────────
function RankCard({ rank, label }: { rank: any; label: string }) {
  const tier  = rank?.tier;
  const color = TIER_COLORS[tier] || '#555';
  const wr    = rank ? Math.round(rank.wins / Math.max((rank.wins||0)+(rank.losses||0),1) * 100) : null;
  const lpBar = rank ? Math.min((rank.lp / 100) * 100, 100) : 0;

  return (
    <GlassCard className="p-5 overflow-hidden" accent={!!tier}>
      {tier && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 80% 50%, ${color}12 0%, transparent 70%)` }} />
      )}
      <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 mb-4 font-mono">{label}</p>
      {tier ? (
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <img src={RANKED_EMBLEM(tier)} alt={tier}
              className="w-16 h-16 object-contain"
              style={{ filter: `drop-shadow(0 0 12px ${color}60)` }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-black text-lg leading-tight" style={{ color }}>{tier} {rank.rank}</div>
            <div className="text-white font-bold text-sm">{rank.lp} LP</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${lpBar}%`, background: color }} />
              </div>
              <span className="text-xs font-mono text-gray-500">{rank.lp}/100</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs">
              <span className="text-green-400 font-bold">{rank.wins}V</span>
              <span className="text-red-400 font-bold">{rank.losses}D</span>
              <span style={{ color: wr! >= 50 ? '#4ade80' : '#f87171' }} className="font-black ml-auto">
                {wr}% WR
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-gray-700">
          <Shield className="h-12 w-12 opacity-20" />
          <div>
            <div className="font-bold text-gray-500">Sin clasificar</div>
            <div className="text-xs text-gray-700 mt-0.5">Juega partidas clasificatorias</div>
          </div>
        </div>
      )}
    </GlassCard>
  );
}

// ─── Stat Pill ────────────────────────────────────────────────────────────────
function StatPill({ label, value, sub, icon, color='text-white', trend }: {
  label: string; value: string|number; sub?: string;
  icon: React.ReactNode; color?: string; trend?: 'up'|'down'|null;
}) {
  return (
    <GlassCard className="p-4 flex flex-col gap-2 hover:border-white/10 transition-all group" accent>
      <div className="flex items-center justify-between">
        <div className="p-2 rounded-xl bg-white/[0.05] border border-white/[0.06] group-hover:bg-white/[0.08] transition-colors">
          <div className="text-white/50 h-4 w-4">{icon}</div>
        </div>
        {trend && (
          <div className={`text-[10px] font-bold flex items-center gap-0.5 ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
            {trend === 'up' ? '↑' : '↓'}
          </div>
        )}
      </div>
      <div>
        <p className="text-[10px] text-gray-600 uppercase tracking-[0.15em] font-mono">{label}</p>
        <p className={`text-2xl font-black mt-0.5 ${color}`}>{value}</p>
        {sub && <p className="text-xs text-gray-600 mt-0.5 font-mono">{sub}</p>}
      </div>
    </GlassCard>
  );
}

// ─── Champion stat row ────────────────────────────────────────────────────────
function ChampStatRow({ champKey, stats, champs, rank }: {
  champKey: string; stats: any; champs: any; rank: number;
}) {
  const champ = champs?.byKey?.[champKey];
  const wr    = Number(stats.winRate) || 0;
  const kda   = Number(stats.kda) || 0;
  const wrW = Math.min(wr, 100);

  const wrColor = wr >= 60 ? '#4ade80' : wr >= 50 ? '#93c5fd' : '#f87171';
  const kdaColor = kda >= 4 ? '#fbbf24' : kda >= 3 ? '#4ade80' : '#9ca3af';

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:border-red-500/20 hover:bg-red-500/[0.03] transition-all group">
      {/* Rank + champion icon */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs font-mono text-gray-700 w-4 text-right">{rank}</span>
        <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-white/10 group-hover:border-red-500/30 transition flex-shrink-0">
          {champ?.image
            ? <img src={champ.image} alt={champ.name} className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gray-900 flex items-center justify-center text-xs text-gray-600">{champKey}</div>
          }
        </div>
      </div>

      {/* Name + games */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-white text-sm truncate">{champ?.name || '?'}</div>
        <div className="text-[10px] text-gray-600 font-mono">{stats.games} partidas</div>
      </div>

      {/* WR bar */}
      <div className="w-24 hidden sm:block">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono" style={{ color: wrColor }}>{wr}%</span>
        </div>
        <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${wrW}%`, background: wrColor }} />
        </div>
      </div>

      {/* KDA */}
      <div className="text-right flex-shrink-0">
        <div className="text-sm font-black" style={{ color: kdaColor }}>{kda.toFixed(2)}</div>
        <div className="text-[10px] text-gray-600 font-mono">KDA</div>
      </div>

      {/* WR pill on mobile */}
      <div className="sm:hidden text-sm font-black" style={{ color: wrColor }}>{wr}%</div>
    </div>
  );
}

// ─── AI Tag ───────────────────────────────────────────────────────────────────
function AITag({ tag }: { tag: any }) {
  const text = typeof tag === 'string' ? tag : tag?.Label || tag?.Value || JSON.stringify(tag);
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm
      bg-white/[0.04] border border-white/10 text-white/70 backdrop-blur-sm
      hover:border-white/20 transition-colors cursor-default">
      <Zap className="h-3 w-3 text-white/40 flex-shrink-0" />
      {text}
    </span>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ icon, label, right }: { icon: React.ReactNode; label: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="text-white/40">{icon}</div>
        <h2 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-mono font-bold">{label}</h2>
      </div>
      {right}
    </div>
  );
}

// ─── Fade section ─────────────────────────────────────────────────────────────
function FadeSection({ children, className='' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(ref.current, { opacity: 0, y: 32 }, {
      opacity: 1, y: 0, duration: 0.7, ease: 'power2.out',
      scrollTrigger: { trigger: ref.current, start: 'top 88%', once: true },
    });
  }, []);
  return <div ref={ref} className={className}>{children}</div>;
}


// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SummonerPage() {
  const { region, riotId } = useParams<{ region:string; riotId:string }>();
  const { state }          = useLocation() as { state?: { puuid?: string } };
  const { data: champs }   = useChampions();
  const staticData         = useStaticData();

  const platform  = normalizePlatform(region);
  const continent = platform ? platformToContinent(platform) : 'americas' as Continent;
  const { gameName, tagLine } = splitRiotId(riotId || '');

  const scrollRef = useRef<HTMLDivElement>(null);
  const heroRef   = useRef<HTMLDivElement>(null);

  const [puuid,         setPuuid]         = useState<string|undefined>(state?.puuid);
  const [summary,       setSummary]       = useState<any>(null);
  const [matchHistory,  setMatchHistory]  = useState<any[]>([]);
  const [championStats, setChampionStats] = useState<any>(null);
  const [isLoading,     setIsLoading]     = useState(true);
  const [matchCount,    setMatchCount]    = useState(10);
  const [loadingMore,   setLoadingMore]   = useState(false);
  const [aiTags,        setAiTags]        = useState<string[]>([]);
  const [liveGame,      setLiveGame]      = useState<any>(null);
  const [liveChecked,   setLiveChecked]   = useState(false);
  const [liveStatus,    setLiveStatus]    = useState<'checking'|'live'|'offline'|'error'>('checking');
  const [selectedSkin,  setSelectedSkin]  = useState(0);
  const [mousePar,      setMousePar]      = useState({ x: 0, y: 0 });

  // ── GSAP hero entrance ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!heroRef.current || isLoading) return;
    gsap.fromTo(heroRef.current.querySelectorAll('[data-gsap]'),
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.7, stagger: 0.1, ease: 'power2.out', delay: 0.15 }
    );
  }, [isLoading]);

  // ── Mouse parallax for hero splash ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setMousePar({
        x: (e.clientX / window.innerWidth  - 0.5),
        y: (e.clientY / window.innerHeight - 0.5),
      });
    };
    window.addEventListener('mousemove', handler, { passive: true });
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  // ── Resolve PUUID ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (puuid || !platform || !gameName || !tagLine) return;
    const ac = new AbortController();
    axiosInstance.get('/api/stats/resolve', { params:{ region:platform, gameName, tagLine }, signal:ac.signal })
      .then(({ data }) => setPuuid(data.puuid))
      .catch(() => {});
    return () => ac.abort();
  }, [puuid, platform, gameName, tagLine]);

  // ── Fetch summary + champion stats ──────────────────────────────────────────
  useEffect(() => {
    if (!puuid || !platform) return;
    setIsLoading(true);
    const ac = new AbortController();
    Promise.all([
      axiosInstance.get(`/api/stats/summary/${platform}/${puuid}`, { signal:ac.signal }),
      axiosInstance.get(`/api/stats/champion-stats/${platform}/${puuid}`, { params:{ count:20 }, validateStatus:()=>true, signal:ac.signal }),
    ]).then(([s, c]) => {
      setSummary(s.data);
      setChampionStats(c.status === 200 ? c.data : null);
    }).catch(() => {}).finally(() => setIsLoading(false));
    return () => ac.abort();
  }, [puuid, platform]);

  // ── Check live game ─────────────────────────────────────────────────────────
  const checkLiveGame = useCallback(async (pid: string, plat: string) => {
    setLiveStatus('checking');
    try {
      // Uses the reliable spectator lookup (by-summoner fallback under the hood for higher success rate)
      const { data, status } = await axiosInstance.get(`/api/stats/spectator/${plat}/${pid}`, {
        params: { rank: 0 },
        validateStatus: (s) => s < 500,
        timeout: 12000,
      });

      console.log('[ATAK Live Check]', { 
        status, 
        hasParticipants: Array.isArray(data?.participants) && data.participants.length > 0, 
        gameMode: data?.gameMode,
        platformUsed: data?.platformUsed 
      });

      if (status === 200 && Array.isArray(data?.participants) && data.participants.length > 0) {
        const gameLength = data.gameLength ??
          (data.gameStartTime ? Math.floor((Date.now() - data.gameStartTime) / 1000) : 0);
        setLiveGame({ ...data, gameLength, inGame: true });
        setLiveStatus('live');
      } else if (status === 204) {
        setLiveStatus('offline');
      } else if (status === 404) {
        // Detailed 404 from new probing logic
        console.warn('[ATAK Live Check] 404 from backend (full probe failed)', data);
        // Still treat as offline for the UI (no game detected after thorough check)
        setLiveStatus('offline');
      } else {
        console.warn('[ATAK Live Check] Unexpected response for live game', { status, data });
        setLiveStatus('offline');
      }
    } catch (e: any) {
      console.warn('[ATAK Live Check] Error (backend may be down):', e?.message);
      setLiveStatus('offline'); // Don't show scary error if just no backend or network
    } finally {
      setLiveChecked(true);
    }
  }, []);

  useEffect(() => {
    if (!puuid || !platform) return;
    checkLiveGame(puuid, platform);
  }, [puuid, platform, checkLiveGame]);

  // ── Fetch matches ───────────────────────────────────────────────────────────
  const fetchMatches = useCallback(async (count: number) => {
    if (!puuid || !platform) return;
    try {
      const { data: ids } = await axiosInstance.get(`/api/stats/matches/${continent}/${puuid}/ids`, { params:{ count } });
      const settled = await Promise.allSettled(
        (ids || []).slice(0, count).map((mid: string) =>
          axiosInstance.get(`/api/stats/matches/${continent}/${mid}`, { params:{ puuid } })
        )
      );
      setMatchHistory(settled
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map(r => r.value.data));
    } catch {}
  }, [puuid, platform, continent]);

  useEffect(() => { fetchMatches(matchCount); }, [puuid, platform]);

  const loadMore = async () => {
    setLoadingMore(true);
    const n = matchCount + 10;
    setMatchCount(n);
    await fetchMatches(n);
    setLoadingMore(false);
  };

  // ── Computed stats ──────────────────────────────────────────────────────────
  const overallStats = useMemo(() => {
    if (!matchHistory.length) return null;
    const n    = matchHistory.length;
    const wins = matchHistory.filter(m => m.win).length;
    const avgK = matchHistory.reduce((s,m) => s+m.kills, 0)/n;
    const avgD = matchHistory.reduce((s,m) => s+m.deaths, 0)/n;
    const avgA = matchHistory.reduce((s,m) => s+m.assists, 0)/n;
    const avgCS= matchHistory.reduce((s,m) => s+(m.totalMinionsKilled||0)+(m.neutralMinionsKilled||0), 0)/n;
    return {
      totalGames:n, wins, losses:n-wins,
      winRate:Math.round(wins/n*100),
      avgKills:avgK.toFixed(1), avgDeaths:avgD.toFixed(1), avgAssists:avgA.toFixed(1),
      avgKDA:((avgK+avgA)/Math.max(avgD,1)).toFixed(2),
      avgCS:avgCS.toFixed(1),
    };
  }, [matchHistory]);

  const mainRank = useMemo(() =>
    summary?.rank?.find((r:any) => r.queue==='RANKED_SOLO_5x5') || summary?.rank?.[0] || null,
    [summary]);
  const flexRank = useMemo(() =>
    summary?.rank?.find((r:any) => r.queue==='RANKED_TEAM_5x5' || r.queue==='RANKED_FLEX_SR') || null,
    [summary]);

  const topChampKey = useMemo(() => {
    if (!championStats) return undefined;
    return (Object.entries(championStats) as [string,any][])
      .sort((a,b) => b[1].games - a[1].games)[0]?.[0];
  }, [championStats]);

  const topChampData = topChampKey ? champs?.byKey?.[topChampKey] : undefined;
  const version      = champs?.version ?? '14.24.1';

  const profileIconUrl = summary?.summoner?.profileIconId && version
    ? `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${summary.summoner.profileIconId}.png`
    : null;

  // ── AI tags ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!summary || !matchHistory.length || !championStats) return;
    const topChamps = Object.entries(championStats||{}).slice(0,3)
      .map(([id,s]: [string,any]) => `${champs?.byKey?.[id]?.name||id} (${Number(s.winRate)||0}%WR)`)
      .join(', ');
    axiosInstance.post('/api/ai-insights', {
      riotId:`${gameName}#${tagLine}`, region:platform?.toUpperCase(),
      stats:{
        rank: mainRank ? `${mainRank.tier} ${mainRank.rank}` : 'Unranked',
        winRate:overallStats?.winRate, kda:overallStats?.avgKDA,
        mostPlayed:topChamps, totalGames:matchHistory.length,
      },
    }).then(({ data }) => {
      try { setAiTags(JSON.parse(data.insights) || []); } catch { setAiTags([]); }
    }).catch(() => setAiTags([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary?.summoner?.name, championStats, matchHistory.length]);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
        <p className="text-gray-500 text-sm font-mono">Cargando perfil…</p>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div ref={scrollRef} className="min-h-screen bg-black text-white overflow-x-hidden">

      {/* Ambient background */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0" style={{ background:'radial-gradient(ellipse at 50% 0%,rgba(120,10,10,0.22) 0%,transparent 55%)' }} />
        <div className="absolute inset-0 opacity-[0.035]"
          style={{ backgroundImage:'radial-gradient(circle,#fff 1px,transparent 1px)', backgroundSize:'40px 40px' }} />
      </div>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <div className="relative h-[88vh] overflow-hidden" ref={heroRef}>

        {/* Champion splash — full native resolution, no WebGL */}
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={getSplashUrl(topChampData?.id || 'Katarina', selectedSkin)}
            alt=""
            className="absolute w-full h-full object-cover"
            style={{
              objectPosition: '65% 15%',
              transform: `scale(1.07) translate(${mousePar.x * -14}px, ${mousePar.y * -9}px)`,
              transition: 'transform 150ms linear',
            }}
            onError={(e) => {
              if (selectedSkin !== 0) setSelectedSkin(0);
              else (e.target as HTMLImageElement).src = 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Katarina_0.jpg';
            }}
          />
        </div>

        {/* Left gradient — darkens left side for text readability */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to right, #050505 16%, rgba(5,5,5,0.85) 36%, rgba(5,5,5,0.22) 58%, transparent 78%)' }} />

        {/* Bottom fade — blends into page background */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to top, #050505 0%, rgba(5,5,5,0.6) 14%, transparent 42%)' }} />

        {/* Top darkening — softens header area */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 20%)' }} />

        {/* Champion name watermark */}
        {topChampData?.name && (
          <div className="absolute right-0 top-1/2 -translate-y-[55%] pr-5 pointer-events-none select-none overflow-hidden">
            <span
              className="block font-black uppercase leading-none text-white"
              style={{
                fontSize: 'clamp(4.5rem, 15vw, 15rem)',
                letterSpacing: '-3px',
                opacity: 0.045,
                lineHeight: 0.88,
              }}
            >
              {topChampData.name}
            </span>
          </div>
        )}

        {/* Skin selector — bottom right */}
        {topChampData?.id && (
          <div className="absolute bottom-14 right-6 flex items-center gap-1.5 z-10">
            <span className="text-white/20 text-[9px] font-mono uppercase tracking-widest mr-0.5">SKIN</span>
            {Array.from({ length: 9 }, (_, i) => (
              <button
                key={i}
                onClick={() => setSelectedSkin(i)}
                className={`relative overflow-hidden rounded transition-all duration-200 ${
                  selectedSkin === i
                    ? 'ring-1 ring-white/75 scale-110 opacity-100'
                    : 'opacity-35 hover:opacity-65'
                }`}
                style={{ width: 44, height: 27 }}
              >
                <img
                  src={getTileUrl(topChampData.id, i)}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const btn = (e.target as HTMLImageElement).closest('button');
                    if (btn) btn.style.display = 'none';
                  }}
                />
              </button>
            ))}
          </div>
        )}

        {/* Player info */}
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-10">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row items-start md:items-end gap-5">

              {/* Avatar */}
              <div data-gsap className="relative flex-shrink-0">
                {profileIconUrl ? (
                  <img src={profileIconUrl} alt=""
                    className="w-20 h-20 md:w-24 md:h-24 rounded-2xl border border-white/20 shadow-[0_0_28px_rgba(255,255,255,0.08)]" />
                ) : (
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-white/[0.06] border border-white/15" />
                )}
                <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap
                  px-3 py-0.5 rounded-full bg-black/90 border border-white/10 text-[10px] font-mono font-bold text-gray-300">
                  Nv. {summary?.summoner?.level || '?'}
                </div>
                {liveStatus === 'live' && (
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 border-2 border-black flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  </div>
                )}
                {liveStatus === 'checking' && (
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white/20 border-2 border-black flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full border border-white border-t-transparent animate-spin" />
                  </div>
                )}
              </div>

              {/* Name + badges */}
              <div data-gsap className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {liveGame && (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/25 border border-red-500/50 text-red-400 text-[10px] font-black uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />EN VIVO
                    </span>
                  )}
                </div>
                <h1 className="font-medium leading-none tracking-[-1px]" style={{ fontSize: 'clamp(2rem,6vw,4rem)' }}>
                  <span className="text-white">{summary?.summoner?.name || gameName}</span>
                  <span className="text-white/30 font-light text-xl ml-1">#{tagLine}</span>
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                  <Badge className="bg-white/[0.07] border border-white/10 text-gray-300 text-xs px-3 py-1 font-mono">
                    {platform?.toUpperCase()}
                  </Badge>
                  {mainRank && (
                    <Badge className="px-3 py-1 border font-semibold text-xs"
                      style={{ background: `${TIER_COLORS[mainRank.tier]}15`, borderColor: `${TIER_COLORS[mainRank.tier]}40`, color: TIER_COLORS[mainRank.tier] }}>
                      <img src={RANKED_EMBLEM(mainRank.tier)} alt="" className="w-4 h-4 mr-1 object-contain" />
                      {mainRank.tier} {mainRank.rank} · {mainRank.lp} LP
                    </Badge>
                  )}
                  {topChampData && (
                    <Badge className="bg-white/[0.05] border-white/10 text-gray-400 px-3 py-1 text-xs">
                      <img src={topChampData.image} alt="" className="w-3.5 h-3.5 mr-1 rounded-sm object-cover" />
                      Main: {topChampData.name}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/20 animate-bounce">
          <span className="text-[10px] font-mono uppercase tracking-widest">Scroll</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* ── CONTENT ──────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 pb-32 space-y-10 pt-6">

        {/* ── LIVE GAME — shown first if in-game ─────────────────────────── */}
        <FadeSection>
          <SectionHeader
            icon={<Flame className="h-4 w-4" />}
            label="Partida en vivo"
            right={
              <button
                onClick={() => puuid && platform && checkLiveGame(puuid, platform)}
                className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-white transition-colors px-2 py-1 rounded border border-white/[0.06] hover:border-white/20"
              >
                <RefreshCw className={`h-3 w-3 ${liveStatus === 'checking' ? 'animate-spin' : ''}`} />
                {liveStatus === 'checking' ? 'Verificando…' : 'Actualizar'}
              </button>
            }
          />

          {liveStatus === 'checking' && !liveGame && (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/[0.04]">
              <div className="w-4 h-4 rounded-full border-2 border-yellow-400 border-t-transparent animate-spin flex-shrink-0" />
              <span className="text-sm text-yellow-400/80 font-mono">Verificando si está en partida…</span>
            </div>
          )}

          {liveStatus === 'offline' && (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <div className="w-2 h-2 rounded-full bg-gray-600 flex-shrink-0" />
              <span className="text-sm text-gray-600">No está en partida ahora mismo</span>
            </div>
          )}

          {liveStatus === 'error' && (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-red-900/30 bg-red-500/[0.04]">
              <AlertCircle className="h-4 w-4 text-red-500/60 flex-shrink-0" />
              <div>
                <span className="text-sm text-red-400/80">No se pudo verificar la partida</span>
                <span className="text-xs text-gray-600 block mt-0.5">
                  Error 500 del servidor. Revisa la consola del backend y del navegador (F12). 
                  Es posible que haya un problema con la key de Riot o rate limits.
                </span>
              </div>
            </div>
          )}

          {liveStatus === 'live' && liveGame && (
            <LiveGameVisualizer
              liveGame={liveGame}
              champs={champs}
              version={version}
              runes={staticData.runes}
              spells={staticData.spells}
              myRiotId={`${gameName}#${tagLine}`}
              platform={platform || 'la1'}
              onRefresh={() => puuid && platform && checkLiveGame(puuid, platform)}
              isRefreshing={liveStatus === 'checking'}
            />
          )}
        </FadeSection>

        {/* ── RANK ───────────────────────────────────────────────────────── */}
        <FadeSection>
          <SectionHeader icon={<Shield className="h-4 w-4" />} label="Ranked" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <RankCard rank={mainRank} label="Solo / Duo" />
            <RankCard rank={flexRank} label="Flex 5v5" />
          </div>
        </FadeSection>

        {/* ── QUICK STATS ────────────────────────────────────────────────── */}
        {overallStats && (
          <FadeSection>
            <SectionHeader icon={<BarChart3 className="h-4 w-4" />}
              label={`Últimas ${overallStats.totalGames} partidas`}
              right={<span className="text-xs font-mono text-gray-700">{overallStats.wins}V {overallStats.losses}D</span>}
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatPill label="Win Rate" value={`${overallStats.winRate}%`}
                sub={`${overallStats.wins}V ${overallStats.losses}D`}
                icon={<TrendingUp className="h-4 w-4" />}
                color={overallStats.winRate >= 55 ? 'text-green-400' : overallStats.winRate >= 50 ? 'text-blue-300' : 'text-red-400'} />
              <StatPill label="KDA" value={overallStats.avgKDA}
                sub={`${overallStats.avgKills}/${overallStats.avgDeaths}/${overallStats.avgAssists}`}
                icon={<Swords className="h-4 w-4" />}
                color={Number(overallStats.avgKDA) >= 3 ? 'text-yellow-400' : 'text-white'} />
              <StatPill label="CS/min" value={overallStats.avgCS}
                icon={<Target className="h-4 w-4" />} />
              <StatPill label="Partidas" value={overallStats.totalGames}
                icon={<Crown className="h-4 w-4" />} />
            </div>
          </FadeSection>
        )}

        {/* ── PERFORMANCE TIMELINE ───────────────────────────────────────── */}
        {matchHistory.length >= 5 && (
          <FadeSection>
            <SectionHeader
              icon={<TrendingUp className="h-4 w-4" />}
              label="Últimas partidas"
              right={
                (() => {
                  let streak = 0;
                  const isWin = matchHistory[0]?.win;
                  for (const m of matchHistory) { if (m.win === isWin) streak++; else break; }
                  return (
                    <span className={`text-xs font-mono font-bold ${isWin ? 'text-green-400' : 'text-red-400'}`}>
                      {isWin ? `${streak} WIN STREAK` : `${streak} LOSS STREAK`}
                    </span>
                  );
                })()
              }
            />
            {/* Win/loss blocks */}
            <div className="flex gap-1 flex-wrap mb-3">
              {matchHistory.map((m, i) => (
                <div
                  key={i}
                  title={m.win ? 'Victoria' : 'Derrota'}
                  className={`w-5 h-5 rounded-sm transition-all ${m.win ? 'bg-green-500/70 hover:bg-green-400' : 'bg-red-500/50 hover:bg-red-400'}`}
                />
              ))}
            </div>
            {/* Rolling WR every 5 games */}
            {matchHistory.length >= 10 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono text-white/20 uppercase tracking-widest">WR por bloque</span>
                {Array.from({ length: Math.floor(matchHistory.length / 5) }, (_, i) => {
                  const block = matchHistory.slice(i * 5, i * 5 + 5);
                  const wr = Math.round(block.filter(m => m.win).length / 5 * 100);
                  return (
                    <span key={i} className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${wr >= 60 ? 'text-green-400 border-green-500/30 bg-green-500/[0.07]' : wr >= 50 ? 'text-white/60 border-white/10' : 'text-red-400 border-red-500/30 bg-red-500/[0.07]'}`}>
                      {wr}%
                    </span>
                  );
                })}
              </div>
            )}
          </FadeSection>
        )}

        {/* ── DAMAGE & PARTICIPATION ──────────────────────────────────────── */}
        {matchHistory.length > 0 && (() => {
          const withDmg  = matchHistory.filter(m => m.totalDamageDealtToChampions);
          const withKp   = matchHistory.filter(m => m.killParticipation != null);
          const withGold = matchHistory.filter(m => m.gold);
          const avgDmg   = withDmg.length  ? Math.round(withDmg.reduce((s, m) => s + (m.totalDamageDealtToChampions ?? 0), 0) / withDmg.length) : null;
          const avgKp    = withKp.length   ? Math.round(withKp.reduce((s, m) => s + (m.killParticipation ?? 0), 0) / withKp.length * 100) : null;
          const avgGold  = withGold.length ? Math.round(withGold.reduce((s, m) => s + (m.gold ?? 0), 0) / withGold.length) : null;
          const pentas   = matchHistory.filter(m => (m.largestMultiKill ?? 0) >= 5).length;
          const quadras  = matchHistory.filter(m => (m.largestMultiKill ?? 0) === 4).length;
          const triples  = matchHistory.filter(m => (m.largestMultiKill ?? 0) === 3).length;
          const doubles  = matchHistory.filter(m => (m.largestMultiKill ?? 0) === 2).length;
          if (!avgDmg && !avgKp) return null;
          return (
            <FadeSection>
              <SectionHeader icon={<Flame className="h-4 w-4" />} label="Daño & Participación" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {avgDmg && (
                  <GlassCard className="p-4">
                    <p className="text-[10px] text-white/25 uppercase tracking-widest font-mono mb-1">Daño/partida</p>
                    <p className="text-xl font-black text-white">{avgDmg.toLocaleString()}</p>
                  </GlassCard>
                )}
                {avgKp && (
                  <GlassCard className="p-4">
                    <p className="text-[10px] text-white/25 uppercase tracking-widest font-mono mb-1">Kill Part.</p>
                    <p className={`text-xl font-black ${avgKp >= 65 ? 'text-green-400' : avgKp >= 50 ? 'text-white' : 'text-white/60'}`}>{avgKp}%</p>
                  </GlassCard>
                )}
                {avgGold && (
                  <GlassCard className="p-4">
                    <p className="text-[10px] text-white/25 uppercase tracking-widest font-mono mb-1">Oro/partida</p>
                    <p className="text-xl font-black text-yellow-400">{(avgGold / 1000).toFixed(1)}k</p>
                  </GlassCard>
                )}
                {(pentas + quadras + triples + doubles) > 0 && (
                  <GlassCard className="p-4">
                    <p className="text-[10px] text-white/25 uppercase tracking-widest font-mono mb-1">Multikills</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                      {pentas  > 0 && <span className="text-xs font-bold text-pink-400">{pentas}  Penta</span>}
                      {quadras > 0 && <span className="text-xs font-bold text-purple-400">{quadras} Quadra</span>}
                      {triples > 0 && <span className="text-xs font-bold text-orange-300">{triples} Triple</span>}
                      {doubles > 0 && <span className="text-xs font-mono text-white/40">{doubles} Doble</span>}
                    </div>
                  </GlassCard>
                )}
              </div>
            </FadeSection>
          );
        })()}

        {/* ── AI TAGS ────────────────────────────────────────────────────── */}
        {aiTags.length > 0 && (
          <FadeSection>
            <SectionHeader icon={<Zap className="h-4 w-4" />} label="Análisis IA" />
            <div className="flex flex-wrap gap-2">
              {aiTags.map((tag, i) => <AITag key={i} tag={tag} />)}
            </div>
          </FadeSection>
        )}

        {/* ── MASTERY ────────────────────────────────────────────────────── */}
        {summary?.masteryTop?.length > 0 && (
          <FadeSection>
            <SectionHeader icon={<Star className="h-4 w-4 text-yellow-400" />} label="Maestría" />
            <div className="flex gap-3 flex-wrap">
              {summary.masteryTop.slice(0,8).map((m: any, i: number) => {
                const c = champs?.byKey?.[String(m.championId)];
                return (
                  <GlassCard key={i} className="p-3 flex flex-col items-center gap-2 w-20 hover:border-yellow-500/25 transition-all group">
                    <div className="relative">
                      {c?.image
                        ? <img src={c.image} alt={c.name} className="w-11 h-11 rounded-xl border border-yellow-500/15 group-hover:border-yellow-500/40 transition" />
                        : <div className="w-11 h-11 rounded-xl bg-gray-900" />
                      }
                      <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-gradient-to-br from-yellow-600 to-yellow-800 border border-yellow-500 flex items-center justify-center text-[9px] font-black text-white">
                        {m.level}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-white font-semibold truncate w-full">{c?.name || '?'}</div>
                      <div className="text-[9px] text-yellow-500 font-mono">{(m.points/1000).toFixed(1)}k</div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          </FadeSection>
        )}

        {/* ── CHAMPION STATS ─────────────────────────────────────────────── */}
        {championStats && Object.keys(championStats).length > 0 && (
          <FadeSection>
            <SectionHeader icon={<Trophy className="h-4 w-4" />} label="Campeones más jugados" />
            <div className="space-y-2">
              {(Object.entries(championStats) as [string,any][])
                .sort((a,b) => b[1].games - a[1].games)
                .slice(0, 10)
                .map(([key, s], i) => (
                  <ChampStatRow key={key} champKey={key} stats={s} champs={champs} rank={i+1} />
                ))}
            </div>
          </FadeSection>
        )}

        {/* ── MATCH HISTORY ──────────────────────────────────────────────── */}
        <FadeSection>
          <SectionHeader
            icon={<Swords className="h-4 w-4" />}
            label="Historial de partidas"
            right={<span className="text-xs font-mono text-gray-700">{matchHistory.length} partidas</span>}
          />
          <div className="space-y-2.5">
            {matchHistory.map(m => (
              <MatchRow key={m.matchId} match={m} champs={champs} staticData={staticData} mePuuid={puuid} regional={continent} />
            ))}
          </div>
          {matchHistory.length >= matchCount && (
            <div className="text-center mt-6">
              <button onClick={loadMore} disabled={loadingMore}
                className="px-8 py-2.5 rounded-full border border-white/10 text-white/50 text-sm font-medium
                  hover:bg-white/[0.04] hover:border-white/20 hover:text-white transition-all disabled:opacity-50 flex items-center gap-2 mx-auto">
                {loadingMore
                  ? <><div className="w-4 h-4 rounded-full border-2 border-red-400 border-t-transparent animate-spin" />Cargando…</>
                  : <>Cargar más <ChevronDown className="h-4 w-4" /></>}
              </button>
            </div>
          )}
        </FadeSection>

        {/* ── COMMENTS ───────────────────────────────────────────────────── */}
        {puuid && (
          <FadeSection>
            <div className="border-t border-white/[0.05] pt-6">
              <SectionHeader icon={<Users className="h-4 w-4" />} label="Comentarios de la comunidad" />
              <ProfileComments puuid={puuid} />
            </div>
          </FadeSection>
        )}
      </div>
    </div>
  );
}
