import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Plus, Trash2, Calendar, User, Pencil, Check, X } from 'lucide-react';
import { MONTHS } from '@/types/dashboard';
import { clampPercentage, safePercentage } from '@/lib/formatters';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { businessDaysInMonth, DASHBOARD_YEAR } from '@/lib/businessDays';
import { SDR_COUNT, loadSdrNames, saveSdrNames, fetchSdrNamesFromDb, subscribeSdrNames, type SdrNames } from '@/lib/sdrNames';

export interface AgendamentoRow {
  id: string;
  month: string;
  pessoa: string;
  quantidade: number;
  data_lancamento: string;
  created_at: string;
}

interface AgendamentosEditorProps {
  selectedMonth: number;
  agendamentos: AgendamentoRow[];
  metaAgendamentos: number;
  onAddAgendamento: (monthIndex: number, pessoa: string, quantidade: number, dataLancamento?: string) => Promise<void>;
  onDeleteAgendamento: (id: string) => Promise<void>;
  canEdit: boolean;
}

interface SdrSlotProps {
  name: string;
  metaPorPessoa: number;
  metaPorDia: number;
  realizadoHoje: number;
  total: number;
  entries: AgendamentoRow[];
  selectedMonth: number;
  canEdit: boolean;
  onAdd: (pessoa: string, qtd: number, dataLancamento: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRename: (newName: string) => Promise<void>;
  iconColor?: string;
}

const todayISO = () => {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
};

const SdrSlot = ({
  name,
  metaPorPessoa,
  metaPorDia,
  realizadoHoje,
  total,
  entries,
  canEdit,
  onAdd,
  onDelete,
  onRename,
  iconColor = 'text-primary',
}: SdrSlotProps) => {
  const [quantidade, setQuantidade] = useState('');
  const [dataLancamento, setDataLancamento] = useState(todayISO);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const [isSaving, setIsSaving] = useState(false);

  const progresso = safePercentage(total, metaPorPessoa);
  const progressoDia = safePercentage(realizadoHoje, metaPorDia);
  const getProgressColor = (p: number) =>
    p >= 100 ? 'bg-green-500' : p >= 70 ? 'bg-yellow-500' : 'bg-red-500';

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
    setError('');
    setIsAdding(true);
    try {
      await onAdd(name, qtd, dataLancamento);
      setQuantidade('');
      setDataLancamento(todayISO());
    } catch {
      setError('Erro ao adicionar');
    } finally {
      setIsAdding(false);
    }
  };

