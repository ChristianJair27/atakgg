// src/pages/Dashboard.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/features/auth/useAuth";
import {
  User as UserIcon,
  Trophy,
  Users,
  BarChart3,
  Calendar,
  MessageSquare,
  Target,
  Award,
} from "lucide-react";
import { axiosInstance } from "@/lib/axios";
import { ScrollVideoBg } from "@/components/ScrollVideoBg";
import { Skeleton } from "@/components/ui/skeleton";
import { Tip } from "@/components/ui/Tip";
import { useQueryClient } from "@tanstack/react-query";
import { useOverview } from "@/hooks/queries/players";
import { useTournaments } from "@/hooks/queries/tournaments";
import { qk } from "@/hooks/queries/keys";
import { TournamentDashboardPanel } from "@/components/TournamentDashboardPanel";

// ─── Brand tokens (shared ATAK vocabulary) ──────────────────────────────────
const C = {
  bg: "#0a0a0c",
  red: "#e1242e",
  redHover: "#ff5a64",
  win: "#2fbf8a",
  loss: "#ff5a64",
  gold: "#c8aa6e",
};
const FONT_BODY = "'Saira', system-ui, sans-serif";
const FONT_COND = "'Saira Condensed', 'Saira', sans-serif";

// Frosted glass surface — same recipe as ProfilePage so panels feel embedded
// into the living dagger background rather than opaque cards.
const PANEL_SURFACE: React.CSSProperties = {
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 22%, rgba(255,255,255,0) 70%), rgba(13,13,17,0.30)",
  backdropFilter: "blur(20px) saturate(120%)",
  WebkitBackdropFilter: "blur(20px) saturate(120%)",
  borderRadius: 18,
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 44px -30px rgba(0,0,0,.6)",
};

