// src/pages/TournamentLivePage.tsx — Cinematic live broadcast viewer
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import { axiosInstance } from '@/lib/axios';
import {
  ArrowLeft, Wifi, WifiOff, RefreshCw, Trophy,
  Clock, Shield, Swords, Crown, AlertCircle,
  Flame, ChevronRight, Copy, Check, Zap, BarChart3,
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────
const FALLBACK_VER = '14.24.1';
// Single source of truth for the API origin — mirror the axios client so the
// SSE EventSource never diverges from the rest of the app's requests.
const API_BASE = (axiosInstance.defaults.baseURL as string) || 'http://localhost:4000';

const SPELL_KEYS: Record<number, string> = {
  1:'SummonerBoost', 3:'SummonerExhaust', 4:'SummonerFlash',
  6:'SummonerHaste', 7:'SummonerHeal', 11:'SummonerSmite',
  12:'SummonerTeleport', 13:'SummonerMana', 14:'SummonerDot',
  21:'SummonerBarrier', 32:'SummonerSnowball',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface LiveParticipant {
  summonerName: string; riotId: string | null;
  championId: number; spell1Id: number; spell2Id: number; teamId: number;
}
interface LiveMatch {
  matchId: string; round: number; matchNumber: number;
  team1: string | null; team2: string | null;
  score1: number; score2: number; matchStatus: string;
  code: string | null; isLive: boolean;
  gameId: number | null; gameLength: number;
  blueTeam: LiveParticipant[]; redTeam: LiveParticipant[];
  bannedChampions: Array<{ championId: number; teamId: number; pickTurn: number }>;
}
type ViewerAccess = 'owner' | 'participant' | 'public';

interface LiveData {
  tournamentId: string; tournamentName: string;
  phase: string; region: string;
  logoUrl?: string; bannerUrl?: string;
  viewerAccess?: ViewerAccess;
  matches: LiveMatch[]; timestamp?: number;
}

// ─── DDragon helpers ──────────────────────────────────────────────────────────
function champIcon(name: string, ver: string) {
  return `https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${name}.png`;
}
function champLoading(name: string) {
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${name}_0.jpg`;
}
function spellIcon(id: number, ver: string) {
  const key = SPELL_KEYS[id] ?? 'SummonerFlash';
  return `https://ddragon.leagueoflegends.com/cdn/${ver}/img/spell/${key}.png`;
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
function roundLabel(round: number, total: number) {
  const d = total - round;
  if (d === 0) return 'Grand Final';
  if (d === 1) return 'Semifinal';
  if (d === 2) return 'Cuartos';
  return `Ronda ${round}`;
}

// ─── Live timer ───────────────────────────────────────────────────────────────
function LiveTimer({ initial }: { initial: number }) {
  const [secs, setSecs] = useState(initial);
  useEffect(() => {
    const id = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono font-black tabular-nums">{fmtTime(secs)}</span>;
}

// ─── Champion portrait (cinematic tall card) ──────────────────────────────────
function ChampCard({
  participant, champMap, version, side,
}: {
  participant: LiveParticipant;
  champMap: Map<number, string>;
  version: string;
  side: 'blue' | 'red';
}) {
  const champName = champMap.get(participant.championId);
  const [imgErr, setImgErr] = useState(false);

  const blueGrad = 'linear-gradient(to top, rgba(10,20,60,0.95) 0%, rgba(10,20,60,0.5) 40%, transparent 80%)';
  const redGrad  = 'linear-gradient(to top, rgba(60,10,10,0.95) 0%, rgba(60,10,10,0.5) 40%, transparent 80%)';

  return (
    <div className="relative flex-1 overflow-hidden" style={{ minWidth: 0 }}>
      {/* Loading art background */}
      {champName && !imgErr ? (
        <img
          src={champLoading(champName)}
          alt={champName}
          onError={() => setImgErr(true)}
          className="absolute inset-0 w-full h-full object-cover object-top"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
          <span className="text-4xl text-gray-700 font-black">{participant.championId}</span>
        </div>
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0" style={{ background: side === 'blue' ? blueGrad : redGrad }} />

      {/* Top: small square icon + spells */}
      <div className={`absolute top-2 flex items-center gap-1 px-2 ${side === 'blue' ? 'left-0' : 'right-0 flex-row-reverse'}`}>
        {champName && (
          <img src={champIcon(champName, version)} alt={champName}
            className="w-6 h-6 rounded-sm border border-white/20 flex-shrink-0" />
        )}
        <div className="flex gap-0.5">
          {[participant.spell1Id, participant.spell2Id].map((sid, i) => (
            <img key={i} src={spellIcon(sid, version)} alt=""
              className="w-4 h-4 rounded-sm opacity-80"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ))}
        </div>
      </div>

      {/* Bottom: player name */}
      <div className={`absolute bottom-0 left-0 right-0 p-2 ${side === 'blue' ? 'text-left' : 'text-right'}`}>
        <div className="text-[11px] font-bold text-white truncate leading-tight drop-shadow-lg">
          {participant.summonerName}
        </div>
        {champName && (
          <div className="text-[9px] text-white/50 truncate leading-none">{champName}</div>
        )}
      </div>
    </div>
  );
}

// ─── Ban chip ─────────────────────────────────────────────────────────────────
function BanChip({ championId, champMap, version }: { championId: number; champMap: Map<number,string>; version: string }) {
  const name = champMap.get(championId);
  return (
    <div className="relative w-7 h-7 rounded-md overflow-hidden flex-shrink-0 opacity-80">
      {name ? (
        <img src={champIcon(name, version)} alt={name} className="w-full h-full object-cover grayscale" />
      ) : (
        <div className="w-full h-full bg-gray-800 flex items-center justify-center text-[9px] text-gray-500">{championId}</div>
      )}
      {/* Red X */}
      <div className="absolute inset-0 flex items-center justify-center bg-red-900/60">
        <span className="text-red-400 text-[10px] font-black">✕</span>
      </div>
    </div>
  );
}

// ─── Code copy button ─────────────────────────────────────────────────────────
function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.1]
        text-xs font-mono text-gray-400 hover:text-white hover:border-red-500/40 transition-all group">
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
      <span className="truncate max-w-[160px]">{code}</span>
    </button>
  );
}

// ─── Post-game stats ──────────────────────────────────────────────────────────
interface StatPlayer {
  summonerName: string; tagLine?: string; championName: string; champLevel: number;
  teamId: number; win: boolean;
  kills: number; deaths: number; assists: number; kda: number;
  cs: number; csPerMin: number; goldEarned: number; totalDamageDealt: number;
  visionScore: number; items: number[];
  pentaKills: number; quadraKills: number; tripleKills: number; firstBloodKill: boolean;
}
interface MatchStats {
  matchId: string; gameDuration: number; gameMode: string;
  blueTeam: StatPlayer[]; redTeam: StatPlayer[];
  winner: 'blue' | 'red';
}

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
function fmtNum(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function StatRow({ p, version, side }: { p: StatPlayer; version: string; side: 'blue' | 'red' }) {
  const champImg = `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${p.championName}.png`;
  const itemImg  = (id: number) => `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/[0.02] transition-colors ${p.firstBloodKill ? 'border-l-2 border-red-500/40' : 'border-l-2 border-transparent'}`}>
      {/* Champion */}
      <div className="relative flex-shrink-0">
        <img src={champImg} alt={p.championName} className="w-8 h-8 rounded-lg object-cover"
          onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }} />
        <span className="absolute -bottom-1 -right-1 text-[9px] font-black bg-black/80 rounded px-0.5 text-white/60">{p.champLevel}</span>
      </div>

      {/* Name */}
      <div className="w-28 min-w-0">
        <p className="truncate font-medium text-white/80">{p.summonerName}</p>
        {p.pentaKills > 0 && <span className="text-[9px] text-yellow-400 font-black">PENTA</span>}
        {!p.pentaKills && p.quadraKills > 0 && <span className="text-[9px] text-orange-400 font-black">QUADRA</span>}
        {!p.pentaKills && !p.quadraKills && p.tripleKills > 0 && <span className="text-[9px] text-white/40 font-black">TRIPLE</span>}
      </div>

      {/* KDA */}
      <div className="w-20 text-center tabular-nums flex-shrink-0">
        <span className={p.deaths === 0 ? 'text-yellow-400 font-black' : 'text-white/70'}>
          {p.kills}<span className="text-white/25 mx-0.5">/</span>
          <span className="text-red-400/80">{p.deaths}</span>
          <span className="text-white/25 mx-0.5">/</span>{p.assists}
        </span>
        <p className="text-[9px] text-white/30">{p.kda.toFixed(2)} KDA</p>
      </div>

      {/* Damage */}
      <div className="w-14 text-center tabular-nums flex-shrink-0">
        <p className="text-white/60">{fmtNum(p.totalDamageDealt)}</p>
        <p className="text-[9px] text-white/25">dmg</p>
      </div>

      {/* CS */}
      <div className="w-14 text-center tabular-nums flex-shrink-0">
        <p className="text-white/60">{p.cs}</p>
        <p className="text-[9px] text-white/25">{p.csPerMin}/min</p>
      </div>

      {/* Gold */}
      <div className="w-12 text-center tabular-nums flex-shrink-0">
        <p className="text-yellow-400/70">{fmtNum(p.goldEarned)}</p>
        <p className="text-[9px] text-white/25">oro</p>
      </div>

      {/* Items */}
      <div className="flex gap-0.5 flex-wrap flex-shrink-0">
        {Array.from({ length: 7 }, (_, i) => p.items[i] || 0).map((itemId, i) => (
          itemId > 0
            ? <img key={i} src={itemImg(itemId)} alt="" className="w-5 h-5 rounded object-cover"
                onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }} />
            : <div key={i} className="w-5 h-5 rounded bg-white/[0.03] border border-white/[0.05]" />
        ))}
      </div>
    </div>
  );
}