  const handleSaveName = async () => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      toast({ title: 'Nome inválido', description: 'O nome não pode ficar vazio.', variant: 'destructive' });
      return;
    }
    if (trimmed === name) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onRename(trimmed);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('pt-BR');

  return (
    <div className="border border-border/50 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <User className={`h-4 w-4 ${iconColor}`} />
        {isEditing ? (
          <div className="flex items-center gap-1 flex-1">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') { setIsEditing(false); setEditValue(name); }
              }}
              className="h-7 text-sm font-semibold"
              autoFocus
              disabled={isSaving}
            />
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleSaveName} disabled={isSaving}>
              <Check className="h-4 w-4 text-green-600" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setIsEditing(false); setEditValue(name); }} disabled={isSaving}>
              <X className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ) : (
          <>
            <span className="font-semibold">{name}</span>
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 ml-auto"
                onClick={() => { setEditValue(name); setIsEditing(true); }}
                title="Renomear SDR"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </>
        )}
      </div>

      <div className="flex justify-between text-sm">
        <span>Meta: {metaPorPessoa}</span>
        <span className="font-medium">Realizado: {total}</span>
      </div>

      <Progress value={clampPercentage(progresso)} className={`h-2 ${getProgressColor(progresso)}`} />

      <div className="flex justify-between text-xs bg-muted/30 rounded px-2 py-1">
        <span>Meta/dia: <strong>{metaPorDia}</strong></span>
        <span>Hoje: <strong className={realizadoHoje >= metaPorDia ? 'text-green-600' : 'text-destructive'}>{realizadoHoje}</strong></span>
      </div>

      {canEdit && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              type="date"
              value={dataLancamento}
              onChange={(e) => setDataLancamento(e.target.value)}
              className="flex-1 text-xs"
            />
          </div>
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
            <Button size="sm" onClick={handleAdd} disabled={isAdding}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {entries.length > 0 && (
        <div className="max-h-32 overflow-y-auto space-y-1">
          {entries.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1">
              <span>{formatDate(a.data_lancamento)}</span>
              <span className="font-medium">+{a.quantidade}</span>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                  onClick={() => onDelete(a.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const AgendamentosEditor = ({
  selectedMonth,
  agendamentos,
  metaAgendamentos,
  onAddAgendamento,
  onDeleteAgendamento,
  canEdit,
}: AgendamentosEditorProps) => {
  const [sdrNames, setSdrNames] = useState<SdrNames>(loadSdrNames);

  useEffect(() => {
    fetchSdrNamesFromDb().then(setSdrNames);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'sdr_names_v2') setSdrNames(loadSdrNames());
    };
    const onCustom = () => setSdrNames(loadSdrNames());
    window.addEventListener('storage', onStorage);
    window.addEventListener('sdr-names-updated', onCustom);
    const unsub = subscribeSdrNames(setSdrNames);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('sdr-names-updated', onCustom);
      unsub();
    };
  }, []);


  const monthName = MONTHS[selectedMonth];
  const monthAgendamentos = useMemo(
    () => agendamentos.filter((a) => a.month === monthName),
    [agendamentos, monthName]
  );

  const slots = sdrNames.map((name) => {
    const entries = monthAgendamentos.filter((a) => a.pessoa === name);
    const total = entries.reduce((sum, a) => sum + Number(a.quantidade || 0), 0);
    return { name, entries, total };
  });

  const totalGeral = slots.reduce((s, x) => s + x.total, 0);
  const metaPorPessoa = Math.ceil(metaAgendamentos / SDR_COUNT);
  const progressoGeral = safePercentage(totalGeral, metaAgendamentos);

  const diasUteis = businessDaysInMonth(DASHBOARD_YEAR, selectedMonth);
  const metaPorDia = Math.ceil(metaPorPessoa / Math.max(diasUteis, 1));
  const todayStr = new Date().toISOString().slice(0, 10);

  const iconColors = ['text-primary', 'text-secondary-foreground', 'text-accent-foreground'];

  const handleRename = async (slotIndex: number, newName: string) => {
    const oldName = sdrNames[slotIndex];
    if (oldName === newName) return;

    if (sdrNames.some((n, i) => i !== slotIndex && n === newName)) {
      toast({ title: 'Nome duplicado', description: 'Os SDRs precisam ter nomes diferentes.', variant: 'destructive' });
      throw new Error('duplicate');
    }

    try {
      const { data: affected, error } = await supabase.rpc('rename_sdr' as any, {
        old_name: oldName,
        new_name: newName,
      });
      if (error) throw error;

      const newNames = [...sdrNames] as SdrNames;
      newNames[slotIndex] = newName;
      setSdrNames(newNames);
      saveSdrNames(newNames);
      window.dispatchEvent(new Event('sdr-names-updated'));

      toast({
        title: 'SDR renomeado',
        description: `"${oldName}" → "${newName}" (${affected ?? 0} lançamento${affected === 1 ? '' : 's'} atualizado${affected === 1 ? '' : 's'}).`,
      });
    } catch (e: any) {
      console.error('Erro ao renomear SDR:', e);
      toast({
        title: 'Erro ao renomear',
        description: e?.message ?? 'Tente novamente.',
        variant: 'destructive',
      });
      throw e;
    }
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          📅 Agendamentos - {monthName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-muted/30 rounded-lg p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Meta Total</span>
            <span className="font-bold text-lg">{Math.ceil(metaAgendamentos)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Realizado Total</span>
            <span className="font-bold text-lg text-primary">{totalGeral}</span>
          </div>
          <Progress value={clampPercentage(progressoGeral)} className="h-2" />
          <div className="text-xs text-muted-foreground text-right">
            {progressoGeral.toFixed(1)}% da meta
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {slots.map((slot, i) => {
            const realizadoHoje = slot.entries
              .filter((e) => e.data_lancamento === todayStr)
              .reduce((s, e) => s + Number(e.quantidade || 0), 0);
            return (
              <SdrSlot
                key={i}
                name={slot.name}
                metaPorPessoa={metaPorPessoa}
                metaPorDia={metaPorDia}
                realizadoHoje={realizadoHoje}
                total={slot.total}
                entries={slot.entries}
                selectedMonth={selectedMonth}
                canEdit={canEdit}
                onAdd={(pessoa, qtd, dataLancamento) => onAddAgendamento(selectedMonth, pessoa, qtd, dataLancamento)}
                onDelete={onDeleteAgendamento}
                onRename={(newName) => handleRename(i, newName)}
                iconColor={iconColors[i]}
              />
            );
          })}
        </div>

        <div className="text-xs text-muted-foreground bg-muted/20 rounded p-2 space-y-1">
          <div><strong>Cálculo Mensal:</strong> Meta Agendamentos = Meta 1ª Reuniões ({Math.ceil(metaAgendamentos * 0.6)}) ÷ 60% comparecimento = {Math.ceil(metaAgendamentos)} (dividida entre {SDR_COUNT} SDRs)</div>
          <div><strong>Cálculo Diário:</strong> Meta por SDR ({metaPorPessoa}) ÷ {diasUteis} dias úteis em {monthName} = <strong>{metaPorDia}/dia</strong></div>
        </div>
      </CardContent>
    </Card>
  );
};
