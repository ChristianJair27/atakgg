// src/pages/MatchDetailPage.tsx
import { useLocation, useParams, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/Card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useMatchDetail, useMatchTimeline } from "@/hooks/match";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text, Billboard, Image } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { Crown, Sword, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

type AnyObj = Record<string, any>;

const CDRAGON = "https://raw.communitydragon.org/latest";

const champIcon = (p: AnyObj) =>
  p?.championId != null
    ? `${CDRAGON}/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${p.championId}.png`
    : undefined;

const itemIcon = (id?: number) =>
  id != null ? `${CDRAGON}/plugins/rcp-be-lol-game-data/global/default/v1/items/${id}.png` : undefined;

// Bars3D (el mismo que tenías, pero con mejoras sutiles)
function Bars3D({
  values,
  labels,
  icons,
}: {
  values: number[];
  labels: string[];
  icons?: (string | undefined)[];
}) {
  const safeValues = values ?? [];
  const safeLabels = labels ?? [];
  const safeIcons = icons ?? [];
  const max = Math.max(1, ...safeValues);
  const count = Math.max(1, safeLabels.length);
  const groundWidth = count * 1.5;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[groundWidth, 8]} />
        <meshStandardMaterial color="#111214" transparent opacity={0.9} />
      </mesh>

      {safeValues.map((v, i) => {
        const h = (v / max) * 5;
        const x = (i - (safeLabels.length - 1) / 2) * 1.5;

        return (
          <group key={i} position={[x, h / 2, 0]}>
            <mesh>
              <boxGeometry args={[1, h, 1]} />
              <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.2} />
            </mesh>

            {safeIcons[i] && (
              <Billboard position={[0, h + 0.7, 0]} follow>
                <Image url={safeIcons[i]!} transparent scale={[0.9, 0.9]} />
              </Billboard>
            )}

            <Billboard position={[0, h + 1.5, 0]} follow>
              <Text fontSize={0.38} color="white" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000">
                {v.toLocaleString()}
              </Text>
            </Billboard>

            <Billboard position={[0, 0.12, 0.65]} follow>
              <Text color="#d1d5db" fontSize={0.28} anchorX="center" anchorY="middle" maxWidth={1.2} outlineWidth={0.015} outlineColor="#000">
                {safeLabels[i]}
              </Text>
            </Billboard>
          </group>
        );
      })}

      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <pointLight position={[-10, 0, -10]} intensity={0.5} />
    </group>
  );
}

