// src/components/FeaturedPlayers.tsx — Featured players section for Home
import { memo, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion } from 'framer-motion';
import { axiosInstance } from '@/lib/axios';
import { Shield, TrendingUp, Swords, ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

// ─── Types ────────────────────────────────────────────────────────────────────
interface FeaturedPlayer {
  riotId: string; gameName: string; tagLine: string;
  region: string; platform: string; puuid: string;
  profileIconId: number | null; level: number;
  rank: { tier: string; rank: string; lp: number; wins: number; losses: number } | null;
  topChampId: number | null;
  winRate: number; avgKDA: number; recentGames: number;
  error?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const DDRAGON_VERSION = '14.10.1'; // fallback version, real one comes from useChampions
const EMBLEM = (tier?: string) =>
  tier ? `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${tier.toLowerCase()}.png` : '';
const PROFILE_ICON = (id: number | null, version = DDRAGON_VERSION) =>
  id ? `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${id}.png` : null;
const CHAMP_ICON = (champId: number | null) =>
  champId ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${champId}.png` : null;

const TIER_COLORS: Record<string, string> = {
  IRON:'#a08070', BRONZE:'#cd7f32', SILVER:'#c0c0c0', GOLD:'#ffd700',
  PLATINUM:'#4dd0c0', EMERALD:'#50c878', DIAMOND:'#88ccff',
  MASTER:'#9966cc', GRANDMASTER:'#ff6633', CHALLENGER:'#f4c430',
};
const TIER_GLOW: Record<string, string> = {
  CHALLENGER:'rgba(244,196,48,0.35)', GRANDMASTER:'rgba(255,102,51,0.3)',
  MASTER:'rgba(153,102,204,0.3)',     DIAMOND:'rgba(136,204,255,0.25)',
  EMERALD:'rgba(80,200,120,0.25)',    PLATINUM:'rgba(77,208,192,0.2)',
  GOLD:'rgba(255,215,0,0.2)',         SILVER:'rgba(192,192,192,0.15)',
};

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-14 h-14 rounded-full bg-white/[0.07]" />
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-white/[0.07] rounded w-2/3" />
          <div className="h-3 bg-white/[0.05] rounded w-1/3" />
        </div>
      </div>
      <div className="h-8 bg-white/[0.07] rounded-xl mb-3" />
      <div className="grid grid-cols-3 gap-2">
        {[1,2,3].map(i => <div key={i} className="h-10 bg-white/[0.05] rounded-lg" />)}
      </div>
    </div>
  );
}

// ─── Single player card ───────────────────────────────────────────────────────
const PlayerCard = memo(function PlayerCard({
  p, index, ddVersion,
}: { p: FeaturedPlayer; index: number; ddVersion: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const tier = p.rank?.tier;
  const tierColor = tier ? TIER_COLORS[tier] : '#888';
  const tierGlow  = tier ? TIER_GLOW[tier] ?? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)';
  const wr = p.winRate;
  const wrColor = wr >= 60 ? '#4ade80' : wr >= 50 ? '#60a5fa' : '#9ca3af';
  const encodedId = encodeURIComponent(p.riotId);
  const profileUrl = `/stats/${p.region}/${encodedId}`;

  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(ref.current,
      { opacity: 0, y: 50, scale: 0.95 },
      { opacity: 1, y: 0, scale: 1, duration: 0.6, delay: index * 0.08, ease: 'power2.out',
        scrollTrigger: { trigger: ref.current, start: 'top 90%', once: true } }
    );
  }, [index]);

  const [imgError, setImgError] = useState(false);
  const iconUrl = PROFILE_ICON(p.profileIconId, ddVersion);
  const champIconUrl = CHAMP_ICON(p.topChampId);

  return (
    <Link to={profileUrl}>
      <div
        ref={ref}
        className="group relative rounded-2xl border overflow-hidden cursor-pointer transition-all duration-300
          hover:scale-[1.025] hover:-translate-y-1"
        style={{
          borderColor: `${tierColor}30`,
          background: `linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0.4) 100%)`,
          boxShadow: `0 0 0 1px ${tierColor}20, 0 8px 32px ${tierGlow}`,
        }}
      >
        {/* Hover glow overlay */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
          style={{ background: `radial-gradient(ellipse at 50% 0%, ${tierGlow} 0%, transparent 70%)` }} />

        {/* Rank emblem background watermark */}
        {tier && (
          <div className="absolute top-2 right-2 w-16 h-16 opacity-10 group-hover:opacity-20 transition-opacity">
            <img src={EMBLEM(tier)} alt="" className="w-full h-full object-contain" />
          </div>
        )}

        <div className="relative p-5">
          {/* Header: avatar + name */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-shrink-0">
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 transition-all duration-300"
                style={{ borderColor: `${tierColor}50`, boxShadow: `0 0 16px ${tierGlow}` }}>
                {iconUrl && !imgError ? (
                  <img src={iconUrl} alt={p.gameName}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl font-black"
                    style={{ background: `linear-gradient(135deg, ${tierColor}40, ${tierColor}10)`, color: tierColor }}>
                    {p.gameName[0]}
                  </div>
                )}
              </div>
              {/* Champ mini-icon */}
              {champIconUrl && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full overflow-hidden
                  border-2 border-black ring-1" style={{ ringColor: `${tierColor}40` }}>
                  <img src={champIconUrl} alt="" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-black text-white text-base leading-tight truncate group-hover:text-red-200 transition-colors">
                {p.gameName}
              </div>
              <div className="text-xs text-gray-500 font-mono">#{p.tagLine} · {p.region.toUpperCase()}</div>
            </div>
          </div>

          {/* Rank badge */}
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl mb-3"
            style={{ background: `${tierColor}12`, border: `1px solid ${tierColor}25` }}>
            {tier && (
              <img src={EMBLEM(tier)} alt={tier} className="w-8 h-8 object-contain flex-shrink-0" />
            )}
            {p.rank ? (
              <div>
                <div className="font-black text-sm leading-none" style={{ color: tierColor }}>
                  {tier} {p.rank.rank}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{p.rank.lp} LP</div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-gray-500 text-sm">
                <Shield className="h-4 w-4" /> Sin clasificar
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">WR</span>
              <span className="text-sm font-black" style={{ color: wrColor }}>{wr}%</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">KDA</span>
              <span className="text-sm font-black text-white">{p.avgKDA.toFixed(1)}</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">Games</span>
              <span className="text-sm font-black text-white">{p.recentGames}</span>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-3 flex items-center justify-end gap-1 text-xs text-gray-600 group-hover:text-red-400 transition-colors">
            Ver perfil <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </Link>
  );
});

// ─── Section ─────────────────────────────────────────────────────────────────
export const FeaturedPlayers = memo(function FeaturedPlayers() {
  const [players,  setPlayers]  = useState<FeaturedPlayer[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [ddVersion,setDdVersion]= useState(DDRAGON_VERSION);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch DDragon version for accurate icons
    fetch('https://ddragon.leagueoflegends.com/api/versions.json')
      .then(r => r.json())
      .then((v: string[]) => { if (v[0]) setDdVersion(v[0]); })
      .catch(() => {});

    axiosInstance.get('/api/stats/featured')
      .then(({ data }) => setPlayers(data))
      .catch(() => setPlayers([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading || !sectionRef.current) return;
    const header = sectionRef.current.querySelector('[data-header]');
    if (header) {
      gsap.fromTo(header,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out',
          scrollTrigger: { trigger: header, start: 'top 88%', once: true } }
      );
    }
  }, [loading]);

  return (
    <section ref={sectionRef} className="py-20 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div data-header className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4
            bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
            <TrendingUp className="h-4 w-4" />
            <span>Jugadores Destacados</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-3">
            Perfiles <span className="text-yellow-400 [text-shadow:0_0_30px_rgba(250,204,21,0.4)]">de élite</span>
          </h2>
          <p className="text-gray-500 max-w-md mx-auto">
            Los mejores invocadores del servidor. Click para ver su perfil completo.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading
            ? [...Array(6)].map((_, i) => <SkeletonCard key={i} />)
            : players.filter(p => !p.error).map((p, i) => (
                <PlayerCard key={p.riotId} p={p} index={i} ddVersion={ddVersion} />
              ))
          }
        </div>

        {/* See all link */}
        {!loading && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
            className="text-center mt-10">
            <Link to="/stats"
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors">
              Busca tu propio perfil <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        )}
      </div>
    </section>
  );
});
