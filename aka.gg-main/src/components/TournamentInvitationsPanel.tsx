// Pending tournament invitations on user dashboard
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Check, X, Mail, Loader2 } from 'lucide-react';
import { useTournamentInvitations, useRespondInvitation } from '@/hooks/queries/tournaments';

export function TournamentInvitationsPanel() {
  const { data: invitations = [], isLoading } = useTournamentInvitations();
  const respond = useRespondInvitation();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-white/40 text-sm py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando invitaciones...
      </div>
    );
  }

  if (invitations.length === 0) return null;

  return (
    <div className="space-y-3 mb-6 p-5 rounded-2xl border border-purple-500/20 bg-purple-500/5">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-purple-400" />
        <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
          Invitaciones a torneos ({invitations.length})
        </h3>
      </div>

      <AnimatePresence>
        {invitations.map((inv) => (
          <motion.div
            key={inv.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="rounded-xl border border-purple-500/25 bg-purple-500/5 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="h-4 w-4 text-purple-400 flex-shrink-0" />
                  <Link
                    to={`/tournaments/${inv.tournamentId}`}
                    className="font-semibold text-white hover:text-purple-300 transition truncate"
                  >
                    {inv.tournamentName}
                  </Link>
                </div>
                <p className="text-sm text-white/60">
                  Equipo <span className="text-red-400 font-medium">{inv.teamName}</span>
                  {inv.invitedByName && <> · invitado por {inv.invitedByName}</>}
                </p>
                {inv.playerName && (
                  <p className="text-xs text-white/40 mt-1">Slot: {inv.playerName}</p>
                )}
              </div>

              <div className="flex gap-2 flex-shrink-0">
                <button
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ invId: inv.id, action: 'decline' })}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-white/50
                    hover:border-red-500/30 hover:text-red-400 text-xs transition disabled:opacity-40"
                >
                  <X className="h-3.5 w-3.5" /> Rechazar
                </button>
                <button
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ invId: inv.id, action: 'accept' })}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-700 hover:bg-green-600
                    text-white text-xs font-semibold transition disabled:opacity-40"
                >
                  {respond.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Aceptar
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}