export default function MatchDetailPage() {
  const { regional, matchId } = useParams<{ regional: string; matchId: string }>();
  const { state } = useLocation() as { state?: { puuid?: string; teamParticipants?: AnyObj[]; participantId?: number } };

  const { data: detail } = useMatchDetail(regional!, matchId!);
  const { data: timeline } = useMatchTimeline(regional!, matchId!);

  const frames = useMemo(() => {
    if (!timeline) return [];
    return (timeline as any)?.info?.frames || (timeline as any)?.frames || [];
  }, [timeline]);

  const participants = useMemo(() => {
    const fromDetail = (detail as any)?.match?.info?.participants || (detail as any)?.info?.participants || [];
    return fromDetail.length ? fromDetail : (state?.teamParticipants || []);
  }, [detail, state?.teamParticipants]);

  const myParticipant = useMemo(() => {
    return participants.find((p: AnyObj) => p.puuid === state?.puuid) || participants[0];
  }, [participants, state?.puuid]);

  const blueTeam = participants.filter((p: AnyObj) => p.teamId === 100);
  const redTeam = participants.filter((p: AnyObj) => p.teamId === 200);

  const teamDamage = useMemo(() => {
    const blue = blueTeam.reduce((sum: number, p: AnyObj) => sum + (p.totalDamageDealtToChampions || 0), 0);
    const red = redTeam.reduce((sum: number, p: AnyObj) => sum + (p.totalDamageDealtToChampions || 0), 0);
    const total = blue + red || 1;
    return { blue: (blue / total) * 100, red: (red / total) * 100, blueRaw: blue, redRaw: red };
  }, [blueTeam, redTeam]);

  const goldSeries = useMemo(() => {
    return frames.map((f: AnyObj, i: number) => ({
      minute: i,
      blue: 0, // ajusta si tu timeline tiene datos de oro por equipo
      red: 0,
    }));
  }, [frames]);

  const fmtTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white py-8"
    >
      <div className="container mx-auto px-4 max-w-7xl">
        <Link to={-1 as any} className="inline-flex items-center text-red-400 hover:text-red-300 mb-6 text-lg font-medium">
          ← Volver al perfil
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Resumen personal */}
          <div className="space-y-6">
            <Card className={cn("border-2 backdrop-blur-md", myParticipant?.win ? "border-emerald-500/50 bg-emerald-900/20" : "border-rose-500/50 bg-rose-900/20")}>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center justify-between">
                  <span>{myParticipant?.win ? "VICTORIA" : "DERROTA"}</span>
                  <Badge className={myParticipant?.win ? "bg-emerald-600" : "bg-rose-600"}>
                    {fmtTime(myParticipant?.gameDuration || 0)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
                  <img src={champIcon(myParticipant)} className="w-20 h-20 rounded-lg border-2 border-red-600/60" />
                  <div>
                    <p className="text-xl font-bold">{myParticipant?.championName}</p>
                    <p className="text-3xl font-bold">
                      {myParticipant?.kills}/<span className="text-red-400">{myParticipant?.deaths}</span>/{myParticipant?.assists}
                    </p>
                    <p className="text-lg text-gray-300">KDA {(myParticipant?.kda || 0).toFixed(2)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">CS</p>
                    <p className="font-bold">{myParticipant?.totalMinionsKilled || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Daño total</p>
                    <p className="font-bold">{(myParticipant?.totalDamageDealtToChampions || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Oro</p>
                    <p className="font-bold">{(myParticipant?.goldEarned || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Visión</p>
                    <p className="font-bold">{myParticipant?.visionScore || 0}</p>
                  </div>
                </div>

                <div>
                  <p className="text-gray-400 mb-2">Build final</p>
                  <div className="flex flex-wrap gap-2">
                    {(myParticipant?.items || []).slice(0, 6).map((id: number, i: number) => (
                      <img key={i} src={itemIcon(id)} className="w-10 h-10 rounded border border-gray-600" />
                    ))}
                    {myParticipant?.trinket && <img src={itemIcon(myParticipant.trinket)} className="w-10 h-10 rounded border-2 border-yellow-600" />}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs con gráficos y equipos */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="graficos" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-gray-800/50">
                <TabsTrigger value="graficos">Gráficos</TabsTrigger>
                <TabsTrigger value="equipos">Equipos</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>

              <TabsContent value="graficos" className="space-y-6 mt-6">
                <Card className="bg-gray-800/40 border-red-700/30 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sword className="h-5 w-5" /> Daño total por equipo
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-300">Equipo Azul</span>
                        <span>{teamDamage.blueRaw.toLocaleString()}</span>
                      </div>
                      <Progress value={teamDamage.blue} className="h-4 [&>div]:bg-gradient-to-r [&>div]:from-blue-500 [&>div]:to-cyan-500" />
                      <div className="flex justify-between text-sm">
                        <span className="text-red-300">Equipo Rojo</span>
                        <span>{teamDamage.redRaw.toLocaleString()}</span>
                      </div>
                      <Progress value={teamDamage.red} className="h-4 [&>div]:bg-gradient-to-r [&>div]:from-red-500 [&>div]:to-orange-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800/40 border-red-700/30 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Coins className="h-5 w-5" /> Evolución de oro
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={goldSeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="minute" stroke="#9ca3af" />
                        <YAxis stroke="#9ca3af" />
                        <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #ef4444" }} />
                        <Line type="monotone" dataKey="blue" stroke="#60a5fa" strokeWidth={3} name="Azul" />
                        <Line type="monotone" dataKey="red" stroke="#f87171" strokeWidth={3} name="Rojo" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800/40 border-red-700/30 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Daño por jugador (3D)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-96">
                    <Canvas shadows camera={{ position: [0, 6, 12], fov: 50 }}>
                      <Suspense fallback={null}>
                        <OrbitControls enablePan enableZoom />
                        <Bars3D
                          values={participants.map((p: AnyObj) => p.totalDamageDealtToChampions || 0)}
                          labels={participants.map((p: AnyObj) => p.summonerName || p.championName || "Jugador")}
                          icons={participants.map(champIcon)}
                        />
                      </Suspense>
                    </Canvas>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="equipos" className="space-y-6 mt-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className={cn("border-2", blueTeam.some((p: AnyObj) => p.win) ? "border-emerald-500/50 bg-emerald-900/10" : "border-gray-600/30")}>
                    <CardHeader>
                      <CardTitle className="text-blue-300 flex items-center gap-2">
                        Equipo Azul {blueTeam.some((p: AnyObj) => p.win) && <Crown className="h-5 w-5 text-yellow-400" />}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {blueTeam.map((p: AnyObj) => (
                        <div key={p.participantId} className="flex items-center gap-4 p-3 rounded-lg bg-black/20">
                          <img src={champIcon(p)} className="w-12 h-12 rounded" />
                          <div className="flex-1">
                            <p className="font-medium">{p.summonerName || "Invocador"}</p>
                            <p className="text-sm text-gray-400">
                              {p.kills}/{p.deaths}/{p.assists} • {(p.totalDamageDealtToChampions || 0).toLocaleString()} daño
                            </p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className={cn("border-2", redTeam.some((p: AnyObj) => p.win) ? "border-emerald-500/50 bg-emerald-900/10" : "border-gray-600/30")}>
                    <CardHeader>
                      <CardTitle className="text-red-300 flex items-center gap-2">
                        Equipo Rojo {redTeam.some((p: AnyObj) => p.win) && <Crown className="h-5 w-5 text-yellow-400" />}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {redTeam.map((p: AnyObj) => (
                        <div key={p.participantId} className="flex items-center gap-4 p-3 rounded-lg bg-black/20">
                          <img src={champIcon(p)} className="w-12 h-12 rounded" />
                          <div className="flex-1">
                            <p className="font-medium">{p.summonerName || "Invocador"}</p>
                            <p className="text-sm text-gray-400">
                              {p.kills}/{p.deaths}/{p.assists} • {(p.totalDamageDealtToChampions || 0).toLocaleString()} daño
                            </p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="timeline" className="mt-6">
                <Card className="bg-gray-800/40 border-red-700/30">
                  <CardHeader>
                    <CardTitle>Timeline personal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-400">Próximamente: skill order, compras, objetivos...</p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </motion.div>
  );
}