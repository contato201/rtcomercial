import { useEffect, useState } from 'react';
import { saveTicketMedio, saveTaxaComparecimento } from '@/lib/planejamento';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Props {
  ticket: number;
  taxa: number;
}

export const ParametrosGlobais = ({ ticket, taxa }: Props) => {
  const [ticketVal, setTicketVal] = useState(ticket);
  const [taxaVal, setTaxaVal] = useState(Math.round((taxa || 0.6) * 100));
  const [saving, setSaving] = useState<'ticket' | 'taxa' | null>(null);

  useEffect(() => setTicketVal(ticket), [ticket]);
  useEffect(() => setTaxaVal(Math.round((taxa || 0.6) * 100)), [taxa]);

  const handleSaveTicket = async () => {
    setSaving('ticket');
    try {
      await saveTicketMedio(ticketVal);
      toast.success('Ticket médio atualizado.');
    } catch (e: any) {
      toast.error('Erro ao salvar', { description: e?.message ?? 'Tente novamente.' });
    } finally {
      setSaving(null);
    }
  };

  const handleSaveTaxa = async () => {
    setSaving('taxa');
    try {
      await saveTaxaComparecimento(taxaVal / 100);
      toast.success('Taxa de comparecimento atualizada.');
    } catch (e: any) {
      toast.error('Erro ao salvar', { description: e?.message ?? 'Tente novamente.' });
    } finally {
      setSaving(null);
    }
  };

  return (
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
          <Button onClick={handleSaveTicket} disabled={saving === 'ticket' || ticketVal === ticket}>
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
            onClick={handleSaveTaxa}
            disabled={saving === 'taxa' || taxaVal === Math.round((taxa || 0.6) * 100)}
          >
            {saving === 'taxa' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Usada no cálculo de Agendamentos (Meta 1ª Reuniões ÷ taxa).
        </p>
      </div>
    </div>
  );
};
