import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Plus, Trash2, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MONTHS } from '@/types/dashboard';
import { clampPercentage, safePercentage } from '@/lib/formatters';
import { businessDaysInMonth, DASHBOARD_YEAR } from '@/lib/businessDays';
import { loadSdrNames, type SdrNames } from '@/lib/sdrNames';

export interface ReuniaoEntry {
  id: string;
  month: string;
  tipo: 'primeira' | 'segunda';
  quantidade: number;
  pessoa: string;
  data_lancamento: string;
  created_at: string;
}

interface ReunioesEditorProps {
  selectedMonth: number;
  tipo: 'primeira' | 'segunda';
  label: string;
  icon?: React.ReactNode;
  entries: ReuniaoEntry[];
  meta: number;
  onAdd: (monthIndex: number, tipo: 'primeira' | 'segunda', quantidade: number, dataLancamento?: string, pessoa?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  canEdit: boolean;
}

const todayISO = () => {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
};

export const ReunioesEditor = ({
  selectedMonth,
  tipo,
  label,
  entries,
  meta,
  onAdd,
  onDelete,
  canEdit,
}: ReunioesEditorProps) => {
  const [sdrNames, setSdrNames] = useState<SdrNames>(loadSdrNames);
  const [pessoa, setPessoa] = useState<string>(() => loadSdrNames()[0]);
  const [quantidade, setQuantidade] = useState('');
  const [dataLancamento, setDataLancamento] = useState(todayISO);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const refresh = () => {
      const names = loadSdrNames();
      setSdrNames(names);
      setPessoa((p) => (names.includes(p) ? p : names[0]));
    };
    const onStorage = (e: StorageEvent) => { if (e.key === 'sdr_names_v2') refresh(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('sdr-names-updated', refresh);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('sdr-names-updated', refresh);
    };
  }, []);

  const monthName = MONTHS[selectedMonth];
  const monthEntries = entries.filter(e => e.month === monthName && e.tipo === tipo);
  const total = monthEntries.reduce((sum, e) => sum + Number(e.quantidade || 0), 0);
  const progresso = safePercentage(total, meta);

  const diasUteis = businessDaysInMonth(DASHBOARD_YEAR, selectedMonth);
  const metaPorDia = Math.ceil(meta / Math.max(diasUteis, 1));
  const todayStr = todayISO();
  const realizadoHoje = monthEntries
    .filter((e) => e.data_lancamento === todayStr)
    .reduce((s, e) => s + Number(e.quantidade || 0), 0);

  const totalsPorSdr = sdrNames.map((name) => ({
    name,
    total: monthEntries.filter((e) => e.pessoa === name).reduce((s, e) => s + Number(e.quantidade || 0), 0),
  }));

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-green-500';
    if (progress >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const handleAdd = async () => {
    const qtd = parseInt(quantidade, 10);
    if (isNaN(qtd) || qtd <= 0) {
      setError('Digite um número válido maior que zero');
      return;
    }
    if (!dataLancamento) {
      setError('Selecione a data');
      return;
    }
    if (!pessoa) {
      setError('Selecione o SDR');
      return;
    }
    setError('');
    setIsAdding(true);
    try {
      await onAdd(selectedMonth, tipo, qtd, dataLancamento, pessoa);
      setQuantidade('');
      setDataLancamento(todayISO());
    } catch (e) {
      console.error(e);
      setError('Erro ao adicionar');
    } finally {
      setIsAdding(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="border border-border/50 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <span className="font-semibold">{label}</span>
      </div>

      <div className="flex justify-between text-sm">
        <span>Meta: {meta}</span>
        <span className="font-medium">Realizado: {total}</span>
      </div>

      <Progress
        value={clampPercentage(progresso)}
        className={`h-2 ${getProgressColor(progresso)}`}
      />
      <div className="text-xs text-muted-foreground text-right">
        {progresso.toFixed(1)}% da meta
      </div>

      <div className="flex justify-between text-xs bg-muted/30 rounded px-2 py-1">
        <span>Meta/dia: <strong>{metaPorDia}</strong></span>
        <span>Hoje: <strong className={realizadoHoje >= metaPorDia ? 'text-green-600' : 'text-destructive'}>{realizadoHoje}</strong></span>
      </div>

      <div className="grid grid-cols-3 gap-1 text-[11px]">
        {totalsPorSdr.map((s) => (
          <div key={s.name} className="bg-muted/40 rounded px-2 py-1 text-center">
            <div className="text-muted-foreground truncate" title={s.name}>{s.name}</div>
            <div className="font-bold">{s.total}</div>
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="space-y-2">
          <Select value={pessoa} onValueChange={setPessoa}>
            <SelectTrigger className="text-xs h-9">
              <SelectValue placeholder="Selecione o SDR" />
            </SelectTrigger>
            <SelectContent>
              {sdrNames.map((n) => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={dataLancamento}
            onChange={(e) => setDataLancamento(e.target.value)}
            className="text-xs"
          />
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Qtd"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="flex-1"
              min={1}
            />
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={isAdding}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {monthEntries.length > 0 && (
        <div className="max-h-40 overflow-y-auto space-y-1">
          {monthEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-2 text-xs bg-muted/50 rounded px-2 py-1"
            >
              <span className="text-muted-foreground">{formatDate(entry.data_lancamento)}</span>
              <span className="font-medium truncate flex-1" title={entry.pessoa || '—'}>
                {entry.pessoa || '—'}
              </span>
              <span className="font-bold">+{entry.quantidade}</span>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                  onClick={() => onDelete(entry.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="text-[10px] text-muted-foreground bg-muted/20 rounded px-2 py-1">
        {diasUteis} dias úteis em {monthName}
      </div>
    </div>
  );
};
