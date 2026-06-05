import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Plus, Trash2, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MONTHS } from '@/types/dashboard';
import { clampPercentage, safePercentage } from '@/lib/formatters';
import { businessDaysInMonth, businessDaysRemainingInMonth, DASHBOARD_YEAR } from '@/lib/businessDays';
import { loadSdrNames, fetchSdrNamesFromDb, subscribeSdrNames, type SdrNames } from '@/lib/sdrNames';

export interface ReuniaoEntry {
  id: string;
  month: string;
  tipo: 'primeira' | 'segunda';
  quantidade: number;
  pessoa: string;
  lead_nome: string;
  origem: string;
  data_lancamento: string;
  created_at: string;
}

export const ORIGENS_LEAD = [
  'Tráfego Pago',
  'Social Selling',
  'Prospecção Fria',
  'Indicação',
  'Recuperação',
  'Orgânico',
  'Outros',
] as const;

interface ReunioesEditorProps {
  selectedMonth: number;
  tipo: 'primeira' | 'segunda';
  label: string;
  icon?: React.ReactNode;
  entries: ReuniaoEntry[];
  meta: number;
  onAdd: (monthIndex: number, tipo: 'primeira' | 'segunda', quantidade: number, dataLancamento?: string, pessoa?: string, leadNome?: string, origem?: string) => Promise<void>;
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
  const [leadNome, setLeadNome] = useState('');
  const [origem, setOrigem] = useState<string>('');
  const [dataLancamento, setDataLancamento] = useState(todayISO);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const apply = (names: SdrNames) => {
      setSdrNames(names);
      setPessoa((p) => (names.includes(p) ? p : names[0]));
    };
    fetchSdrNamesFromDb().then(apply);
    const refresh = () => apply(loadSdrNames());
    const onStorage = (e: StorageEvent) => { if (e.key === 'sdr_names_v2') refresh(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('sdr-names-updated', refresh);
    const unsub = subscribeSdrNames(apply);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('sdr-names-updated', refresh);
      unsub();
    };
  }, []);

  const monthName = MONTHS[selectedMonth];
  const monthEntries = entries.filter(e => e.month === monthName && e.tipo === tipo);
  const total = monthEntries.reduce((sum, e) => sum + Number(e.quantidade || 0), 0);
  const progresso = safePercentage(total, meta);

  const diasUteis = businessDaysInMonth(DASHBOARD_YEAR, selectedMonth);
  const diasUteisRestantes = businessDaysRemainingInMonth(DASHBOARD_YEAR, selectedMonth);
  const faltaParaMeta = Math.max(0, meta - total);
  const metaPorDia = Math.ceil(meta / Math.max(diasUteis, 1));
  const metaDiariaRestante = diasUteisRestantes > 0 ? Math.ceil(faltaParaMeta / diasUteisRestantes) : faltaParaMeta;
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
      await onAdd(selectedMonth, tipo, qtd, dataLancamento, pessoa, leadNome, origem);
      setQuantidade('');
      setLeadNome('');
      setOrigem('');
      setDataLancamento(todayISO());
    } catch (e) {
      console.error(e);
      setError('Erro ao adicionar');
    } finally {
      setIsAdding(false);
    }
  };

  const formatDate = (dateStr: string) => {
    // Parse YYYY-MM-DD as local date to avoid UTC shifting back one day
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-3 backdrop-blur-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))] text-primary-foreground shadow-[0_4px_14px_-4px_hsl(var(--gold)/0.5)]">
          <Users className="h-4 w-4" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Etapa funil</p>
          <span className="text-sm font-bold text-foreground">{label}</span>
        </div>
      </div>

      <div className="flex justify-between gap-3 text-sm">
        <span>Meta: {meta}</span>
        <span className="font-bold text-primary">Realizado: {total}</span>
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

      <div className="grid grid-cols-3 gap-2 rounded-lg border border-border/60 bg-muted/20 p-2 text-center text-[11px]">
        <div>
          <div className="text-muted-foreground">Faltam</div>
          <div className="font-bold text-foreground">{faltaParaMeta}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Dias úteis</div>
          <div className="font-bold text-foreground">{diasUteisRestantes}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Ritmo</div>
          <div className="font-bold text-primary">{metaDiariaRestante}/dia</div>
        </div>
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
          <Input
            type="text"
            placeholder="Nome do interessado (opcional)"
            value={leadNome}
            onChange={(e) => setLeadNome(e.target.value)}
          />
          <Select value={origem} onValueChange={setOrigem}>
            <SelectTrigger>
              <SelectValue placeholder="Origem do interessado (opcional)" />
            </SelectTrigger>
            <SelectContent>
              {ORIGENS_LEAD.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              className="flex items-start justify-between gap-2 text-xs bg-muted/50 rounded px-2 py-1"
            >
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{formatDate(entry.data_lancamento)}</span>
                  <span className="font-medium truncate" title={entry.pessoa || '—'}>
                    {entry.pessoa || '—'}
                  </span>
                </div>
                {(entry.lead_nome || entry.origem) && (
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    {entry.lead_nome && (
                      <span className="text-foreground/80 truncate" title={entry.lead_nome}>
                        👤 {entry.lead_nome}
                      </span>
                    )}
                    {entry.origem && (
                      <span className="text-[10px] bg-primary/10 text-primary rounded px-1.5 py-0.5">
                        {entry.origem}
                      </span>
                    )}
                  </div>
                )}
              </div>
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
        {diasUteis} dias úteis no mês · {diasUteisRestantes} até o fim de {monthName}
      </div>
    </div>
  );
};
