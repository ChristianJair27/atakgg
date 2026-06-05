// src/components/MatchRow.tsx
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";

type TeamEntry = {
  teamId: 100 | 200;
  championId: number;
  summonerName?: string;
  puuid?: string;
  kills?: number;
  deaths?: number;
  assists?: number;
  items?: number[];
  trinket?: number;
};

type MatchDetail = {
  matchId: string;
  win: boolean;
  championId: number;
  championLevel?: number;
  gameStartTimestamp: number;
  gameDuration: number;
  gameMode?: string;
  queueId?: number;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  cs?: number;
  totalMinionsKilled?: number;
  neutralMinionsKilled?: number;
  killParticipation?: number;
  totalDamageDealtToChampions?: number;
  gold?: number;
  items?: number[];
  trinket?: number;
  summonerSpells?: number[];
  perks?: { styles?: { selections?: { perk: number }[]; style?: number }[] };
  playerAugments?: number[];
  teamParticipants?: TeamEntry[];
  // Opcional: multikills si tu backend lo agrega
  largestMultiKill?: number;
};

export function MatchRow({
  match,
  champs,
  staticData,
  mePuuid,
  regional,
  onOpenMatch,
}: {
  match: MatchDetail;
  champs: any;
  staticData: any;
  mePuuid?: string;
  regional: "americas" | "europe" | "asia";
  onOpenMatch?: (m: MatchDetail) => void;
}) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const handleOpen = useCallback(() => {
    if (onOpenMatch) return onOpenMatch(match);
    navigate(`/match/${regional}/${match.matchId}`, { state: { puuid: mePuuid } });
  }, [match, regional, mePuuid, onOpenMatch, navigate]);

  // Helpers
  const c = champs?.byKey?.[String(match.championId)];
  const minutes = Math.max(1, Math.floor((match.gameDuration ?? 0) / 60));
  const cs = (match.totalMinionsKilled ?? 0) + (match.neutralMinionsKilled ?? 0);
  const csPerMin = (cs / minutes).toFixed(1);
  const kp = match.killParticipation ? Math.round(match.killParticipation * 100) : null;
  const itemIds = (match.items ?? []).slice(0, 6);
  const trinket = match.trinket;
  const spells = match.summonerSpells ?? [];
  const keystone = match.perks?.styles?.[0]?.selections?.[0]?.perk;
  const secondary = match.perks?.styles?.[1]?.style;

  const qLabel = (qid?: number) => {
    const labels: Record<number, string> = {
      420: "Solo/Duo",
      440: "Flex",
      450: "ARAM",
      1700: "Arena",
      900: "URF",
    };
    return labels[qid ?? 0] || match.gameMode || "Personalizada";
  };

  const timeAgo = (ms: number) => {
    const diff = Date.now() - ms;
    const m = Math.floor(diff / 60000);
    if (m < 60) return `hace ${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `hace ${h}h`;
    const d = Math.floor(h / 24);
    return `hace ${d}d`;
  };

  const fmtDur = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const multiKillBadge = (n?: number) => {
    if (!n || n < 2) return null;
    const labels = ["Doble", "Triple", "Quadra", "Penta", "¡Legendaria!"];
    const colors = ["text-yellow-300", "text-orange-300", "text-purple-300", "text-pink-300", "text-red-300"];
    return (
      <Badge className={cn("text-xs font-bold", colors[n - 2] || "text-red-300", "bg-black/50")}>
        {labels[n - 2] || `${n} Kill`}
      </Badge>
    );
  };

  const team = (tid: 100 | 200) => (match.teamParticipants ?? []).filter((p) => p.teamId === tid);

  const ItemSlot = ({ id, isTrinket = false }: { id?: number; isTrinket?: boolean }) => {
    const item = id ? staticData?.items?.[String(id)] : null;
    if (!item) {
      return <div className="w-8 h-8 rounded border border-dashed border-gray-700 bg-gray-800/40" />;
    }
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <img
              src={item.icon}
              alt={item.name}
              className={cn("w-8 h-8 rounded object-cover", isTrinket && "border-2 border-yellow-600/60")}
            />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="font-bold">{item.name}</p>
            <p className="text-xs opacity-80" dangerouslySetInnerHTML={{ __html: item.desc || "" }} />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const SpellRuneSlot = ({ id, type }: { id?: number; type: "spell" | "rune" }) => {
    const icon = type === "spell" ? staticData?.spells?.[String(id)]?.icon : staticData?.runes?.[id]?.icon;
    const name = type === "spell" ? staticData?.spells?.[String(id)]?.name : staticData?.runes?.[id]?.name;
    if (!icon) return <div className="w-7 h-7 rounded bg-gray-800/40" />;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <img src={icon} alt={name} className="w-7 h-7 rounded" />
          </TooltipTrigger>
          <TooltipContent>{name}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      className={cn(
        "rounded-xl overflow-hidden border backdrop-blur-sm cursor-pointer group",
        "transition-all hover:scale-[1.01] hover:shadow-2xl",
        match.win
          ? "bg-gradient-to-r from-emerald-900/20 to-transparent border-emerald-500/30"
          : "bg-gradient-to-r from-rose-900/20 to-transparent border-rose-500/30"
      )}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-center gap-4">
          {/* Champion + level */}
          <div className="relative shrink-0">
            <img src={c?.image} className="w-16 h-16 rounded-lg border-2 border-gray-600 object-cover" />
            <div className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded bg-black/80 text-xs font-bold border border-gray-600">
              {match.championLevel}
            </div>
          </div>

          {/* Center info */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-3">
                <span className={cn("text-2xl font-bold", match.win ? "text-emerald-300" : "text-rose-300")}>
                  {match.win ? "VICTORIA" : "DERROTA"}
                </span>
                {multiKillBadge(match.largestMultiKill)}
                <span className="text-sm text-gray-400">{qLabel(match.queueId)}</span>
              </div>
              <div className="text-xs text-gray-400">
                {timeAgo(match.gameStartTimestamp)} · {fmtDur(match.gameDuration)}
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <span className="font-bold text-lg">
                {match.kills}/<span className="text-red-400">{match.deaths}</span>/{match.assists}
              </span>
              <span className="text-gray-300">KDA {match.kda.toFixed(2)}</span>
              <span className="text-gray-400">CS {cs} ({csPerMin}/min)</span>
              {kp && <span className="text-gray-400">KP {kp}%</span>}
            </div>

            {/* KP bar */}
            {kp && (
              <div className="mt-2 w-full max-w-xs">
                <Progress value={kp} className="h-2 bg-gray-700 [&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:to-teal-500" />
              </div>
            )}
          </div>

          {/* Spells + Runes */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-1">
              {spells.slice(0, 2).map((id) => (
                <SpellRuneSlot key={id} id={id} type="spell" />
              ))}
            </div>
            <div className="flex gap-1">
              {keystone && <SpellRuneSlot id={keystone} type="rune" />}
              {secondary && <SpellRuneSlot id={secondary} type="rune" />}
            </div>
          </div>

          {/* Items */}
          <div className="flex items-center gap-1.5">
            {itemIds.map((id, i) => (
              <ItemSlot key={i} id={id} />
            ))}
            {trinket && <ItemSlot id={trinket} isTrinket />}
          </div>
        </div>

        {/* Expandable rosters */}
        {match.teamParticipants?.length ? (
          <div className="mt-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-2"
            >
              Equipos {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden"
              >
                {/* Blue team */}
                <div className="rounded-lg bg-blue-900/10 p-3 border border-blue-500/20">
                  <h4 className="text-blue-300 text-sm font-medium mb-2">Equipo Azul</h4>
                  {team(100).map((p, i) => (
                    <div key={i} className="flex items-center gap-3 py-1">
                      <img src={champs?.byKey?.[String(p.championId)]?.image} className="w-6 h-6 rounded" />
                      <span className={cn("text-xs truncate flex-1", p.puuid === mePuuid && "text-red-300 font-semibold")}>
                        {p.summonerName || "Invocador"}
                      </span>
                      {(p.kills != null || p.deaths != null || p.assists != null) && (
                        <span className="text-xs text-gray-400">
                          {p.kills ?? 0}/{p.deaths ?? 0}/{p.assists ?? 0}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Red team */}
                <div className="rounded-lg bg-rose-900/10 p-3 border border-rose-500/20">
                  <h4 className="text-rose-300 text-sm font-medium mb-2">Equipo Rojo</h4>
                  {team(200).map((p, i) => (
                    <div key={i} className="flex items-center gap-3 py-1">
                      <img src={champs?.byKey?.[String(p.championId)]?.image} className="w-6 h-6 rounded" />
                      <span className={cn("text-xs truncate flex-1", p.puuid === mePuuid && "text-red-300 font-semibold")}>
                        {p.summonerName || "Invocador"}
                      </span>
                      {(p.kills != null || p.deaths != null || p.assists != null) && (
                        <span className="text-xs text-gray-400">
                          {p.kills ?? 0}/{p.deaths ?? 0}/{p.assists ?? 0}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        ) : null}

        {/* Arena augments */}
        {match.playerAugments?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {match.playerAugments.map((id) => {
              const a = staticData?.augments?.[id];
              return a ? (
                <Badge key={id} className="bg-purple-900/30 border-purple-500/40 text-purple-200 text-xs">
                  <img src={a.icon} className="w-4 h-4 mr-1 rounded" />
                  {a.name}
                </Badge>
              ) : null;
            })}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}