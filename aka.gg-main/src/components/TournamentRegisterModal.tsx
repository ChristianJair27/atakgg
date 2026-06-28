// Tournament team registration — linked LoL account auto-fill + email invitations
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { axiosInstance } from '@/lib/axios';
import { toast } from '@/components/ui/sonner';
import { useOverview } from '@/hooks/queries/players';
import { useAuth } from '@/features/auth/useAuth';
import { Plus, Loader2, Check, X, Crown, Users, Link2, Mail, Shield } from 'lucide-react';

interface PlayerSlot {
  name: string;
  riotId: string;
  inviteEmail: string;
  mode: 'riot' | 'invite';
}

interface TournamentRegisterModalProps {
  tournamentId: string;
  tournamentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegistered?: () => void;
}

const MIN_PLAYERS = 5;
const MAX_PLAYERS = 7;

const emptySlot = (): PlayerSlot => ({ name: '', riotId: '', inviteEmail: '', mode: 'riot' });
const emptyRoster = (): PlayerSlot[] => Array.from({ length: MIN_PLAYERS }, emptySlot);

const fieldCls =
  'w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white ' +
  'placeholder:text-gray-600 outline-none transition-colors focus:border-red-500/50 focus:bg-white/[0.07]';

const looksLikeRiotId = (v: string) => /^.+#.{2,}$/.test(v.trim());