function PostGameStats({ stats, version }: { stats: MatchStats; version: string }) {
  const blueWon = stats.winner === 'blue';
  return (
    <div className="border-t border-white/[0.06] bg-black/60">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05]">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5 text-white/30" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-white/30">Stats Finales</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-white/25">
          <span className="font-mono">{fmtDuration(stats.gameDuration)}</span>
          <span>{stats.gameMode}</span>
          <span className="font-mono text-white/15">{stats.matchId}</span>
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-2 px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider text-white/20 border-b border-white/[0.04]">
        <div className="w-8 flex-shrink-0" />
        <div className="w-28">Jugador</div>
        <div className="w-20 text-center">K / D / A</div>
        <div className="w-14 text-center">Daño</div>
        <div className="w-14 text-center">CS</div>
        <div className="w-12 text-center">Oro</div>
        <div>Items</div>
      </div>

      {/* Blue team */}
      <div className={`rounded-lg ${blueWon ? 'bg-blue-500/[0.05] ring-1 ring-inset ring-blue-400/25' : 'ring-1 ring-inset ring-blue-400/10'}`}>
        <div className="px-3 py-1.5 flex items-center gap-2">
          <Shield className="h-3 w-3 text-blue-400" />
          <span className={`text-[10px] font-black uppercase tracking-wider ${blueWon ? 'text-blue-300' : 'text-blue-900'}`}>
            {blueWon ? 'VICTORIA' : 'DERROTA'}
          </span>
        </div>
        {stats.blueTeam.map((p, i) => <StatRow key={i} p={p} version={version} side="blue" />)}
      </div>

      {/* Divider */}
      <div className="h-px bg-white/[0.04] mx-3" />

      {/* Red team */}
      <div className={`rounded-lg ${!blueWon ? 'bg-red-500/[0.05] ring-1 ring-inset ring-red-400/25' : 'ring-1 ring-inset ring-red-400/10'}`}>
        <div className="px-3 py-1.5 flex items-center gap-2">
          <Swords className="h-3 w-3 text-red-400" />
          <span className={`text-[10px] font-black uppercase tracking-wider ${!blueWon ? 'text-red-300' : 'text-red-900'}`}>
            {!blueWon ? 'VICTORIA' : 'DERROTA'}
          </span>
        </div>
        {stats.redTeam.map((p, i) => <StatRow key={i} p={p} version={version} side="red" />)}
      </div>
    </div>
  );
}

