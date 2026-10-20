import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, User, Users, Pencil, Check, X, MessageSquare, Filter, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { MONTHS } from '@/types/dashboard';
import { clampPercentage, safePercentage } from '@/lib/formatters';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { businessDaysInMonth, businessDaysRemainingInMonth, DASHBOARD_YEAR } from '@/lib/businessDays';
import { fetchFunis } from '@/lib/funis';
import { SDR_COUNT, loadSdrNames, saveSdrNames, fetchSdrNamesFromDb, subscribeSdrNames, type SdrNames } from '@/lib/sdrNames';

export interface ReuniaoEntry {
  id: string;
  month: string;
  tipo: 'primeira' | 'segunda';
  quantidade: number;
  pessoa: string;
  lead_nome: string;
  origem: string;
  funil: string;
  comentario: string;
  qualificacao: string;
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

// Origem que alimenta o funil de Growth / tráfego pago (usada em agendamentos e reuniões)
export const ORIGEM_TRAFEGO_LEAD = 'Tráfego Pago';

// Resultado da 1ª reunião
export const QUALIFICACOES = ['Qualificado', 'Desqualificado'] as const;
export type Qualificacao = (typeof QUALIFICACOES)[number];

interface ReunioesEditorProps {
  selectedMonth: number;
  tipo: 'primeira' | 'segunda';
  label: string;
  icon?: React.ReactNode;
  entries: ReuniaoEntry[];
  meta: number;
  realizadoFallback?: number;
  onAdd: (
    monthIndex: number,
    tipo: 'primeira' | 'segunda',
    quantidade: number,
    dataLancamento?: string,
    pessoa?: string,
    leadNome?: string,
    origem?: string,
    funil?: string,
    comentario?: string,
    qualificacao?: string,
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdateComentario?: (id: string, comentario: string) => Promise<void>;
  onUpdateQualificacao?: (id: string, qualificacao: string) => Promise<void>;
  canEdit: boolean;
}

const todayISO = () => {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
};

const formatDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
};

interface QualificacaoLeadProps {
  entry: ReuniaoEntry;
  canEdit: boolean;
  onSave: (valor: string) => Promise<void>;
}

/** Qualificado/Desqualificado da 1ª reunião, trocável direto na lista. */
const QualificacaoLead = ({ entry, canEdit, onSave }: QualificacaoLeadProps) => {
  const [salvando, setSalvando] = useState(false);
  const valor = entry.qualificacao ?? '';

  const trocar = async (novo: string) => {
    if (novo === valor) return;
    setSalvando(true);
    try {
      await onSave(novo);
    } catch {
      toast({ title: 'Erro ao salvar', description: 'Tente novamente.', variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  if (!canEdit) {
    if (!valor) return null;
    return (
      <span className={`mt-1 w-fit text-[10px] rounded px-1.5 py-0.5 inline-flex items-center gap-1 ${
        valor === 'Qualificado'
          ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]'
          : 'bg-destructive/15 text-destructive'
      }`}>
        {valor === 'Qualificado' ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
        {valor}
      </span>
    );
  }

  return (
    <div className="mt-1 flex gap-1">
      {QUALIFICACOES.map((q) => {
        const ativo = valor === q;
        const positivo = q === 'Qualificado';
        return (
          <button
            key={q}
            type="button"
            disabled={salvando}
            onClick={() => trocar(ativo ? '' : q)}
            title={ativo ? 'Clique para desmarcar' : `Marcar como ${q}`}
            className={`text-[10px] rounded px-1.5 py-0.5 inline-flex items-center gap-1 border transition-colors disabled:opacity-50 ${
              ativo
                ? positivo
                  ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/40'
                  : 'bg-destructive/15 text-destructive border-destructive/40'
                : 'text-muted-foreground border-border/60 hover:border-border'
            }`}
          >
            {positivo ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
            {q}
          </button>
        );
      })}
    </div>
  );
};

interface ComentarioLeadProps {
  entry: ReuniaoEntry;
  canEdit: boolean;
  onSave: (texto: string) => Promise<void>;
}

/** Situação do lead: some quando vazio e sem permissão, para não poluir a lista. */
const ComentarioLead = ({ entry, canEdit, onSave }: ComentarioLeadProps) => {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(entry.comentario ?? '');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { setTexto(entry.comentario ?? ''); }, [entry.comentario]);

  const salvar = async () => {
    setSalvando(true);
    try {
      await onSave(texto);
      setEditando(false);
    } catch {
      toast({ title: 'Erro ao salvar', description: 'Tente novamente.', variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  if (editando) {
    return (
      <div className="mt-1 space-y-1">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Como está a situação dele?"
          className="text-[11px] min-h-[52px]"
          autoFocus
          disabled={salvando}
        />
        <div className="flex gap-1">
          <Button size="sm" className="h-6 text-[10px] px-2" onClick={salvar} disabled={salvando}>
            Salvar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] px-2"
            onClick={() => { setTexto(entry.comentario ?? ''); setEditando(false); }}
            disabled={salvando}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  if (!entry.comentario) {
    if (!canEdit) return null;
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary"
      >
        <MessageSquare className="h-2.5 w-2.5" />
        Registrar situação
      </button>
    );
  }

  return (
    <div className="mt-1 flex items-start gap-1 rounded bg-background/60 px-1.5 py-1">
      <MessageSquare className="h-2.5 w-2.5 mt-0.5 shrink-0 text-muted-foreground" />
      <p className="text-[11px] text-foreground/90 whitespace-pre-wrap break-words flex-1">{entry.comentario}</p>
      {canEdit && (
        <Button
          variant="ghost"
          size="sm"
          className="h-4 w-4 p-0 shrink-0"
          onClick={() => setEditando(true)}
          title="Editar situação"
        >
          <Pencil className="h-2.5 w-2.5" />
        </Button>
      )}
    </div>
  );
};

interface SdrSlotProps {
  name: string;
  metaPorPessoa: number;
  metaPorDia: number;
  diasUteisRestantes: number;
  realizadoHoje: number;
  total: number;
  entries: ReuniaoEntry[];
  canEdit: boolean;
  onAdd: (pessoa: string, qtd: number, dataLancamento: string, leadNome: string, origem: string, funil: string, comentario: string, qualificacao: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRename: (newName: string) => Promise<void>;
  onUpdateComentario?: (id: string, comentario: string) => Promise<void>;
  onUpdateQualificacao?: (id: string, qualificacao: string) => Promise<void>;
  /** 2ª reunião pede funil de origem e acompanhamento da situação do lead. */
  detalharLead?: boolean;
  /** 1ª reunião registra se o lead saiu qualificado. */
  qualificarLead?: boolean;
  funis?: string[];
  iconColor?: string;
}

const SdrSlot = ({
  name,
  metaPorPessoa,
  metaPorDia,
  diasUteisRestantes,
  realizadoHoje,
  total,
  entries,
  canEdit,
  onAdd,
  onDelete,
  onRename,
  onUpdateComentario,
  onUpdateQualificacao,
  detalharLead = false,
  qualificarLead = false,
  funis = [],
  iconColor = 'text-primary',
}: SdrSlotProps) => {
  const [quantidade, setQuantidade] = useState('');
  const [dataLancamento, setDataLancamento] = useState(todayISO);
  const [leadNome, setLeadNome] = useState('');
  const [origem, setOrigem] = useState<string>('');
  const [funil, setFunil] = useState<string>('');
  const [comentario, setComentario] = useState('');
  const [qualificacao, setQualificacao] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const [isSaving, setIsSaving] = useState(false);

  const progresso = safePercentage(total, metaPorPessoa);
  const faltaParaMeta = Math.max(0, metaPorPessoa - total);
  const metaDiariaRestante = diasUteisRestantes > 0 ? Math.ceil(faltaParaMeta / diasUteisRestantes) : faltaParaMeta;
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
      await onAdd(name, qtd, dataLancamento, leadNome, origem, funil, comentario, qualificacao);
      setQuantidade('');
      setLeadNome('');
      setOrigem('');
      setFunil('');
      setComentario('');
      setQualificacao('');
      setDataLancamento(todayISO());
    } catch (e) {
      console.error(e);
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

      <div className="grid grid-cols-3 gap-1 rounded-lg border border-border/60 bg-muted/20 p-2 text-center text-[10px]">
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

      {canEdit && (
        <div className="space-y-2">
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
          <Select
            value={origem}
            onValueChange={(v) => {
              setOrigem(v);
              if (v !== ORIGEM_TRAFEGO_LEAD) setFunil('');
            }}
          >
            <SelectTrigger className="text-xs h-9">
              <SelectValue placeholder="Origem (opcional)" />
            </SelectTrigger>
            <SelectContent>
              {ORIGENS_LEAD.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {detalharLead && origem === ORIGEM_TRAFEGO_LEAD && (
            funis.length > 0 ? (
              <Select value={funil} onValueChange={setFunil}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="De qual funil veio?" />
                </SelectTrigger>
                <SelectContent>
                  {funis.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                type="text"
                placeholder="De qual funil veio?"
                value={funil}
                onChange={(e) => setFunil(e.target.value)}
                className="text-xs"
              />
            )
          )}

          {qualificarLead && (
            <Select value={qualificacao} onValueChange={setQualificacao}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Qualificado? (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {QUALIFICACOES.map((q) => (
                  <SelectItem key={q} value={q}>{q}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {detalharLead && (
            <Textarea
              placeholder="Como está a situação dele? (opcional)"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              className="text-xs min-h-[60px]"
            />
          )}
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
        <div className="max-h-40 overflow-y-auto space-y-1">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start justify-between gap-2 text-xs bg-muted/50 rounded px-2 py-1"
            >
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-muted-foreground">{formatDate(entry.data_lancamento)}</span>
                {(entry.lead_nome || entry.origem || entry.funil) && (
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
                    {entry.funil && (
                      <span
                        className="text-[10px] bg-[hsl(var(--gold))]/15 text-[hsl(var(--gold))] rounded px-1.5 py-0.5 inline-flex items-center gap-1"
                        title="Funil de tráfego pago"
                      >
                        <Filter className="h-2.5 w-2.5" />
                        {entry.funil}
                      </span>
                    )}
                  </div>
                )}
                {qualificarLead && (
                  <QualificacaoLead
                    entry={entry}
                    canEdit={canEdit && !!onUpdateQualificacao}
                    onSave={(valor) => onUpdateQualificacao!(entry.id, valor)}
                  />
                )}
                {detalharLead && (
                  <ComentarioLead
                    entry={entry}
                    canEdit={canEdit && !!onUpdateComentario}
                    onSave={(texto) => onUpdateComentario!(entry.id, texto)}
                  />
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
    </div>
  );
};

export const ReunioesEditor = ({
  selectedMonth,
  tipo,
  label,
  entries,
  meta,
  realizadoFallback = 0,
  onAdd,
  onDelete,
  onUpdateComentario,
  onUpdateQualificacao,
  canEdit,
}: ReunioesEditorProps) => {
  const [sdrNames, setSdrNames] = useState<SdrNames>(loadSdrNames);
  // Detalhe de lead (funil + situação) é pedido só na 2ª reunião.
  const detalharLead = tipo === 'segunda';
  // Qualificação é o resultado da 1ª reunião.
  const qualificarLead = tipo === 'primeira';
  const [funis, setFunis] = useState<string[]>([]);

  useEffect(() => {
    if (!detalharLead) return;
    fetchFunis().then(setFunis);
  }, [detalharLead]);

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
  const monthEntries = useMemo(
    () => entries.filter((e) => e.month === monthName && e.tipo === tipo),
    [entries, monthName, tipo],
  );

  const slots = sdrNames.map((name) => {
    const slotEntries = monthEntries.filter((e) => e.pessoa === name);
    const total = slotEntries.reduce((s, e) => s + Number(e.quantidade || 0), 0);
    return { name, entries: slotEntries, total };
  });

  const totalGeralLancamentos = slots.reduce((s, x) => s + x.total, 0);
  const totalGeral = totalGeralLancamentos > 0 ? totalGeralLancamentos : Number(realizadoFallback || 0);
  const sdrCount = Math.max(1, sdrNames.length);
  const metaPorPessoa = Math.ceil(meta / sdrCount);
  const progressoGeral = safePercentage(totalGeral, meta);

  const diasUteis = businessDaysInMonth(DASHBOARD_YEAR, selectedMonth);
  const diasUteisRestantes = businessDaysRemainingInMonth(DASHBOARD_YEAR, selectedMonth);
  const metaPorDia = Math.ceil(metaPorPessoa / Math.max(diasUteis, 1));
  const todayStr = todayISO();
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
    <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))] text-primary-foreground shadow-[0_4px_14px_-4px_hsl(var(--gold)/0.5)]">
            <Users className="h-4 w-4" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Etapa funil</span>
            <span className="text-base font-bold text-foreground">{label} · {monthName}</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-[hsl(var(--gold)/0.08)] to-transparent p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Meta Total</span>
            <span className="text-2xl font-bold tabular-nums text-foreground">{Math.ceil(meta)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Realizado Total</span>
            <span className="text-2xl font-bold tabular-nums text-primary">{totalGeral}</span>
          </div>
          <Progress value={clampPercentage(progressoGeral)} className="h-2" />
          <div className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground text-right">
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
                diasUteisRestantes={diasUteisRestantes}
                realizadoHoje={realizadoHoje}
                total={slot.total}
                entries={slot.entries}
                canEdit={canEdit}
                onAdd={(pessoa, qtd, dataLancamento, leadNome, origem, funil, comentario, qualificacao) =>
                  onAdd(selectedMonth, tipo, qtd, dataLancamento, pessoa, leadNome, origem, funil, comentario, qualificacao)
                }
                onDelete={onDelete}
                onUpdateComentario={onUpdateComentario}
                onUpdateQualificacao={onUpdateQualificacao}
                detalharLead={detalharLead}
                qualificarLead={qualificarLead}
                funis={funis}
                onRename={(newName) => handleRename(i, newName)}
                iconColor={iconColors[i]}
              />
            );
          })}
        </div>

        <div className="text-xs text-muted-foreground bg-muted/20 rounded p-2 space-y-1">
          <div><strong>Meta por SDR:</strong> {Math.ceil(meta)} ÷ {sdrCount} = <strong>{metaPorPessoa}</strong></div>
          <div><strong>Cálculo Diário:</strong> {metaPorPessoa} ÷ {diasUteis} dias úteis = <strong>{metaPorDia}/dia</strong></div>
          <div><strong>Ritmo Restante:</strong> {diasUteisRestantes} dias úteis até o fim de {monthName}.</div>
        </div>
      </CardContent>
    </Card>
  );
};
