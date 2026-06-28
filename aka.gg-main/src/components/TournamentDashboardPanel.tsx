// Dashboard: invitations, my teams (with codes), tournaments I admin
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Trophy, Shield, Users, Copy, Check, Loader2, Crown, Zap, ExternalLink,
} from 'lucide-react';
import { useState } from 'react';
import { useTournamentDashboard, useRespondInvitation } from '@/hooks/queries/tournaments';

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-200 text-xs font-mono hover:bg-purple-500/25 transition"
    >
      {ok ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
      {ok ? 'Copiado' : text.slice(0, 18) + '…'}
    </button>
  );
}

export function TournamentDashboardPanel() {
  const { data, isLoading } = useTournamentDashboard();
  const respond = useRespondInvitation();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-white/40 text-sm py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando torneos…
      </div>
    );
  }

  if (!data) return null;
  const { invitations, myTeams, administrating, linkedRiotId } = data;
  const hasContent = invitations.length > 0 || myTeams.length > 0 || administrating.length > 0;

  return (
    <div className="space-y-6 mb-6">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-red-400" />
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Mis Torneos</h2>
      </div>

      {invitations.length > 0 && (
        <section className="rounded-2xl border border-purple-500/25 bg-purple-500/5 p-5 space-y-3">
          <h3 className="text-xs font-bold text-purple-300 uppercase tracking-widest flex items-center gap-2">
            <Users className="h-3.5 w-3.5" /> Invitaciones pendientes ({invitations.length})
          </h3>
          {invitations.map(inv => (
            <motion.div key={inv.id} layout className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-black/20 border border-white/5">
              <div>
                <p className="font-semibold text-white">{inv.tournamentName}</p>
                <p className="text-sm text-white/50">Equipo <span className="text-red-400">{inv.teamName}</span> · slot {inv.playerName || inv.slotIndex + 1}</p>
                {!linkedRiotId && (
                  <p className="text-xs text-yellow-400/80 mt-1">Vincula tu Riot ID antes de aceptar</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ invId: inv.id, action: 'decline' })}
                  className="px-3 py-1.5 rounded-lg text-xs border border-white/10 text-white/50 hover:text-red-400 transition"
                >Rechazar</button>
                <button
                  disabled={respond.isPending || !linkedRiotId}
                  onClick={() => respond.mutate({ invId: inv.id, action: 'accept' })}
                  className="px-3 py-1.5 rounded-lg text-xs bg-green-700 hover:bg-green-600 text-white font-semibold disabled:opacity-40 transition"
                >Aceptar</button>
              </div>
            </motion.div>
          ))}
        </section>
      )}

      {!hasContent && (
        <p className="text-sm text-white/40 py-2">
          No tienes torneos activos. Las invitaciones y códigos de partida aparecerán aquí cuando te inscriban.
        </p>
      )}

      {myTeams.length > 0 && (
        <section className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5 space-y-3">
          <h3 className="text-xs font-bold text-blue-300 uppercase tracking-widest flex items-center gap-2">
            <Users className="h-3.5 w-3.5" /> Mis equipos ({myTeams.length})
          </h3>
          {myTeams.map(team => (
            <div key={`${team.tournamentId}-${team.teamName}`} className="p-4 rounded-xl bg-black/20 border border-white/5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-white">{team.teamName}</p>
                  <p className="text-sm text-white/50">{team.tournamentName}</p>
                  <span className="inline-block mt-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-white/40">
                    {team.phase}
                  </span>
                  {team.isCaptain && (
                    <span className="inline-flex items-center gap-1 ml-2 text-[10px] text-yellow-400">
                      <Crown className="h-3 w-3" /> Capitán
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Link
                    to={`/tournaments/${team.tournamentId}`}
                    className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-semibold"
                  >
                    Ver torneo <ExternalLink className="h-3 w-3" />
                  </Link>
                  {(team.phase === 'complete' || team.phase === 'active') && (
                    <Link
                      to={`/tournaments/${team.tournamentId}/live`}
                      className="text-[10px] text-white/35 hover:text-white/60 transition"
                    >
                      Ver stats / en vivo →
                    </Link>
                  )}
                </div>
              </div>
              {team.activeMatchCode ? (
                <div className="mt-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <p className="text-[10px] text-purple-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Zap className="h-3 w-3" /> Tu código de partida (solo visible para inscritos)
                  </p>
                  <CopyBtn text={team.activeMatchCode} />
                </div>
              ) : team.phase === 'complete' ? (
                <p className="mt-2 text-[10px] text-white/30">Torneo finalizado — revisa estadísticas en la página del torneo.</p>
              ) : null}
            </div>
          ))}
        </section>
      )}

      {administrating.length > 0 && (
        <section className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-5 space-y-3">
          <h3 className="text-xs font-bold text-orange-300 uppercase tracking-widest flex items-center gap-2">
            <Shield className="h-3.5 w-3.5" /> Torneos que administro ({administrating.length})
          </h3>
          {administrating.map(t => (
            <Link
              key={t.id}
              to={`/tournaments/${t.id}`}
              className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-white/5 hover:border-orange-500/30 transition group"
            >
              <div>
                <p className="font-bold text-white group-hover:text-orange-200 transition">{t.name}</p>
                <p className="text-xs text-white/45">
                  {t.participants}/{t.maxParticipants} equipos · {t.phase}
                  {t.codesAvailable != null ? ` · ${t.codesAvailable} códigos en pool` : ''}
                </p>
              </div>
              <span className="text-xs text-orange-400 font-semibold">Administrar →</span>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}