export const TournamentRegisterModal = ({
  tournamentId, tournamentName, open, onOpenChange, onRegistered,
}: TournamentRegisterModalProps) => {
  const { isAuthenticated } = useAuth();
  const { data: overview } = useOverview();
  const linked = overview?.linked ? overview.profile : null;
  const linkedRiotId = linked?.gameName && linked?.tagLine
    ? `${linked.gameName}#${linked.tagLine}` : '';

  const [teamName, setTeamName] = useState('');
  const [contact, setContact] = useState('');
  const [players, setPlayers] = useState<PlayerSlot[]>(emptyRoster);
  const [loading, setLoading] = useState(false);

  // Pre-fill captain slot (index 0) with linked account
  useEffect(() => {
    if (!open || !linkedRiotId) return;
    setPlayers(prev => prev.map((p, i) =>
      i === 0 ? { ...p, riotId: linkedRiotId, mode: 'riot' as const, name: p.name || linked?.gameName || '' } : p
    ));
  }, [open, linkedRiotId, linked?.gameName]);

  const handlePlayerChange = (index: number, field: keyof PlayerSlot, value: string) => {
    setPlayers(prev => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  const setPlayerMode = (index: number, mode: 'riot' | 'invite') => {
    setPlayers(prev => prev.map((p, i) =>
      i === index ? { ...p, mode, riotId: mode === 'invite' ? '' : p.riotId, inviteEmail: mode === 'riot' ? '' : p.inviteEmail } : p
    ));
  };

  const addPlayer = () => setPlayers(prev => (prev.length < MAX_PLAYERS ? [...prev, emptySlot()] : prev));
  const removePlayer = (index: number) =>
    setPlayers(prev => (prev.length > MIN_PLAYERS ? prev.filter((_, i) => i !== index) : prev));

  const reset = () => {
    setTeamName(''); setContact(''); setPlayers(emptyRoster());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      toast.error('Inicia sesión para inscribir tu equipo');
      return;
    }
    if (!linkedRiotId) {
      toast.error('Vincula tu cuenta de LoL primero', {
        description: 'Ve a tu Dashboard y conecta tu Riot ID antes de inscribirte.',
      });
      return;
    }

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.name.trim()) {
        toast.error(`Nombre requerido en jugador ${i + 1}`);
        return;
      }
      if (p.mode === 'invite') {
        if (!p.inviteEmail.trim() || !p.inviteEmail.includes('@')) {
          toast.error(`Correo inválido en jugador ${i + 1}`);
          return;
        }
      } else if (!p.riotId.trim() || !looksLikeRiotId(p.riotId)) {
        toast.error(`Riot ID inválido en jugador ${i + 1}`, { description: 'Formato: Nombre#TAG' });
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        teamName,
        captainRiotId: linkedRiotId,
        contact,
        players: players.map(p => ({
          name: p.name.trim(),
          ...(p.mode === 'invite'
            ? { inviteEmail: p.inviteEmail.trim() }
            : { riotId: p.riotId.trim() }),
        })),
      };
      const { data } = await axiosInstance.post(`/api/tournaments/${tournamentId}/register`, payload);
      toast.success(data.message || '¡Equipo inscrito!', { description: teamName });
      onRegistered?.();
      reset();
      onOpenChange(false);
    } catch (err: any) {
      const code = err.response?.data?.code;
      if (code === 'RIOT_NOT_LINKED' || code === 'CAPTAIN_RIOT_REQUIRED') {
        toast.error('Vincula tu cuenta de LoL en el Dashboard');
      } else {
        toast.error('No se pudo inscribir el equipo', {
          description: err.response?.data?.error || 'Error al inscribirse',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!loading) onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-[#0a0a0c]/95 backdrop-blur-xl text-white border border-white/[0.08] shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2.5">
            <span className="p-1.5 rounded-xl bg-red-500/10 border border-red-500/20">
              <Users className="h-5 w-5 text-red-400" />
            </span>
            Inscribir equipo
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {tournamentName} · tu Riot ID se toma de tu perfil vinculado. Invita compañeros por correo ATAK.GG.
          </DialogDescription>
        </DialogHeader>

        {!isAuthenticated && (
          <div className="p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-200 text-sm">
            <Link to="/login" className="underline font-semibold">Inicia sesión</Link> para inscribir tu equipo.
          </div>
        )}

        {isAuthenticated && !linkedRiotId && (
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-sm flex items-start gap-3">
            <Link2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Cuenta de LoL no vinculada</p>
              <p className="text-red-300/80 mt-1">
                Ve a tu <Link to="/dashboard" className="underline">Dashboard</Link> y conecta tu Riot ID antes de inscribirte.
              </p>
            </div>
          </div>
        )}

        {linkedRiotId && (
          <div className="p-3 rounded-xl border border-green-500/25 bg-green-500/10 flex items-center gap-3">
            <Shield className="h-5 w-5 text-green-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-green-400/80 uppercase tracking-wider font-semibold">Tu cuenta (capitán)</p>
              <p className="font-mono text-sm text-green-200 truncate">{linkedRiotId}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-gray-400">Nombre del equipo *</Label>
              <input value={teamName} onChange={e => setTeamName(e.target.value)} required
                placeholder="Ej: Dragones QRO" className={fieldCls} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-400">Contacto (Discord o correo)</Label>
              <input value={contact} onChange={e => setContact(e.target.value)}
                placeholder="discord: player#1234" className={fieldCls} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-gray-400">
                Roster ({players.length}/{MAX_PLAYERS}) · mínimo {MIN_PLAYERS}
              </Label>
              <Button type="button" size="sm" variant="outline"
                onClick={addPlayer} disabled={players.length >= MAX_PLAYERS}
                className="h-8 text-xs border-white/10 bg-white/[0.04] hover:bg-white/[0.08]">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Suplente
              </Button>
            </div>

            <div className="space-y-3">
              {players.map((player, i) => (
                <div key={i} className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs font-bold text-gray-400">
                      {i + 1}
                    </span>
                    {i === 0 && (
                      <span className="text-xs text-yellow-400 flex items-center gap-1">
                        <Crown className="h-3 w-3" /> Capitán
                      </span>
                    )}
                    {i > 0 && (
                      <div className="flex gap-1 ml-auto">
                        <button type="button" onClick={() => setPlayerMode(i, 'riot')}
                          className={`text-[10px] px-2 py-1 rounded-lg border transition ${
                            player.mode === 'riot' ? 'bg-white/10 border-white/20 text-white' : 'border-white/5 text-gray-600'
                          }`}>
                          Riot ID
                        </button>
                        <button type="button" onClick={() => setPlayerMode(i, 'invite')}
                          className={`text-[10px] px-2 py-1 rounded-lg border transition flex items-center gap-1 ${
                            player.mode === 'invite' ? 'bg-purple-500/20 border-purple-500/30 text-purple-200' : 'border-white/5 text-gray-600'
                          }`}>
                          <Mail className="h-3 w-3" /> Invitar
                        </button>
                      </div>
                    )}
                  </div>

                  <input placeholder={`Nombre del jugador ${i + 1}`} value={player.name}
                    onChange={e => handlePlayerChange(i, 'name', e.target.value)} required
                    className={fieldCls} />

                  {i === 0 ? (
                    <input value={linkedRiotId || player.riotId} readOnly disabled
                      className={`${fieldCls} font-mono opacity-60 cursor-not-allowed`} />
                  ) : player.mode === 'invite' ? (
                    <input placeholder="correo@ejemplo.com (cuenta ATAK.GG)" value={player.inviteEmail}
                      onChange={e => handlePlayerChange(i, 'inviteEmail', e.target.value)} required
                      type="email" className={fieldCls} />
                  ) : (
                    <input placeholder="Riot ID (Nombre#TAG)" value={player.riotId}
                      onChange={e => handlePlayerChange(i, 'riotId', e.target.value)} required
                      className={`${fieldCls} font-mono`} />
                  )}

                  {i > 0 && (
                    <button type="button" onClick={() => removePlayer(i)} disabled={players.length <= MIN_PLAYERS}
                      className="text-xs text-gray-600 hover:text-red-400 transition disabled:opacity-20 flex items-center gap-1">
                      <X className="h-3 w-3" /> Quitar suplente
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}
              className="border-white/10 bg-white/[0.04] hover:bg-white/[0.08]">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !isAuthenticated || !linkedRiotId}
              className="gradient-red border-0 hover:opacity-90 min-w-36">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              {loading ? 'Enviando...' : 'Inscribirse'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};