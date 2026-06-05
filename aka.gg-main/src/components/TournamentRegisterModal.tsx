// src/components/TournamentRegisterModal.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { axiosInstance } from '@/lib/axios';
import { Plus, User, Mail, Loader2 } from 'lucide-react';

interface Player {
  name: string;
  riotId: string;
}

interface TournamentRegisterModalProps {
  tournamentId: string;
  tournamentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TournamentRegisterModal = ({ tournamentId, tournamentName, open, onOpenChange }: TournamentRegisterModalProps) => {
  const [teamName, setTeamName] = useState('');
  const [captainRiotId, setCaptainRiotId] = useState('');
  const [contact, setContact] = useState('');
  const [players, setPlayers] = useState<Player[]>([
    { name: '', riotId: '' },
    { name: '', riotId: '' },
    { name: '', riotId: '' },
    { name: '', riotId: '' },
    { name: '', riotId: '' },
  ]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handlePlayerChange = (index: number, field: 'name' | 'riotId', value: string) => {
    const newPlayers = [...players];
    newPlayers[index][field] = value;
    setPlayers(newPlayers);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      await axiosInstance.post(`/api/tournaments/${tournamentId}/register`, {
        teamName,
        captainRiotId,
        players,
        contact,
      });
      setSuccess(true);
      setTimeout(() => onOpenChange(false), 3000); // Cierra tras éxito
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al inscribirse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-gray-900 text-white border-red-800/50">
        <DialogHeader>
          <DialogTitle className="text-2xl">Inscribir equipo - {tournamentName}</DialogTitle>
          <DialogDescription className="text-gray-400">
            Completa los datos de tu equipo. Todos los Riot ID deben ser válidos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nombre del equipo</Label>
              <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} required />
            </div>
            <div>
              <Label>Riot ID del capitán (ej: Player#LA1)</Label>
              <Input value={captainRiotId} onChange={(e) => setCaptainRiotId(e.target.value)} required />
            </div>
          </div>

          <div>
            <Label>Contacto (Discord o correo)</Label>
            <Input value={contact} onChange={(e) => setContact(e.target.value)} type="text" placeholder="discord: player#1234" />
          </div>

          <div className="space-y-4">
            <Label>Jugadores (mínimo 5)</Label>
            {players.map((player, i) => (
              <div key={i} className="grid grid-cols-2 gap-4">
                <Input
                  placeholder={`Jugador ${i + 1} - Nombre`}
                  value={player.name}
                  onChange={(e) => handlePlayerChange(i, 'name', e.target.value)}
                  required
                />
                <Input
                  placeholder="Riot ID"
                  value={player.riotId}
                  onChange={(e) => handlePlayerChange(i, 'riotId', e.target.value)}
                  required
                />
              </div>
            ))}
          </div>

          {success && (
            <div className="p-4 bg-green-900/50 border border-green-600 rounded-lg text-green-300 text-center">
              ¡Inscripción exitosa! Tu equipo está registrado.
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-red-600 hover:bg-red-700">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              {loading ? 'Enviando...' : 'Inscribirse'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};