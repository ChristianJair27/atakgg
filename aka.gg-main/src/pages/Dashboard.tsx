// src/pages/Dashboard.tsx
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/Card";
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
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [err, setErr] = useState("");

  const [riotId, setRiotId] = useState("");
  const [platform, setPlatform] = useState("la1");
  const [linking, setLinking] = useState(false);

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

  // ===== llamadas a API =====
  const fetchOverview = async () => {
    setLoading(true);
    setErr("");
    try {
      const { data } = await axiosInstance.get<OverviewResponse>("/api/players/me/overview");
      setOverview(data);
    } catch (e: any) {
      setErr(e?.response?.data?.msg || "Error cargando overview");
    } finally {
      setLoading(false);
    }
  };

  const linkAccount = async () => {
    setLinking(true);
    setErr("");
    try {
      await axiosInstance.post("/api/players/link", { riotId, platform });
      await fetchOverview();
    } catch (e: any) {
      setErr(e?.response?.data?.msg || "No se pudo vincular la cuenta");
    } finally {
      setLinking(false);
    }
  };
  useEffect(() => { console.log("OVERVIEW", overview); }, [overview]);

  useEffect(() => {
    fetchOverview();
  }, []);

  // ===== loading =====
  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-muted-foreground">
        Cargando tu dashboard…
      </div>
    );
  }

  

  // ===== CTA de vinculación si no hay cuenta vinculada =====
  if (!overview?.linked) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Vincula tu cuenta de League of Legends</CardTitle>
            <CardDescription>Para mostrar tus estadísticas reales en ATAK.GG</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Riot ID (GameName#TAG)</label>
                <Input
                  placeholder="Kister#IZPZ"
                  value={riotId}
                  onChange={(e) => setRiotId(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Región</label>
                <select
                  className="w-full h-10 rounded-md border bg-background"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                >
                  {regions.map((r) => (
                    <option key={r} value={r}>
                      {r.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {err && <div className="text-sm text-destructive">{err}</div>}
            <Button onClick={linkAccount} disabled={!riotId || linking} className="w-full">
              {linking ? "Vinculando…" : "Vincular cuenta"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ===== datos reales =====
  const s = overview?.stats ?? {};
  const recent = overview?.recent ?? [];

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">¡Bienvenido de vuelta, {user?.name || "Invocador"}!</h1>
          <p className="text-muted-foreground">
            {overview?.profile?.gameName
              ? `Cuenta vinculada: ${overview.profile.gameName}#${overview.profile.tagLine} • ${overview.profile.platform?.toUpperCase()}`
              : "Aquí está tu resumen de actividad y estadísticas"}
          </p>
        </div>

        {/* Quick Stats (reales) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Partidas Recientes</p>
                  <p className="text-2xl font-bold">{s.totalMatches ?? 0}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-accent" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Win Rate</p>
                  <p className="text-2xl font-bold">{s.winRate ?? 0}%</p>
                </div>
                <Target className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Rango Actual</p>
                  <p className="text-xl font-bold">{s.currentRank ?? "—"}</p>
                  <p className="text-sm text-muted-foreground">{s.lp != null ? `${s.lp} LP` : ""}</p>
                </div>
                <Award className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Torneos</p>
                  <p className="text-2xl font-bold">{s.tournamentsJoined ?? 0}</p>
                </div>
                <Trophy className="h-8 w-8 text-secondary" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Actions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Acciones Rápidas</CardTitle>
                <CardDescription>Accede rápidamente a las funciones principales</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Link to="/stats" className="block">
                    <div className="p-6 rounded-lg border border-border hover:bg-accent/5 transition-colors text-center">
                      <BarChart3 className="h-8 w-8 mx-auto mb-3 text-accent" />
                      <h3 className="font-semibold mb-1">Ver Stats</h3>
                      <p className="text-sm text-muted-foreground">Revisa tus estadísticas</p>
                    </div>
                  </Link>

                  <Link to="/tournaments" className="block">
                    <div className="p-6 rounded-lg border border-border hover:bg-accent/5 transition-colors text-center">
                      <Trophy className="h-8 w-8 mx-auto mb-3 text-primary" />
                      <h3 className="font-semibold mb-1">Torneos</h3>
                      <p className="text-sm text-muted-foreground">Únete a competencias</p>
                    </div>
                  </Link>

                  <Link to="/social" className="block">
                    <div className="p-6 rounded-lg border border-border hover:bg-accent/5 transition-colors text-center">
                      <Users className="h-8 w-8 mx-auto mb-3 text-secondary" />
                      <h3 className="font-semibold mb-1">Social</h3>
                      <p className="text-sm text-muted-foreground">Conecta con otros</p>
                    </div>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity (real) */}
            <Card>
              <CardHeader>
                <CardTitle>Actividad Reciente</CardTitle>
                <CardDescription>Últimas partidas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(!recent || recent.length === 0) ? (
                    <p className="text-sm text-muted-foreground">No hay partidas recientes.</p>
                  ) : (
                    recent.map((m, index) => (
                      <div key={index} className="flex items-center gap-4 p-3 rounded-lg border border-border">
                        <div className={`p-2 rounded-lg bg-accent/10 ${m.win ? "text-success" : "text-destructive"}`}>
                          <MessageSquare className="h-4 w-4" />
                        </div>
                        <div className="flex-grow">
                          <p className="font-medium">{m.queueName ?? "Partida"}</p>
                          <p className="text-sm text-muted-foreground">
                            {m.win ? "Victoria" : "Derrota"} • {m.championName ?? "?"} •{" "}
                            {m.duration ? Math.round(m.duration / 60) : 0}m
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Profile Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserIcon className="h-5 w-5" />
                  Mi Perfil
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-4">
                  <div className="w-16 h-16 bg-gradient-primary rounded-full mx-auto mb-3 flex items-center justify-center">
                    <span className="text-xl font-bold text-primary-foreground">
                      {user?.name?.[0] || "U"}
                    </span>
                  </div>
                  <h3 className="font-semibold">{user?.name || "Usuario"}</h3>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  {overview?.profile?.gameName && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {overview.profile.gameName}#{overview.profile.tagLine}
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Campeón Favorito</span>
                    <span className="text-sm font-medium">{s.favoriteChampion ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Publicaciones</span>
                    <span className="text-sm font-medium">{s.socialPosts ?? 0}</span>
                  </div>
                </div>

                <Button variant="outline" className="w-full mt-4">
                  Editar Perfil
                </Button>
              </CardContent>
            </Card>

            {/* Next Tournament */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Próximo Torneo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Próximamente…</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {err && <div className="text-sm text-destructive mt-6">{err}</div>}
      </div>
    </div>
  );
};

export default Dashboard;
