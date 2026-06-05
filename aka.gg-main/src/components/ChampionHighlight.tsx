// src/components/ChampionHighlight.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/Card";
import { Badge } from "@/components/ui/badge";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Crown } from "lucide-react";
import { motion } from "framer-motion";

type MasteryChampion = {
  championId: number;
  championName: string;
  level: number;
  points: number;
  stats?: {
    damage: number;
    tankiness: number;
    control: number;
    mobility: number;
    vision: number;
    farming: number;
  };
};

const defaultStats = {
  damage: 75,
  tankiness: 60,
  control: 80,
  mobility: 90,
  vision: 55,
  farming: 70,
};

const statLabels = {
  damage: "⚔️ Daño",
  tankiness: "🛡️ Tanqueo",
  control: "⚡ Control",
  mobility: "🏃 Movilidad",
  vision: "👁️ Visión",
  farming: "🌾 Farm",
};

export function ChampionHighlight({
  champion,
  ddragonVersion = "14.24.1",
}: {
  champion: MasteryChampion;
  ddragonVersion?: string;
}) {
  if (!champion) {
    return (
      <Card className="bg-gray-800/30 border-red-700/30">
        <CardContent className="p-8 text-center text-gray-400">
          No hay datos de maestría aún
        </CardContent>
      </Card>
    );
  }

  const cleanName = champion.championName.replace(/[^a-zA-Z0-9]/g, '');
  const squareUrl = `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${cleanName}.png`;
  const splashUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${cleanName}_0.jpg`;

  const data = [
    { label: statLabels.damage, value: champion.stats?.damage ?? defaultStats.damage },
    { label: statLabels.tankiness, value: champion.stats?.tankiness ?? defaultStats.tankiness },
    { label: statLabels.control, value: champion.stats?.control ?? defaultStats.control },
    { label: statLabels.mobility, value: champion.stats?.mobility ?? defaultStats.mobility },
    { label: statLabels.vision, value: champion.stats?.vision ?? defaultStats.vision },
    { label: statLabels.farming, value: champion.stats?.farming ?? defaultStats.farming },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
    >
      <Card className="bg-gray-900/90 border border-red-700/40 backdrop-blur-md overflow-hidden relative shadow-2xl">
        {/* Splash art de fondo */}
        <div className="absolute inset-0 -z-10">
          <div
            className="w-full h-full bg-cover bg-center opacity-40 blur-sm"
            style={{ backgroundImage: `url(${splashUrl})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent" />
        </div>

        <CardHeader className="relative z-10 bg-gradient-to-b from-red-900/70 to-transparent border-b border-red-700/30">
          <CardTitle className="flex items-center justify-between text-red-100">
            <div className="flex items-center gap-3">
              <Crown className="h-7 w-7 drop-shadow-lg" />
              Campeón Destacado
            </div>
            <Badge className="bg-gradient-to-r from-yellow-600 to-yellow-500 text-black font-bold px-4 py-1 shadow-lg">
              Nivel {champion.level} • {champion.points.toLocaleString()} pts
            </Badge>
          </CardTitle>
          <CardDescription className="text-gray-200 text-lg">
            Rendimiento con <span className="font-bold text-red-300">{champion.championName}</span>
          </CardDescription>
        </CardHeader>

        <CardContent className="relative z-10 pt-12 pb-10">
          {/* Icono grande con glow */}
          <div className="flex justify-center mb-12">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-red-600/50 blur-3xl animate-pulse opacity-70" />
              <img
                src={squareUrl}
                alt={champion.championName}
                className="w-48 h-48 rounded-full border-8 border-red-600/80 shadow-2xl object-cover relative z-10"
              />
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-red-700 to-red-900 px-10 py-4 rounded-full text-white font-bold text-3xl shadow-2xl">
                {champion.championName}
              </div>
            </div>
          </div>

          {/* Radar */}
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={data} margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
              <PolarGrid stroke="#f87171" strokeOpacity={0.4} />
              <PolarAngleAxis dataKey="label" tick={{ fill: '#fca5a5', fontSize: 15, fontWeight: 'bold' }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#f87171' }} tickCount={6} />
              <Radar
                name="Tu desempeño"
                dataKey="value"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.8}
                dot={{ r: 7, fill: '#ef4444', strokeWidth: 3 }}
                animationDuration={2000}
              />
              <Radar
                name="Promedio tier"
                dataKey={() => 50}
                stroke="#6b7280"
                fill="#6b7280"
                fillOpacity={0.3}
                strokeDasharray="8 8"
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '3px solid #ef4444', borderRadius: '16px' }}
                labelStyle={{ color: '#fca5a5', fontWeight: 'bold' }}
              />
              <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: "40px" }} />
            </RadarChart>
          </ResponsiveContainer>

          <p className="text-center text-sm text-gray-300 mt-10 font-medium">
            Comparación vs. promedio del tier • Hover para detalles
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}