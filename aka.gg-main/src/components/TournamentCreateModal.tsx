// src/components/TournamentCreateModal.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { axiosInstance } from '@/lib/axios';
import { Trophy, Loader2, Copy, Check, Zap } from 'lucide-react';

interface TournamentCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export const TournamentCreateModal = ({
  open,
  onOpenChange,
  onCreated,
}: TournamentCreateModalProps) => {
  const [name, setName] = useState('');
  const [prize, setPrize] = useState('');
  const [startDate, setStartDate] = useState('');
  const [format, setFormat] = useState('5v5 Single Elimination');
  const [description, setDescription] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('16');
  const [createRiot, setCreateRiot] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    id: string;
    name: string;
    riotTournamentId?: number;
    riotCodes?: string[];
  } | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyCode = async (code: string, i: number) => {
    await navigator.clipboard.writeText(code);
    setCopiedIndex(i);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await axiosInstance.post('/api/tournaments', {
        name,
        prize,
        startDate,
        format,
        description,
        maxParticipants: Number(maxParticipants),
        createRiot,
      });
      setResult(data.tournament);
      onCreated();
    } catch (err: any) {
      alert('Error: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setName('');
      setPrize('');
      setStartDate('');
      setFormat('5v5 Single Elimination');
      setDescription('');
      setMaxParticipants('16');
      setCreateRiot(true);
      setResult(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900 text-white border-red-800/50">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Trophy className="h-6 w-6 text-red-500" />
            Crear Nuevo Torneo
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Crea un torneo y opcionalmente genera códigos oficiales de Riot Games.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-900/40 border border-green-700 rounded-lg">
              <p className="font-bold text-green-300 text-lg">¡Torneo creado exitosamente!</p>
              <p className="text-gray-300 mt-1">{result.name}</p>
              {result.riotTournamentId && (
                <p className="text-sm text-gray-400 mt-1">Riot Tournament ID: {result.riotTournamentId}</p>
              )}
            </div>

            {result.riotCodes && result.riotCodes.length > 0 && (
              <div className="space-y-2">
                <p className="font-semibold text-purple-300 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Códigos generados ({result.riotCodes.length})
                </p>
                <p className="text-xs text-gray-400">
                  Comparte estos códigos con los equipos. Los jugadores los ingresan en:
                  <br />
                  <strong className="text-white">LoL Cliente → Jugar → Torneos → Buscar por código</strong>
                </p>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {result.riotCodes.map((code, i) => (
                    <button
                      key={i}
                      onClick={() => copyCode(code, i)}
                      className="flex items-center justify-between gap-2 bg-black/50 border border-purple-700/50 rounded p-2 hover:border-purple-400 transition text-left"
                    >
                      <span className="font-mono text-xs text-purple-300 truncate">{code}</span>
                      {copiedIndex === i ? (
                        <Check className="h-3 w-3 text-green-400 flex-shrink-0" />
                      ) : (
                        <Copy className="h-3 w-3 text-gray-500 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={handleClose} className="w-full bg-red-700 hover:bg-red-800">
              Cerrar
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Nombre del torneo *</Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  placeholder="Ej: LQC Split Verano 2026"
                  className="bg-gray-800 border-gray-700 mt-1"
                />
              </div>
              <div>
                <Label>Premio</Label>
                <Input
                  value={prize}
                  onChange={e => setPrize(e.target.value)}
                  placeholder="Ej: $10,000 MXN"
                  className="bg-gray-800 border-gray-700 mt-1"
                />
              </div>
              <div>
                <Label>Fecha de inicio *</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  required
                  className="bg-gray-800 border-gray-700 mt-1"
                />
              </div>
              <div>
                <Label>Formato</Label>
                <select
                  value={format}
                  onChange={e => setFormat(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm mt-1 text-white"
                >
                  <option value="5v5 Single Elimination">5v5 Single Elimination</option>
                  <option value="5v5 Double Elimination">5v5 Double Elimination</option>
                  <option value="Liga regular + Playoffs">Liga regular + Playoffs</option>
                  <option value="Liga regular + Playoffs Double Elimination">
                    Liga + Playoffs Double Elimination
                  </option>
                </select>
              </div>
              <div>
                <Label>Máx. equipos</Label>
                <select
                  value={maxParticipants}
                  onChange={e => setMaxParticipants(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm mt-1 text-white"
                >
                  {[4, 8, 16, 32, 64].map(n => (
                    <option key={n} value={n}>{n} equipos</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <Label>Descripción</Label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Descripción del torneo..."
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm mt-1 text-white resize-none"
                />
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-purple-950/40 border border-purple-800/50 rounded-lg">
              <input
                type="checkbox"
                id="createRiot"
                checked={createRiot}
                onChange={e => setCreateRiot(e.target.checked)}
                className="mt-0.5 accent-purple-500"
              />
              <div>
                <label htmlFor="createRiot" className="text-purple-300 font-semibold cursor-pointer flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Crear como torneo oficial de Riot
                </label>
                <p className="text-xs text-gray-400 mt-1">
                  Genera códigos reales para partidas en el cliente de LoL. Los jugadores podrán unirse
                  directamente desde el juego.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
                className="border-gray-700"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-red-700 hover:bg-red-800"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {createRiot ? 'Creando en Riot...' : 'Creando...'}
                  </>
                ) : (
                  <>
                    <Trophy className="h-4 w-4 mr-2" />
                    Crear Torneo
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