const RISE_IN = {
  initial: { opacity: 0, y: 22, filter: "blur(6px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, margin: "-60px" },
  transition: {
    duration: 0.55,
    ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
  },
};

function Panel({
  children,
  style,
  delay = 0,
  hover = false,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  delay?: number;
  hover?: boolean;
}) {
  return (
    <motion.div
      initial={RISE_IN.initial}
      whileInView={RISE_IN.whileInView}
      viewport={RISE_IN.viewport}
      transition={{ ...RISE_IN.transition, delay }}
      whileHover={hover ? { y: -3 } : undefined}
      style={{ ...PANEL_SURFACE, ...style }}
    >
      {children}
    </motion.div>
  );
}

function SectionTitle({
  children,
  sub,
}: {
  children: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h2
        style={{
          fontFamily: FONT_COND,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          fontSize: 13,
          color: "rgba(255,255,255,0.82)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          margin: 0,
        }}
      >
        <span
          style={{
            width: 4,
            height: 16,
            background: C.red,
            borderRadius: 2,
            display: "inline-block",
          }}
        />
        {children}
      </h2>
      {sub && (
        <p
          style={{
            margin: "6px 0 0 14px",
            fontSize: 12.5,
            color: "rgba(255,255,255,0.42)",
          }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

// ==== helpers ====
function b64urlToJson<T = any>(s: string): T {
  const normalized = s.replace(/-/g, "+").replace(/_/g, "/");
  const json = atob(normalized);
  return JSON.parse(json);
}

type OverviewResponse = {
  ok: boolean;
  linked: boolean;
  profile?: {
    gameName?: string;
    tagLine?: string;
    platform?: string;
    puuid?: string;
    profileIcon?: number | null;
  };
  stats?: {
    totalMatches?: number;
    winRate?: number;
    currentRank?: string | null;
    lp?: number | null;
    favoriteChampion?: string | null;
    tournamentsJoined?: number;
    socialPosts?: number;
  };
  recent?: Array<{
    win?: boolean;
    queueName?: string;
    championName?: string;
    duration?: number; // segundos
  }>;
};

const regions = ["la1", "la2", "na1", "br1", "oc1", "euw1", "eun1", "kr", "jp1", "ru", "tr1"];

const Dashboard = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // ===== estado de overview / link =====
  // Overview is fetched via React Query (caching + dedupe with other pages).
  const overviewQ = useOverview();
  const overview = (overviewQ.data ?? null) as OverviewResponse | null;
  const loading = overviewQ.isLoading;
  const [err, setErr] = useState("");

  const [riotId, setRiotId] = useState("");
  const [platform, setPlatform] = useState("la1");
  const [linking, setLinking] = useState(false);

  // ===== próximo torneo (reusa el cache de /api/tournaments) =====
  const { data: tournaments = [] } = useTournaments();
  const nextT = useMemo(() => {
    const list: any[] = Array.isArray(tournaments) ? tournaments : [];
    const upcoming = list
      .filter((t) => t.phase === "registration" || t.phase === "checkin")
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    return upcoming[0] ?? list.find((t) => t.phase === "active") ?? null;
  }, [tournaments]);

  // ===== procesa payload OAuth (cuando vuelves de Google) =====
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const p = params.get("payload");
    if (!p) return;

    try {
      const { token, user: u } = b64urlToJson<{ token: string; user: any }>(p);
      localStorage.setItem("access_token", token);
      localStorage.setItem("user", JSON.stringify(u));
      params.delete("payload");
      const clean = `${location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      window.history.replaceState({}, "", clean);
      // refresco suave si el hook aún no tomó el user
      if (!user) window.location.reload();
    } catch {
      navigate("/login?error=oauth", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== vincular cuenta =====
  const qc = useQueryClient();
  const linkAccount = async () => {
    setLinking(true);
    setErr("");
    try {
      await axiosInstance.post("/api/players/link", { riotId, platform });
      await qc.invalidateQueries({ queryKey: qk.overview() });
    } catch (e: any) {
      setErr(e?.response?.data?.msg || "No se pudo vincular la cuenta");
    } finally {
      setLinking(false);
    }
  };

  // Surface any overview fetch error.
  useEffect(() => {
    if (overviewQ.error) {
      setErr((overviewQ.error as any)?.response?.data?.msg || "Error cargando overview");
    }
  }, [overviewQ.error]);

  // ===== loading — content-shaped skeleton (stat cards + panels) =====
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: "#e8e8ea", fontFamily: FONT_BODY }}>
        <ScrollVideoBg />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1180, margin: "0 auto", padding: "88px 18px 80px" }}>
          <div style={{ marginBottom: 30 }}>
            <Skeleton width={360} height={32} />
            <div style={{ marginTop: 10 }}><Skeleton width={260} height={14} /></div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 18,
              marginBottom: 28,
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ ...PANEL_SURFACE, padding: 22 }}>
                <Skeleton width="60%" height={13} />
                <div style={{ marginTop: 8 }}><Skeleton width="40%" height={26} /></div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 24 }} className="atak-dash-grid">
            <div style={{ ...PANEL_SURFACE, padding: 26, minHeight: 220 }}>
              <Skeleton width={160} height={16} />
              <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                {[0, 1, 2].map((i) => <Skeleton key={i} height={96} variant="block" />)}
              </div>
            </div>
            <div style={{ ...PANEL_SURFACE, padding: 26, minHeight: 220 }}>
              <Skeleton variant="circle" width={64} height={64} style={{ margin: "0 auto" }} />
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <Skeleton height={14} /><Skeleton height={14} width="70%" />
              </div>
            </div>
          </div>
        </div>
        <style>{`@media (max-width: 900px){ .atak-dash-grid{ grid-template-columns: 1fr !important; } }`}</style>
      </div>
    );
  }

  // ===== CTA de vinculación si no hay cuenta vinculada =====
  if (!overview?.linked) {
    return (
      <div
        style={{ minHeight: "100vh", background: C.bg, color: "#e8e8ea", fontFamily: FONT_BODY }}
      >
        <ScrollVideoBg />
        <div
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 640,
            margin: "0 auto",
            padding: "96px 18px 80px",
          }}
        >
          <Panel style={{ padding: 30 }}>
            <SectionTitle sub="Para mostrar tus estadísticas reales en ATAK.GG">
              Vincula tu cuenta de League of Legends
            </SectionTitle>

            <div style={{ display: "grid", gap: 16, marginTop: 6 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
                <div>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.6)",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Riot ID (GameName#TAG)
                  </label>
                  <input
                    placeholder="Kister#IZPZ"
                    value={riotId}
                    onChange={(e) => setRiotId(e.target.value)}
                    style={{
                      width: "100%",
                      height: 42,
                      padding: "0 14px",
                      background: "rgba(0,0,0,0.35)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      borderRadius: 10,
                      color: "#fff",
                      fontFamily: FONT_BODY,
                      fontSize: 14,
                      outline: "none",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.6)",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Región
                  </label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    style={{
                      width: "100%",
                      height: 42,
                      padding: "0 12px",
                      background: "rgba(0,0,0,0.35)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      borderRadius: 10,
                      color: "#fff",
                      fontFamily: FONT_BODY,
                      fontSize: 14,
                      outline: "none",
                    }}
                  >
                    {regions.map((r) => (
                      <option key={r} value={r} style={{ background: "#101014" }}>
                        {r.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {err && (
                <div style={{ fontSize: 13, color: C.loss }}>{err}</div>
              )}

              <button
                onClick={linkAccount}
                disabled={!riotId || linking}
                style={{
                  width: "100%",
                  height: 44,
                  background: C.red,
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  fontFamily: FONT_BODY,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: !riotId || linking ? "default" : "pointer",
                  opacity: !riotId || linking ? 0.5 : 1,
                  transition: "background .16s",
                }}
                onMouseEnter={(e) => {
                  if (riotId && !linking) e.currentTarget.style.background = C.redHover;
                }}
                onMouseLeave={(e) => (e.currentTarget.style.background = C.red)}
              >
                {linking ? "Vinculando…" : "Vincular cuenta"}
              </button>
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  // ===== datos reales =====
  const s = overview?.stats ?? {};
  const recent = overview?.recent ?? [];

  const statCards = [
    {
      label: "Partidas Recientes",
      value: `${s.totalMatches ?? 0}`,
      icon: <BarChart3 size={26} />,
      color: "#ffffff",
      tip: "Partidas analizadas recientemente",
    },
    {
      label: "Win Rate",
      value: `${s.winRate ?? 0}%`,
      icon: <Target size={26} />,
      color: (s.winRate ?? 0) >= 50 ? C.win : C.loss,
      tip: "Porcentaje de victorias en tus partidas recientes",
    },
    {
      label: "Rango Actual",
      value: s.currentRank ?? "—",
      sub: s.lp != null ? `${s.lp} LP` : "",
      icon: <Award size={26} />,
      color: C.gold,
      tip: "Tu rango en clasificatoria",
    },
    {
      label: "Torneos",
      value: `${s.tournamentsJoined ?? 0}`,
      icon: <Trophy size={26} />,
      color: C.red,
      tip: "Torneos en los que has participado",
    },
  ];

  const quickActions = [
    { to: "/stats", icon: <BarChart3 size={26} />, title: "Ver Stats", desc: "Revisa tus estadísticas" },
    { to: "/tournaments", icon: <Trophy size={26} />, title: "Torneos", desc: "Únete a competencias" },
    { to: "/social", icon: <Users size={26} />, title: "Social", desc: "Conecta con otros" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: "#e8e8ea",
        fontFamily: FONT_BODY,
        lineHeight: 1.5,
      }}
    >
      <ScrollVideoBg />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1180, margin: "0 auto", padding: "88px 18px 80px" }}>
        {/* Header */}
        <motion.div {...RISE_IN} style={{ marginBottom: 30 }}>
          <h1
            style={{
              fontFamily: FONT_COND,
              fontWeight: 800,
              fontSize: 34,
              margin: 0,
              color: "#fff",
              lineHeight: 1.05,
            }}
          >
            ¡Bienvenido de vuelta, {user?.name || "Invocador"}!
          </h1>
          <p style={{ margin: "8px 0 0", color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
            {overview?.profile?.gameName
              ? `Cuenta vinculada: ${overview.profile.gameName}#${overview.profile.tagLine} • ${overview.profile.platform?.toUpperCase()}`
              : "Aquí está tu resumen de actividad y estadísticas"}
          </p>
        </motion.div>

        <TournamentDashboardPanel />

        {/* Quick Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 18,
            marginBottom: 28,
          }}
        >
          {statCards.map((c, i) => (
            <Panel key={c.label} delay={i * 0.06} hover style={{ padding: 22 }}>
              <Tip label={c.tip}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.5)" }}>{c.label}</p>
                    <p
                      style={{
                        margin: "4px 0 0",
                        fontFamily: FONT_COND,
                        fontWeight: 800,
                        fontSize: 26,
                        color: c.color,
                        lineHeight: 1.1,
                      }}
                    >
                      {c.value}
                    </p>
                    {c.sub ? (
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{c.sub}</p>
                    ) : null}
                  </div>
                  <span style={{ color: c.color, opacity: 0.85, flexShrink: 0 }}>{c.icon}</span>
                </div>
              </Tip>
            </Panel>
          ))}
        </div>

        {/* Main grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
            gap: 24,
          }}
          className="atak-dash-grid"
        >
          {/* Left column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
            {/* Quick Actions */}
            <Panel style={{ padding: 26 }}>
              <SectionTitle sub="Accede rápidamente a las funciones principales">
                Acciones Rápidas
              </SectionTitle>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: 14,
                }}
              >
                {quickActions.map((a) => (
                  <Link key={a.to} to={a.to} style={{ textDecoration: "none" }}>
                    <motion.div
                      whileHover={{ y: -3 }}
                      style={{
                        padding: "22px 16px",
                        borderRadius: 14,
                        background: "rgba(255,255,255,0.02)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                        textAlign: "center",
                        transition: "background .18s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(225,36,46,0.08)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                    >
                      <span style={{ color: C.red, display: "inline-flex" }}>{a.icon}</span>
                      <h3
                        style={{
                          margin: "10px 0 2px",
                          fontFamily: FONT_COND,
                          fontWeight: 700,
                          fontSize: 16,
                          color: "#fff",
                        }}
                      >
                        {a.title}
                      </h3>
                      <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.45)" }}>{a.desc}</p>
                    </motion.div>
                  </Link>
                ))}
              </div>
            </Panel>

            {/* Recent Activity */}
            <Panel style={{ padding: 26 }}>
              <SectionTitle sub="Últimas partidas">Actividad Reciente</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {!recent || recent.length === 0 ? (
                  <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.45)" }}>No hay partidas recientes.</p>
                ) : (
                  recent.map((m, index) => (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: "12px 14px",
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.02)",
                        boxShadow: `inset 4px 0 0 ${m.win ? C.win : C.loss}`,
                      }}
                    >
                      <div
                        style={{
                          padding: 8,
                          borderRadius: 10,
                          background: m.win ? "rgba(47,191,138,0.12)" : "rgba(255,90,100,0.12)",
                          color: m.win ? C.win : C.loss,
                          display: "inline-flex",
                        }}
                      >
                        <MessageSquare size={16} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#fff" }}>
                          {m.queueName ?? "Partida"}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "rgba(255,255,255,0.5)" }}>
                          <span style={{ color: m.win ? C.win : C.loss, fontWeight: 700 }}>
                            {m.win ? "Victoria" : "Derrota"}
                          </span>{" "}
                          • {m.championName ?? "?"} • {m.duration ? Math.round(m.duration / 60) : 0}m
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </div>

          {/* Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
            {/* Profile Summary */}
            <Panel style={{ padding: 26 }}>
              <SectionTitle>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <UserIcon size={15} /> Mi Perfil
                </span>
              </SectionTitle>

              <div style={{ textAlign: "center", marginBottom: 18 }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    margin: "0 auto 12px",
                    display: "grid",
                    placeItems: "center",
                    background: `linear-gradient(135deg, ${C.red}, #3b0000)`,
                    border: `2px solid rgba(225,36,46,0.4)`,
                  }}
                >
                  <span style={{ fontFamily: FONT_COND, fontWeight: 800, fontSize: 22, color: "#fff" }}>
                    {user?.name?.[0]?.toUpperCase() || "U"}
                  </span>
                </div>
                <h3 style={{ margin: 0, fontFamily: FONT_COND, fontWeight: 700, fontSize: 17, color: "#fff" }}>
                  {user?.name || "Usuario"}
                </h3>
                <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "rgba(255,255,255,0.45)" }}>{user?.email}</p>
                {overview?.profile?.gameName && (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: C.gold }}>
                    {overview.profile.gameName}#{overview.profile.tagLine}
                  </p>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                  <span style={{ color: "rgba(255,255,255,0.6)" }}>Campeón Favorito</span>
                  <span style={{ fontWeight: 600, color: "#fff" }}>{s.favoriteChampion ?? "—"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                  <span style={{ color: "rgba(255,255,255,0.6)" }}>Publicaciones</span>
                  <span style={{ fontWeight: 600, color: "#fff" }}>{s.socialPosts ?? 0}</span>
                </div>
              </div>

              <button
                style={{
                  width: "100%",
                  marginTop: 18,
                  height: 40,
                  background: "transparent",
                  color: "rgba(255,255,255,0.75)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 10,
                  fontFamily: FONT_BODY,
                  fontWeight: 600,
                  fontSize: 13.5,
                  cursor: "pointer",
                  transition: "border-color .16s, color .16s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(225,36,46,0.5)";
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                  e.currentTarget.style.color = "rgba(255,255,255,0.75)";
                }}
              >
                Editar Perfil
              </button>
            </Panel>

            {/* Next Tournament */}
            <Panel style={{ padding: 26 }}>
              <SectionTitle>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Calendar size={15} /> Próximo Torneo
                </span>
              </SectionTitle>
              {nextT ? (
                <div
                  onClick={() => navigate(`/tournaments/${nextT.id}`)}
                  style={{ cursor: "pointer", padding: "4px 0" }}
                >
                  <div style={{ fontFamily: FONT_COND, fontWeight: 700, fontSize: 18, color: "#fff", lineHeight: 1.1, marginBottom: 6 }}>
                    {nextT.name}
                  </div>
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12.5, color: "rgba(255,255,255,0.6)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <Calendar size={13} />
                      {new Date(nextT.startDate).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                    {nextT.prize ? <span style={{ color: C.gold }}>🏆 {nextT.prize}</span> : null}
                  </div>
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: nextT.phase === "active" ? C.win : C.gold }}>
                      {nextT.phase === "registration" ? "Inscripciones abiertas" : nextT.phase === "checkin" ? "Check-in" : "En curso"}
                    </span>
                    <span style={{ fontSize: 12, color: C.red, fontWeight: 600 }}>Ver →</span>
                  </div>
                </div>
              ) : (
                <p style={{ textAlign: "center", fontSize: 13.5, color: "rgba(255,255,255,0.45)", margin: "6px 0" }}>
                  No hay torneos próximos
                </p>
              )}
            </Panel>
          </div>
        </div>

        {err && <div style={{ fontSize: 13, color: C.loss, marginTop: 22 }}>{err}</div>}
      </div>

      <style>{`
        @media (max-width: 900px) {
          .atak-dash-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
