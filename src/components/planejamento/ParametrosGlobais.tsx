import { useEffect, useState } from 'react';
import {
  saveTicketMedio,
  saveTaxaComparecimento,
  saveTaxaVendas2a,
  saveTaxa2a1a,
  recalcularFunilMetas,
} from '@/lib/planejamento';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Calculator } from 'lucide-react';

interface Props {
  ticket: number;
  taxa: number;
  taxaVendas2a: number;
  taxa2a1a: number;
}

export const ParametrosGlobais = ({ ticket, taxa, taxaVendas2a, taxa2a1a }: Props) => {
  const [ticketVal, setTicketVal] = useState(ticket);
  const [taxaVal, setTaxaVal] = useState(Math.round((taxa || 0.6) * 100));
  const [v2Val, setV2Val] = useState(Math.round((taxaVendas2a || 0.35) * 100));
  const [t21Val, setT21Val] = useState(Math.round((taxa2a1a || 0.34) * 100));
  const [saving, setSaving] = useState<'ticket' | 'taxa' | 'v2' | 't21' | 'recalc' | null>(null);

  useEffect(() => setTicketVal(ticket), [ticket]);
  useEffect(() => setTaxaVal(Math.round((taxa || 0.6) * 100)), [taxa]);
  useEffect(() => setV2Val(Math.round((taxaVendas2a || 0.35) * 100)), [taxaVendas2a]);
  useEffect(() => setT21Val(Math.round((taxa2a1a || 0.34) * 100)), [taxa2a1a]);

  const run = async (
    key: 'ticket' | 'taxa' | 'v2' | 't21',
    fn: () => Promise<void>,
    ok: string,
  ) => {
    setSaving(key);
    try {
      await fn();
      toast.success(ok);
    } catch (e: any) {
      toast.error('Erro ao salvar', { description: e?.message ?? 'Tente novamente.' });
    } finally {
      setSaving(null);
    }
  };

  const handleRecalcular = async () => {
    if (!confirm('Recalcular as metas de 1ª e 2ª reunião de TODOS os meses a partir das vendas e das taxas? Isso substitui os valores atuais dessas colunas.')) return;
    setSaving('recalc');
    try {
      await recalcularFunilMetas();
      toast.success('Metas do funil recalculadas para os 12 meses.');
    } catch (e: any) {
      toast.error('Erro ao recalcular', { description: e?.message ?? 'Tente novamente.' });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Ticket médio (R$)
          </Label>
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              step={1}
              value={ticketVal}
              onChange={(e) => setTicketVal(Number(e.target.value) || 0)}
            />
            <Button onClick={() => run('ticket', () => saveTicketMedio(ticketVal), 'Ticket médio atualizado.')} disabled={saving === 'ticket' || ticketVal === ticket}>
              {saving === 'ticket' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Usado para calcular Meta de Faturamento (Vendas × Ticket).</p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Taxa de comparecimento (%)
          </Label>
          <div className="flex gap-2">
            <Input
              type="number"
              min={5}
              max={100}
              step={1}
              value={taxaVal}
              onChange={(e) => setTaxaVal(Number(e.target.value) || 0)}
            />
            <Button
              onClick={() => run('taxa', () => saveTaxaComparecimento(taxaVal / 100), 'Taxa de comparecimento atualizada.')}
              disabled={saving === 'taxa' || taxaVal === Math.round((taxa || 0.6) * 100)}
            >
              {saving === 'taxa' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Usada no cálculo de Agendamentos (Meta 1ª Reuniões ÷ taxa).
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Taxa Vendas → 2ª Reunião (%)
          </Label>
          <div className="flex gap-2">
            <Input
              type="number"
              min={5}
              max={100}
              step={1}
              value={v2Val}
              onChange={(e) => setV2Val(Number(e.target.value) || 0)}
            />
            <Button
              onClick={() => run('v2', () => saveTaxaVendas2a(v2Val / 100), 'Taxa Vendas→2ª atualizada.')}
              disabled={saving === 'v2' || v2Val === Math.round((taxaVendas2a || 0.35) * 100)}
            >
              {saving === 'v2' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Quantas 2ªs reuniões viram venda. Ex: 35% → 2ª = Vendas ÷ 0,35.</p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Taxa 2ª → 1ª Reunião (%)
          </Label>
          <div className="flex gap-2">
            <Input
              type="number"
              min={5}
              max={100}
              step={1}
              value={t21Val}
              onChange={(e) => setT21Val(Number(e.target.value) || 0)}
            />
            <Button
              onClick={() => run('t21', () => saveTaxa2a1a(t21Val / 100), 'Taxa 2ª→1ª atualizada.')}
              disabled={saving === 't21' || t21Val === Math.round((taxa2a1a || 0.34) * 100)}
            >
              {saving === 't21' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Quantas 1ªs reuniões viram 2ª. Ex: 34% → 1ª = 2ª ÷ 0,34.</p>
        </div>
      </div>

      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" /> Recalcular metas do funil
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Recalcula 1ª e 2ª reunião de todos os meses a partir da <strong>meta de vendas</strong> e das taxas acima. (Defina as vendas na tabela de Metas Mensais primeiro.)
          </p>
        </div>
        <Button onClick={handleRecalcular} disabled={saving === 'recalc'} className="shrink-0">
          {saving === 'recalc' ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Recalculando…</> : 'Recalcular funil'}
        </Button>
      </div>
    </div>
  );
};
