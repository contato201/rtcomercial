import { useEffect, useState } from 'react';
import { MetaMensal, saveMetaMes } from '@/lib/planejamento';
import { MONTHS } from '@/types/dashboard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';

interface Props {
  metas: MetaMensal[];
  ticket: number;
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const MetasTable = ({ metas, ticket }: Props) => {
  const [rows, setRows] = useState<MetaMensal[]>(metas);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  useEffect(() => {
    setRows(metas);
  }, [metas]);

  const update = (i: number, field: keyof MetaMensal, value: number) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };

  const save = async (i: number) => {
    const r = rows[i];
    setSavingIndex(i);
    try {
      await saveMetaMes(r.monthIndex, r.metaVendas, r.metaPrimeiraReuniao, r.metaSegundaReuniao);
      toast.success(`Metas de ${MONTHS[r.monthIndex]} salvas.`);
    } catch (e: any) {
      toast.error('Erro ao salvar meta', { description: e?.message ?? 'Tente novamente.' });
    } finally {
      setSavingIndex(null);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border/60">
            <th className="py-2 pr-4">Mês</th>
            <th className="py-2 pr-4">Meta Vendas</th>
            <th className="py-2 pr-4">Meta 1ª Reuniões</th>
            <th className="py-2 pr-4">Meta 2ª Reuniões</th>
            <th className="py-2 pr-4">Faturamento (auto)</th>
            <th className="py-2 pr-2 text-right">Ação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const fat = r.metaVendas * (ticket || 2700);
            const original = metas[i];
            const dirty =
              original.metaVendas !== r.metaVendas ||
              original.metaPrimeiraReuniao !== r.metaPrimeiraReuniao ||
              original.metaSegundaReuniao !== r.metaSegundaReuniao;
            return (
              <tr key={r.monthIndex} className="border-b border-border/40">
                <td className="py-2 pr-4 font-medium text-foreground">{MONTHS[r.monthIndex]}</td>
                <td className="py-2 pr-4">
                  <Input
                    type="number"
                    min={0}
                    className="w-24"
                    value={r.metaVendas}
                    onChange={(e) => update(i, 'metaVendas', Number(e.target.value) || 0)}
                  />
                </td>
                <td className="py-2 pr-4">
                  <Input
                    type="number"
                    min={0}
                    className="w-24"
                    value={r.metaPrimeiraReuniao}
                    onChange={(e) => update(i, 'metaPrimeiraReuniao', Number(e.target.value) || 0)}
                  />
                </td>
                <td className="py-2 pr-4">
                  <Input
                    type="number"
                    min={0}
                    className="w-24"
                    value={r.metaSegundaReuniao}
                    onChange={(e) => update(i, 'metaSegundaReuniao', Number(e.target.value) || 0)}
                  />
                </td>
                <td className="py-2 pr-4 tabular-nums text-muted-foreground">{brl(fat)}</td>
                <td className="py-2 pr-2 text-right">
                  <Button
                    size="sm"
                    variant={dirty ? 'default' : 'ghost'}
                    disabled={!dirty || savingIndex === i}
                    onClick={() => save(i)}
                  >
                    {savingIndex === i ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted-foreground">
        Faturamento é calculado automaticamente: Meta Vendas × Ticket médio ({brl(ticket || 2700)}).
      </p>
    </div>
  );
};
