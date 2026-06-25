// src/components/TournamentRegisterModal.tsx — glass redesign
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { axiosInstance } from '@/lib/axios';
import { toast } from '@/components/ui/sonner';
import { Plus, Loader2, Check, X, Crown, Users } from 'lucide-react';

interface Player { name: string; riotId: string; }

interface TournamentRegisterModalProps {
  tournamentId: string;
  tournamentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegistered?: () => void;
}

const MIN_PLAYERS = 5;
const MAX_PLAYERS = 7; // 5 titulares + 2 suplentes
const emptyRoster = (): Player[] => Array.from({ length: MIN_PLAYERS }, () => ({ name: '', riotId: '' }));

const fieldCls =
  'w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white ' +
  'placeholder:text-gray-600 outline-none transition-colors focus:border-red-500/50 focus:bg-white/[0.07]';

// Soft Riot ID check — "Name#TAG" with a non-empty tag.
const looksLikeRiotId = (v: string) => /^.+#.{2,}$/.test(v.trim());

export const TournamentRegisterModal = ({
  tournamentId, tournamentName, open, onOpenChange, onRegistered,
}: TournamentRegisterModalProps) => {
  const [teamName, setTeamName] = useState('');
  const [captainRiotId, setCaptainRiotId] = useState('');
  const [contact, setContact] = useState('');
  const [players, setPlayers] = useState<Player[]>(emptyRoster);
  const [loading, setLoading] = useState(false);

  const handlePlayerChange = (index: number, field: keyof Player, value: string) => {
    setPlayers(prev => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };
  const addPlayer = () => setPlayers(prev => (prev.length < MAX_PLAYERS ? [...prev, { name: '', riotId: '' }] : prev));
  const removePlayer = (index: number) =>
    setPlayers(prev => (prev.length > MIN_PLAYERS ? prev.filter((_, i) => i !== index) : prev));

  const reset = () => {
    setTeamName(''); setCaptainRiotId(''); setContact(''); setPlayers(emptyRoster());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (captainRiotId && !looksLikeRiotId(captainRiotId)) {
      toast.error('Riot ID del capitán inválido', { description: 'Formato esperado: Nombre#TAG' });
      return;
    }
    const badPlayer = players.find(p => p.riotId && !looksLikeRiotId(p.riotId));
    if (badPlayer) {
      toast.error('Riot ID inválido', { description: `Revisa "${badPlayer.riotId}" — formato Nombre#TAG` });
      return;
    }
    setLoading(true);
    try {
      await axiosInstance.post(`/api/tournaments/${tournamentId}/register`, {
        teamName, captainRiotId, players, contact,
      });
      toast.success('¡Equipo inscrito!', { description: teamName });
      onRegistered?.();
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast.error('No se pudo inscribir el equipo', {
        description: err.response?.data?.error || 'Error al inscribirse',
      });
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
            {tournamentName} · completa los datos. Los Riot ID deben tener formato <span className="text-gray-300 font-mono">Nombre#TAG</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-gray-400">Nombre del equipo *</Label>
              <input value={teamName} onChange={e => setTeamName(e.target.value)} required
                placeholder="Ej: Dragones QRO" className={fieldCls} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-400 flex items-center gap-1.5"><Crown className="h-3.5 w-3.5 text-yellow-400" />Riot ID del capitán *</Label>
              <input value={captainRiotId} onChange={e => setCaptainRiotId(e.target.value)} required
                placeholder="Player#LA1" className={`${fieldCls} font-mono`} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-400">Contacto (Discord o correo)</Label>
            <input value={contact} onChange={e => setContact(e.target.value)}
              placeholder="discord: player#1234" className={fieldCls} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-gray-400">Jugadores ({players.length}/{MAX_PLAYERS}) · mínimo {MIN_PLAYERS}</Label>
              <Button type="button" size="sm" variant="outline"
                onClick={addPlayer} disabled={players.length >= MAX_PLAYERS}
                className="h-8 text-xs border-white/10 bg-white/[0.04] hover:bg-white/[0.08]">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Suplente
              </Button>
            </div>
            <div className="space-y-2.5">
              {players.map((player, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs font-bold text-gray-400">
                    {i + 1}
                  </span>
                  <input placeholder={`Jugador ${i + 1} — Nombre`} value={player.name}
                    onChange={e => handlePlayerChange(i, 'name', e.target.value)} required
                    className={`${fieldCls} flex-1`} />
                  <input placeholder="Riot ID (Nombre#TAG)" value={player.riotId}
                    onChange={e => handlePlayerChange(i, 'riotId', e.target.value)} required
                    className={`${fieldCls} flex-1 font-mono`} />
                  <button type="button" onClick={() => removePlayer(i)} disabled={players.length <= MIN_PLAYERS}
                    title="Quitar suplente"
                    className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}
              className="border-white/10 bg-white/[0.04] hover:bg-white/[0.08]">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="gradient-red border-0 hover:opacity-90 min-w-36">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              {loading ? 'Enviando...' : 'Inscribirse'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