// ─── Main match card — cinematic broadcast layout ─────────────────────────────
function MatchCard({
  match, champMap, version, totalRounds, tournamentId, canViewCodes,
}: {
  match: LiveMatch; champMap: Map<number, string>; version: string; totalRounds: number; tournamentId: string;
  canViewCodes: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(ref.current, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' });
  }, []);

  const [stats,           setStats]           = useState<MatchStats | null>(null);
  const [statsLoading,    setStatsLoading]    = useState(false);
  const [statsError,      setStatsError]      = useState('');
  const [statsOpen,       setStatsOpen]       = useState(false);
  const [manualGameId,    setManualGameId]    = useState('');
  const [showGameIdInput, setShowGameIdInput] = useState(false);
  const autoTriggeredRef = useRef(false);

  const loadStats = async () => {
    setStatsLoading(true);
    setStatsError('');
    try {
      const { data } = await axiosInstance.get<MatchStats>(
        `/api/tournaments/${tournamentId}/matches/${match.matchId}/stats`
      );
      setStats(data);
      setStatsOpen(true);
    } catch (e: any) {
      setStatsError(e?.response?.data?.error ?? 'No se encontraron stats');
    } finally {
      setStatsLoading(false);
    }
  };

  const detectAndLoadStats = async () => {
    setStatsLoading(true);
    setStatsError('');
    try {
      await axiosInstance.post(
        `/api/tournaments/${tournamentId}/matches/${match.matchId}/auto-detect-game`
      );
      await loadStats();
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? 'No se encontró la partida. Ingresa el Game ID manualmente.';
      setStatsError(msg);
      setShowGameIdInput(true);
      setStatsLoading(false);
    }
  };

  const linkManualGameId = async () => {
    const gid = manualGameId.trim();
    if (!gid || isNaN(Number(gid))) return;
    setStatsLoading(true);
    setStatsError('');
    try {
      await axiosInstance.post(
        `/api/tournaments/${tournamentId}/matches/${match.matchId}/link-gameid`,
        { gameId: Number(gid) }
      );
      await loadStats();
      setShowGameIdInput(false);
    } catch (e: any) {
      setStatsError(e?.response?.data?.error ?? 'Error al vincular Game ID');
      setStatsLoading(false);
    }
  };

  // Auto-load: if gameId is already linked, fetch stats immediately on mount
  useEffect(() => {
    if (match.gameId && !match.isLive &&
        (match.matchStatus === 'active' || match.matchStatus === 'complete') &&
        !stats && !autoTriggeredRef.current) {
      autoTriggeredRef.current = true;
      loadStats();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.gameId]);

  // Auto-detect: when a match that had a code becomes non-live, try to detect
  useEffect(() => {
    if (!match.isLive && match.matchStatus === 'active' && match.code &&
        !match.gameId && !stats && !autoTriggeredRef.current) {
      autoTriggeredRef.current = true;
      detectAndLoadStats();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.isLive]);

  const blueBans = match.bannedChampions.filter(b => b.teamId === 100);
  const redBans  = match.bannedChampions.filter(b => b.teamId === 200);
  const hasGame  = match.blueTeam.length > 0 || match.redTeam.length > 0;

  return (
    <div ref={ref} className="relative rounded-2xl overflow-hidden border border-white/[0.07] bg-black">

      {/* LIVE top shimmer */}
      {match.isLive && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse z-10" />
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="relative flex items-center justify-between px-5 py-3 bg-gradient-to-r from-blue-900/20 via-black/80 to-red-900/20 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            {roundLabel(match.round, totalRounds)} · P{match.matchNumber}
          </span>
          {match.isLive && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase
              bg-red-500/20 border border-red-500/40 text-red-400 tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              EN VIVO
            </span>
          )}
          {match.matchStatus === 'ready' && !match.isLive && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold
              bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
              <Zap className="h-2.5 w-2.5" />Código listo
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {match.isLive && (
            <div className="flex items-center gap-1.5 text-green-400">
              <Clock className="h-3.5 w-3.5" />
              <LiveTimer initial={match.gameLength} />
            </div>
          )}
          {canViewCodes && match.code && <CopyCode code={match.code} />}
        </div>
      </div>

      {/* ── Score bar ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 items-center bg-black/60">
        {/* Blue team name */}
        <div className="flex items-center gap-2 px-5 py-3">
          <Shield className="h-4 w-4 text-blue-400 flex-shrink-0" />
          <span className="font-black text-blue-200 text-sm truncate">{match.team1 ?? 'TBD'}</span>
        </div>

        {/* Score */}
        <div className="flex items-center justify-center gap-3 py-3">
          <span className="text-3xl font-black text-blue-300 tabular-nums w-10 text-right">{match.score1}</span>
          <span className="text-gray-600 font-bold text-sm">VS</span>
          <span className="text-3xl font-black text-red-300 tabular-nums w-10 text-left">{match.score2}</span>
        </div>

        {/* Red team name */}
        <div className="flex items-center justify-end gap-2 px-5 py-3">
          <span className="font-black text-red-200 text-sm truncate text-right">{match.team2 ?? 'TBD'}</span>
          <Swords className="h-4 w-4 text-red-400 flex-shrink-0" />
        </div>
      </div>

      {/* ── Cinematic champion display ──────────────────────────────────────── */}
      {hasGame ? (
        <div className="relative flex" style={{ height: '300px' }}>
          {/* Blue side — left 5 champions */}
          <div className="flex flex-1" style={{ borderRight: '1px solid rgba(255,255,255,0.04)' }}>
            {match.blueTeam.slice(0, 5).map((p, i) => (
              <ChampCard key={i} participant={p} champMap={champMap} version={version} side="blue" />
            ))}
          </div>

          {/* Center: VS divider */}
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center justify-center gap-1 pointer-events-none">
            <div className="w-px flex-1 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
            <div className="px-2.5 py-1.5 rounded-lg bg-black/90 border border-white/10 text-gray-600 font-black text-xs">VS</div>
            <div className="w-px flex-1 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
          </div>

          {/* Red side — right 5 champions */}
          <div className="flex flex-1 flex-row-reverse">
            {match.redTeam.slice(0, 5).map((p, i) => (
              <ChampCard key={i} participant={p} champMap={champMap} version={version} side="red" />
            ))}
          </div>
        </div>
      ) : (
        /* No spectator data yet */
        <div className="flex items-center justify-center h-32 bg-black/40">
          <div className="text-center">
            <Swords className="h-8 w-8 text-gray-700 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              {match.matchStatus === 'ready'
                ? 'Partida lista — esperando que los jugadores entren al lobby'
                : 'Esperando que empiece la partida…'}
            </p>
            {canViewCodes && match.code && (
              <p className="text-xs text-gray-700 mt-1">Código: <span className="font-mono text-gray-500">{match.code}</span></p>
            )}
            {!canViewCodes && (match.matchStatus === 'ready' || match.matchStatus === 'active') && (
              <p className="text-xs text-gray-600 mt-1">Código disponible solo para jugadores inscritos</p>
            )}
          </div>
        </div>
      )}

      {/* ── Bans ─────────────────────────────────────────────────────────────── */}
      {(blueBans.length > 0 || redBans.length > 0) && (
        <div className="flex items-center justify-between px-5 py-3 bg-black/60 border-t border-white/[0.04]">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-gray-700 uppercase tracking-wider">Bans</span>
            <div className="flex gap-1">
              {blueBans.map((b, i) => (
                <BanChip key={i} championId={b.championId} champMap={champMap} version={version} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 flex-row-reverse">
              {redBans.map((b, i) => (
                <BanChip key={i} championId={b.championId} champMap={champMap} version={version} />
              ))}
            </div>
            <span className="text-[9px] font-mono text-gray-700 uppercase tracking-wider">Bans</span>
          </div>
        </div>
      )}

      {/* ── Spectator / stats footer ────────────────────────────────────────── */}
      <div className="border-t border-white/[0.05]">
        {match.isLive && match.gameId && (
          <div className="px-5 py-2.5 bg-red-950/20 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs text-red-400/70">
              <Flame className="h-3.5 w-3.5" />
              <span>Game ID: <span className="font-mono">{match.gameId}</span></span>
            </div>
            <code className="text-[10px] px-2 py-0.5 bg-black/60 rounded font-mono text-gray-600">
              spectator.leagueoflegends.com/{match.gameId}
            </code>
          </div>
        )}

        {/* Stats button row — shown for active/complete matches when not live */}
        {!match.isLive && (match.matchStatus === 'active' || match.matchStatus === 'complete') && (
          <div className="px-4 py-2.5 bg-white/[0.01] space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  onClick={stats ? () => setStatsOpen(o => !o) : detectAndLoadStats}
                  disabled={statsLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold
                    bg-white/[0.06] border border-white/10 text-white/70
                    hover:bg-white/10 hover:text-white transition-all disabled:opacity-40"
                >
                  {statsLoading
                    ? <><RefreshCw className="h-3 w-3 animate-spin" />Buscando…</>
                    : stats
                    ? <><BarChart3 className="h-3 w-3" />{statsOpen ? 'Ocultar' : 'Ver'} Stats</>
                    : <><BarChart3 className="h-3 w-3" />Detectar Stats</>
                  }
                </button>
                {match.gameId && (
                  <span className="text-[10px] text-white/20 font-mono">ID {match.gameId}</span>
                )}
                {!match.gameId && !showGameIdInput && (
                  <button
                    onClick={() => setShowGameIdInput(true)}
                    className="text-[10px] text-white/25 hover:text-white/50 underline transition-colors"
                  >
                    Ingresar Game ID
                  </button>
                )}
              </div>
              {statsError && !showGameIdInput && (
                <span className="text-[10px] text-red-400/60 max-w-xs truncate">{statsError}</span>
              )}
            </div>

            {/* Manual Game ID input */}
            {showGameIdInput && (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  placeholder="Game ID del cliente LoL (ej: 1723716463)"
                  value={manualGameId}
                  onChange={e => setManualGameId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && linkManualGameId()}
                  className="px-2.5 py-1.5 text-xs bg-black/60 border border-white/[0.1] rounded-lg
                    text-white/70 w-52 outline-none focus:border-white/30 font-mono"
                />
                <button
                  onClick={linkManualGameId}
                  disabled={statsLoading || !manualGameId.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg
                    bg-white/[0.06] border border-white/10 text-white/60 hover:text-white
                    hover:bg-white/10 transition-all disabled:opacity-40"
                >
                  {statsLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <BarChart3 className="h-3 w-3" />}
                  Vincular
                </button>
                <button onClick={() => setShowGameIdInput(false)}
                  className="text-[10px] text-white/20 hover:text-white/40 transition-colors">
                  Cancelar
                </button>
                {statsError && (
                  <span className="text-[10px] text-red-400/60">{statsError}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Post-game stats panel ───────────────────────────────────────────── */}
      <AnimatePresence>
        {statsOpen && stats && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <PostGameStats stats={stats} version={version} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Bracket sidebar mini ─────────────────────────────────────────────────────
function BracketSidebar({ matches, total }: { matches: LiveMatch[]; total: number }) {
  const rounds = [...new Set(matches.map(m => m.round))].sort((a, b) => a - b);
  return (
    <div className="space-y-5">
      {rounds.map(r => (
        <div key={r}>
          <p className="text-[10px] text-gray-700 uppercase tracking-widest mb-2 px-1">{roundLabel(r, total)}</p>
          <div className="space-y-1.5">
            {matches.filter(m => m.round === r).map(m => (
              <div key={m.matchId} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs border transition-colors ${
                m.isLive
                  ? 'border-red-500/30 bg-red-500/5 text-red-300'
                  : m.matchStatus === 'complete'
                  ? 'border-white/[0.04] bg-white/[0.01] text-gray-600'
                  : 'border-white/[0.06] bg-white/[0.02] text-gray-500'
              }`}>
                {m.isLive && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse flex-shrink-0" />}
                <span className="truncate">{m.team1 ?? 'TBD'}</span>
                <span className="text-gray-700 flex-shrink-0 text-[9px]">vs</span>
                <span className="truncate">{m.team2 ?? 'TBD'}</span>
                {(m.score1 > 0 || m.score2 > 0) && (
                  <span className="ml-auto flex-shrink-0 font-mono text-gray-600">{m.score1}–{m.score2}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TournamentLivePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData]           = useState<LiveData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [connected, setConnected] = useState(false);  // SSE connected
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [countdown, setCountdown] = useState(15);
  const [ddVersion, setDdVersion] = useState(FALLBACK_VER);
  const [champMap, setChampMap]   = useState<Map<number, string>>(new Map());

  const headerRef = useRef<HTMLDivElement>(null);
  const esRef     = useRef<EventSource | null>(null);

  // ── Fetch DDragon version + champion map ────────────────────────────────────
  useEffect(() => {
    fetch('https://ddragon.leagueoflegends.com/api/versions.json')
      .then(r => r.json())
      .then(async (versions: string[]) => {
        const ver = versions[0] ?? FALLBACK_VER;
        setDdVersion(ver);
        const champData = await fetch(
          `https://ddragon.leagueoflegends.com/cdn/${ver}/data/en_US/champion.json`
        ).then(r => r.json());
        const map = new Map<number, string>();
        Object.values(champData.data as Record<string, any>).forEach(c => {
          map.set(Number(c.key), c.id);
        });
        setChampMap(map);
      })
      .catch(() => {});
  }, []);

  // ── Polling fallback ────────────────────────────────────────────────────────
  const fetchFallback = useCallback(async () => {
    if (!id) return;
    try {
      const { data: d } = await axiosInstance.get<LiveData>(`/api/tournaments/${id}/live-matches`);
      setData(d);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Error al cargar datos');
    } finally {
      setLoading(false);
      setLastRefresh(Date.now());
      setCountdown(15);
    }
  }, [id]);

  const canViewCodes = data?.viewerAccess === 'owner' || data?.viewerAccess === 'participant';

  // ── SSE connection ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;

    const token = localStorage.getItem('access_token');
    const url = token
      ? `${API_BASE}/api/tournaments/${id}/live-stream?token=${encodeURIComponent(token)}`
      : `${API_BASE}/api/tournaments/${id}/live-stream`;
    const es   = new EventSource(url);
    esRef.current = es;

    es.onopen = () => { setConnected(true); setLoading(false); };

    es.onmessage = (event) => {
      try {
        const parsed: LiveData = JSON.parse(event.data);
        if ('error' in parsed) {
          setError((parsed as any).error);
        } else {
          setData(parsed);
          setError('');
          setLastRefresh(Date.now());
          setCountdown(15);
        }
      } catch {}
      setLoading(false);
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      // Fall back to polling every 15s
      fetchFallback();
    };

    return () => { es.close(); esRef.current = null; };
  }, [id, fetchFallback]);

  // ── Countdown ticker (visual only) ─────────────────────────────────────────
  useEffect(() => {
    const tick = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(tick);
  }, []);

  // ── GSAP header entrance ────────────────────────────────────────────────────
  useEffect(() => {
    if (!headerRef.current || !data) return;
    gsap.fromTo(headerRef.current.querySelectorAll('[data-h]'),
      { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: 'power2.out' }
    );
  }, [data]);

  const liveMatches    = (data?.matches ?? []).filter(m => m.isLive);
  const pendingMatches = (data?.matches ?? []).filter(m => !m.isLive);
  const totalRounds    = data?.matches?.length ? Math.max(...data.matches.map(m => m.round)) : 1;

  return (
    <div className="min-h-screen text-white bg-[#080808] relative overflow-x-hidden">

      {/* Ambient background */}
      <div className="fixed inset-0 -z-10 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 0%,rgba(127,29,29,0.18) 0%,transparent 60%)' }} />

      {/* ── Back nav ───────────────────────────────────────────────────────── */}
      <div className="px-6 pt-20 pb-0">
        <Link to={`/tournaments/${id}`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors group">
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          Volver al torneo
        </Link>
      </div>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      {data && (
        <header ref={headerRef} className="relative px-6 pt-6 pb-6 overflow-hidden">
          {data.bannerUrl && (
            <div className="absolute inset-0 -z-10">
              <img src={data.bannerUrl} alt="" className="w-full h-full object-cover opacity-10" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#080808]" />
            </div>
          )}

          <div className="max-w-7xl mx-auto flex items-center gap-5 flex-wrap">
            {/* Logo */}
            <div data-h className="flex-shrink-0">
              {data.logoUrl ? (
                <img src={data.logoUrl} alt="logo"
                  className="w-16 h-16 rounded-xl object-contain border border-white/[0.08] bg-white/[0.03] p-1.5" />
              ) : (
                <div className="w-16 h-16 rounded-xl border border-red-900/30 bg-red-500/5 flex items-center justify-center">
                  <Trophy className="h-7 w-7 text-red-400" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div data-h className="flex items-center gap-3 mb-1 flex-wrap">
                {/* Connection status */}
                <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                  connected
                    ? 'bg-red-500/20 border-red-500/30 text-red-400'
                    : 'bg-gray-800/50 border-gray-700/50 text-gray-500'
                }`}>
                  {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  {connected ? 'Transmisión en Vivo' : 'Modo Polling'}
                </span>
                <span className="text-xs text-gray-600 uppercase tracking-widest">{data.region.toUpperCase()}</span>
                <span className="text-xs text-gray-600 capitalize">{data.phase}</span>
              </div>
              <h1 data-h className="text-2xl md:text-3xl font-black text-white truncate">
                {data.tournamentName}
              </h1>
              <p data-h className="text-sm text-gray-500 mt-1">
                {liveMatches.length} partida{liveMatches.length !== 1 ? 's' : ''} en vivo ·
                Actualización en {countdown}s
              </p>
            </div>

            {/* Refresh */}
            <div data-h className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => { setLoading(true); fetchFallback(); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.08]
                  bg-white/[0.03] text-sm text-gray-400 hover:text-white transition-all">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            </div>
          </div>
        </header>
      )}

      {/* ── States ─────────────────────────────────────────────────────────── */}
      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
          <p className="text-gray-500 text-sm">Conectando a la transmisión…</p>
        </div>
      )}

      {error && !data && (
        <div className="flex flex-col items-center justify-center py-40 gap-3 text-center px-6">
          <AlertCircle className="h-12 w-12 text-red-500/50" />
          <p className="text-gray-400">{error}</p>
          <button onClick={fetchFallback}
            className="mt-2 px-6 py-2.5 rounded-xl text-white text-sm font-bold"
            style={{ background: 'linear-gradient(135deg,#ef4444,#b91c1c)' }}>
            Reintentar
          </button>
        </div>
      )}

      {/* ── Main content ───────────────────────────────────────────────────── */}
      {data && (
        <main className="max-w-7xl mx-auto px-6 pb-24">
          <div className="flex gap-6 mt-2">

            {/* Left: match cards */}
            <div className="flex-1 min-w-0 space-y-6">

              {/* Live matches */}
              {liveMatches.length > 0 && (
                <section>
                  <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-red-400 mb-4">
                    <Flame className="h-4 w-4" />
                    Partidas en Vivo ({liveMatches.length})
                  </h2>
                  <div className="space-y-5">
                    {liveMatches.map(m => (
                      <MatchCard key={m.matchId} match={m} champMap={champMap} version={ddVersion} totalRounds={totalRounds} tournamentId={id ?? ''} canViewCodes={canViewCodes} />
                    ))}
                  </div>
                </section>
              )}

              {/* Pending/upcoming */}
              {pendingMatches.length > 0 && (
                <section>
                  <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
                    <ChevronRight className="h-4 w-4" />
                    Próximas Partidas ({pendingMatches.length})
                  </h2>
                  <div className="space-y-3">
                    {pendingMatches.map(m => (
                      <MatchCard key={m.matchId} match={m} champMap={champMap} version={ddVersion} totalRounds={totalRounds} tournamentId={id ?? ''} canViewCodes={canViewCodes} />
                    ))}
                  </div>
                </section>
              )}

              {liveMatches.length === 0 && pendingMatches.length === 0 && (
                <div className="text-center py-32 text-gray-700">
                  <Swords className="h-14 w-14 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-bold mb-1">No hay partidas activas</p>
                  <p className="text-sm">
                    {data.phase === 'registration' && 'El torneo aún está en fase de registro.'}
                    {data.phase === 'checkin'      && 'En fase de check-in.'}
                    {data.phase === 'complete'     && 'El torneo ha finalizado.'}
                    {data.phase === 'active'       && 'Esperando inicio de partidas…'}
                  </p>
                </div>
              )}
            </div>

            {/* Right: sidebar */}
            <aside className="hidden lg:flex flex-col gap-5 w-64 flex-shrink-0">

              {/* Bracket overview */}
              <div className="p-4 rounded-2xl border border-white/[0.07] bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-4">
                  <Crown className="h-4 w-4 text-yellow-500" />
                  <h3 className="text-sm font-bold text-white">Bracket</h3>
                </div>
                <BracketSidebar matches={data.matches} total={totalRounds} />
              </div>

              {/* Legend */}
              <div className="p-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] space-y-2">
                <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-widest">Estado</p>
                {[
                  { dot: 'bg-red-400',    label: 'En vivo — partida activa' },
                  { dot: 'bg-yellow-400', label: 'Lista — código asignado' },
                  { dot: 'bg-gray-600',   label: 'Pendiente' },
                ].map(({ dot, label }) => (
                  <div key={label} className="flex items-center gap-2 text-xs text-gray-600">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                    {label}
                  </div>
                ))}
              </div>

              {/* Last refresh info */}
              <div className="px-3 text-center">
                <p className="text-[10px] text-gray-700 leading-relaxed">
                  Última actualización<br />
                  {new Date(lastRefresh).toLocaleTimeString()}<br />
                  <span className="text-gray-800">Spectator API · 15s refresh</span>
                </p>
              </div>
            </aside>
          </div>
        </main>
      )}
    </div>
  );
}
