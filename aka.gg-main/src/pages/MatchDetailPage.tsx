// src/pages/MatchDetailPage.tsx
// Rich solo match detail — reuses the tournament <MatchStatsDetail/> (KDA tables,
// damage/gold charts, objectives, top performers) fed by /api/stats/match-stats.
// ATAK.GG dark red/black brand. Players link to their profile.
import { useMemo } from 'react';
import { useLocation, useParams, useNavigate, Link } from 'react-router-dom';
import { MatchStatsDetail } from '@/components/MatchStatsDetail';
import { ArrowLeft } from 'lucide-react';
import { KataLoaderOverlay } from '@/components/KataLoader';
import { useMatchStats } from '@/hooks/queries/stats';

const C = {
  bg: '#0a0a0c', panel: '#131316', border: 'rgba(255,255,255,0.07)',
  red: '#e1242e', redHover: '#ff5a64', win: '#2fbf8a', loss: '#ff5a64', gold: '#c8aa6e',
};
const FONT_COND = "'Saira Condensed', 'Saira', sans-serif";

const QUEUE_NAMES: Record<number, string> = {
  400: 'Normal Draft', 420: 'Solo/Dúo', 430: 'Normal Blind', 440: 'Flex',
  450: 'ARAM', 700: 'Clash', 900: 'URF', 1700: 'Arena', 1900: 'URF',
};

// Build a profile href from a participant; needs a tagLine to resolve cleanly.
function profileHref(region: string, gameName?: string, tagLine?: string) {
  const g = (gameName || '').trim();
  const t = (tagLine || '').trim();
  if (!g || !t) return null;
  return `/profile/${region}/${encodeURIComponent(g)}-${encodeURIComponent(t)}`;
}

export default function MatchDetailPage() {
  const { regional, matchId } = useParams<{ regional: string; matchId: string }>();
  const { state } = useLocation() as { state?: { puuid?: string; region?: string } };
  const navigate = useNavigate();
  const region = state?.region || 'la1';

  const { data: stats = null, isLoading: loading, error: queryError } = useMatchStats(regional, matchId);
  const error = queryError
    ? ((queryError as any)?.response?.data?.message || 'No se pudo cargar la partida')
    : null;

  const queueLabel = useMemo(() => {
    const qid = (stats as any)?.queueId;
    return QUEUE_NAMES[qid] || stats?.gameMode || 'Partida';
  }, [stats]);

  // Roster of clickable players (both teams), resolved from the stats payload.
  const roster = useMemo(() => {
    if (!stats) return [];
    return [...stats.blueTeam, ...stats.redTeam];
  }, [stats]);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: '#e8e8ea', fontFamily: "'Saira', system-ui, sans-serif" }}>
      {/* 3D Katarina loader while the match detail loads. */}
      {loading && !stats && <KataLoaderOverlay show label="Cargando partida" />}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '22px 18px 80px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent',
            border: 'none', color: C.redHover, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginBottom: 16,
          }}
        >
          <ArrowLeft size={18} /> Volver
        </button>

        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontFamily: FONT_COND, fontWeight: 800, fontSize: 26, margin: 0, color: '#fff' }}>
            Detalle de partida
          </h1>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
            {queueLabel}{matchId ? ` · ${matchId}` : ''}
          </div>
        </div>

        {/* Rich stats (tables + charts + objectives + top performers) */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
          <MatchStatsDetail
            stats={stats}
            loading={loading}
            error={error}
            bracketMatchId={matchId || ''}
            gameId={(stats as any)?.gameId ?? (stats ? 1 : undefined)}
            team1="Equipo Azul"
            team2="Equipo Rojo"
          />
        </div>

        {/* Clickable roster — jump to any player's profile */}
        {roster.length > 0 && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, marginTop: 16 }}>
            <h2 style={{ fontFamily: FONT_COND, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 14, color: '#fff', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 4, height: 16, background: C.red, borderRadius: 2, display: 'inline-block' }} />
              Jugadores
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
              {roster.map((p: any, i: number) => {
                const href = profileHref(region, p.summonerName, p.tagLine);
                const content = (
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                      padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
                      background: p.teamId === 100 ? 'rgba(59,130,246,0.06)' : 'rgba(225,36,46,0.06)',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.summonerName}{p.tagLine ? <span style={{ color: 'rgba(255,255,255,0.35)' }}> #{p.tagLine}</span> : ''}
                    </span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{p.championName}</span>
                  </div>
                );
                return href ? (
                  <Link key={i} to={href} style={{ textDecoration: 'none' }} title={`Ver perfil de ${p.summonerName}`}>{content}</Link>
                ) : (
                  <div key={i}>{content}</div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
