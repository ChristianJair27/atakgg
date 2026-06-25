// src/components/TournamentCreateModal.tsx — glass redesign
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { axiosInstance } from '@/lib/axios';
import { toast } from '@/components/ui/sonner';
import { Trophy, Loader2, Copy, Check, Zap, CopyCheck } from 'lucide-react';

interface TournamentCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const FORMATS = [
  '5v5 Single Elimination',
  '5v5 Double Elimination',
  'Liga regular + Playoffs',
  'Liga regular + Playoffs Double Elimination',
];

// Shared input look — mirrors the glass inputs used across the tournament pages.
const fieldCls =
  'w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white ' +
  'placeholder:text-gray-600 outline-none transition-colors focus:border-red-500/50 focus:bg-white/[0.07]';

export const TournamentCreateModal = ({ open, onOpenChange, onCreated }: TournamentCreateModalProps) => {
  const [name, setName] = useState('');
  const [prize, setPrize] = useState('');
  const [startDate, setStartDate] = useState('');
  const [format, setFormat] = useState(FORMATS[0]);
  const [description, setDescription] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('16');
  const [createRiot, setCreateRiot] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    id: string; name: string; riotTournamentId?: number; riotCodes?: string[];
  } | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const copyCode = async (code: string, i: number) => {
    await navigator.clipboard.writeText(code);
    setCopiedIndex(i);
    setTimeout(() => setCopiedIndex(null), 2000);
  };
  const copyAll = async (codes: string[]) => {
    await navigator.clipboard.writeText(codes.join('\n'));
    setCopiedAll(true);
    toast.success(`${codes.length} códigos copiados`);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await axiosInstance.post('/api/tournaments', {
        name, prize, startDate, format, description,
        maxParticipants: Number(maxParticipants), createRiot,
      });
      setResult(data.tournament);
      toast.success('Torneo creado', { description: data.tournament?.name });
      onCreated();
    } catch (err: any) {
      toast.error('No se pudo crear el torneo', {
        description: err.response?.data?.error || err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setName(''); setPrize(''); setStartDate(''); setFormat(FORMATS[0]);
    setDescription(''); setMaxParticipants('16'); setCreateRiot(true); setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0a0a0c]/95 backdrop-blur-xl text-white border border-white/[0.08] shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2.5">
            <span className="p-1.5 rounded-xl bg-red-500/10 border border-red-500/20">
              <Trophy className="h-5 w-5 text-red-400" />
            </span>
            Crear nuevo torneo
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Crea un torneo y, opcionalmente, genera códigos oficiales de Riot Games.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl border border-green-500/30 bg-green-500/10">
              <p className="font-bold text-green-300 text-lg flex items-center gap-2">
                <Check className="h-5 w-5" /> ¡Torneo creado!
              </p>
              <p className="text-gray-300 mt-1">{result.name}</p>
              {result.riotTournamentId && (
                <p className="text-xs text-gray-500 mt-1">Riot Tournament ID: {result.riotTournamentId}</p>
              )}
            </div>

            {result.riotCodes && result.riotCodes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-purple-300 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Códigos generados ({result.riotCodes.length})
                  </p>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => copyAll(result.riotCodes!)}
                    className="h-8 text-xs border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
                  >
                    {copiedAll ? <CopyCheck className="h-3.5 w-3.5 mr-1.5 text-green-400" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                    Copiar todos
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Compártelos con los equipos. Se ingresan en:{' '}
                  <strong className="text-gray-300">LoL → Jugar → Torneos → Buscar por código</strong>.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {result.riotCodes.map((code, i) => (
                    <button
                      key={i}
                      onClick={() => copyCode(code, i)}
                      className="flex items-center justify-between gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl p-2.5 hover:border-purple-400/50 hover:bg-white/[0.07] transition text-left"
                    >
                      <span className="font-mono text-xs text-purple-300 truncate">{code}</span>
                      {copiedIndex === i
                        ? <Check className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                        : <Copy className="h-3.5 w-3.5 text-gray-600 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={handleClose} className="w-full gradient-red border-0 hover:opacity-90">
              Cerrar
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-gray-400">Nombre del torneo *</Label>
                <input
                  value={name} onChange={e => setName(e.target.value)} required
                  placeholder="Ej: LQC Split Verano 2026" className={fieldCls}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-400">Premio</Label>
                <input
                  value={prize} onChange={e => setPrize(e.target.value)}
                  placeholder="Ej: $10,000 MXN" className={fieldCls}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-400">Fecha de inicio *</Label>
                <input
                  type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  required className={`${fieldCls} [color-scheme:dark]`}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-400">Formato</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger className="bg-white/[0.05] border-white/[0.08] rounded-xl h-[42px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-400">Máx. equipos</Label>
                <Select value={maxParticipants} onValueChange={setMaxParticipants}>
                  <SelectTrigger className="bg-white/[0.05] border-white/[0.08] rounded-xl h-[42px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[4, 8, 16, 32, 64].map(n => <SelectItem key={n} value={String(n)}>{n} equipos</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-gray-400">Descripción</Label>
                <Textarea
                  value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Descripción del torneo..." rows={3}
                  className="bg-white/[0.05] border-white/[0.08] rounded-xl resize-none focus-visible:border-red-500/50"
                />
              </div>
            </div>

            <label
              htmlFor="createRiot"
              className="flex items-start gap-3 p-4 rounded-2xl border border-purple-500/30 bg-purple-500/[0.07] cursor-pointer hover:bg-purple-500/10 transition-colors"
            >
              <input
                type="checkbox" id="createRiot" checked={createRiot}
                onChange={e => setCreateRiot(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-purple-500"
              />
              <div>
                <span className="text-purple-300 font-semibold flex items-center gap-2">
                  <Zap className="h-4 w-4" /> Crear como torneo oficial de Riot
                </span>
                <p className="text-xs text-gray-400 mt-1">
                  Genera códigos reales para partidas en el cliente de LoL. Los jugadores se unen
                  directamente desde el juego.
                </p>
              </div>
            </label>

            <div className="flex justify-end gap-3 pt-1">
              <Button
                type="button" variant="outline" onClick={handleClose} disabled={loading}
                className="border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="gradient-red border-0 hover:opacity-90 min-w-40">
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{createRiot ? 'Creando en Riot...' : 'Creando...'}</>
                ) : (
                  <><Trophy className="h-4 w-4 mr-2" />Crear torneo</>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
