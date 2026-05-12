import { useEffect, useMemo, useState } from "react";
import { TrendingUp, Users } from "lucide-react";
import { MONTHS } from "@/types/dashboard";
import {
  fetchSdrNamesFromDb,
  loadSdrNames,
  subscribeSdrNames,
  type SdrNames,
} from "@/lib/sdrNames";
import type { AgendamentoRow, ReuniaoEntryRow } from "@/hooks/useDashboardData";
import type { UnitSale } from "@/components/dashboard/UnitSalesEditor";

interface TaxasPorSdrProps {
  selectedMonth: number;
  agendamentos: AgendamentoRow[];
  reunioesEntries: ReuniaoEntryRow[];
  unitSales: UnitSale[]; // vendas do mês selecionado
}

const pct = (num: number, den: number) =>
  den > 0 ? `${((num / den) * 100).toFixed(1)}%` : "—";

export const TaxasPorSdr = ({
  selectedMonth,
  agendamentos,
  reunioesEntries,
  unitSales,
}: TaxasPorSdrProps) => {
  const [sdrNames, setSdrNames] = useState<SdrNames>(loadSdrNames());

  useEffect(() => {
    fetchSdrNamesFromDb().then(setSdrNames).catch(() => {});
    return subscribeSdrNames(setSdrNames);
  }, []);

  const monthName = MONTHS[selectedMonth];

  const rows = useMemo(() => {
    return sdrNames.map((nome) => {
      const ag = agendamentos
        .filter((a) => a.month === monthName && a.pessoa === nome)
        .reduce((s, a) => s + a.quantidade, 0);
      const r1 = reunioesEntries
        .filter((e) => e.month === monthName && e.pessoa === nome && e.tipo === "primeira")
        .reduce((s, e) => s + e.quantidade, 0);
      const r2 = reunioesEntries
        .filter((e) => e.month === monthName && e.pessoa === nome && e.tipo === "segunda")
        .reduce((s, e) => s + e.quantidade, 0);
      const vendas = unitSales.filter((v) => v.pessoa === nome);
      const fechamentos = vendas.length;
      const faturamento = vendas.reduce((s, v) => s + Number(v.valor || 0), 0);
      const noShow = Math.max(0, ag - r1);
      return { nome, ag, r1, r2, fechamentos, faturamento, noShow };
    });
  }, [sdrNames, agendamentos, reunioesEntries, unitSales, monthName]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        ag: acc.ag + r.ag,
        r1: acc.r1 + r.r1,
        r2: acc.r2 + r.r2,
        fechamentos: acc.fechamentos + r.fechamentos,
        faturamento: acc.faturamento + r.faturamento,
        noShow: acc.noShow + r.noShow,
      }),
      { ag: 0, r1: 0, r2: 0, fechamentos: 0, faturamento: 0, noShow: 0 },
    );
  }, [rows]);

  const formatBRL = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="dashboard-card p-6 border-2 border-primary/20 bg-gradient-to-br from-card to-accent/10">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-primary/10 p-2 rounded-lg">
          <TrendingUp className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-bold text-foreground">📊 Taxas de conversão por SDR</h3>
          <p className="text-xs text-muted-foreground">
            {monthName} — calculado automaticamente a partir dos lançamentos
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase text-muted-foreground">
              <th className="text-left py-2 pr-3 font-semibold">
                <Users className="w-3 h-3 inline mr-1" /> SDR
              </th>
              <th className="text-right py-2 px-2 font-semibold" title="Total agendado no mês">Agend.</th>
              <th className="text-right py-2 px-2 font-semibold" title="1ª reuniões realizadas">1ª Reun.</th>
              <th className="text-right py-2 px-2 font-semibold" title="2ª reuniões realizadas">2ª Reun.</th>
              <th className="text-right py-2 px-2 font-semibold" title="Vendas fechadas atribuídas a este SDR">Fechou</th>
              <th className="text-right py-2 px-2 font-semibold text-amber-600 dark:text-amber-400" title="Agendados que não viraram 1ª reunião">No-show</th>
              <th className="text-right py-2 px-2 font-semibold" title="Agend. → 1ª Reunião">Ag→1ª</th>
              <th className="text-right py-2 px-2 font-semibold" title="1ª → 2ª Reunião">1ª→2ª</th>
              <th className="text-right py-2 px-2 font-semibold" title="Agend. → 2ª Reunião">Ag→2ª</th>
              <th className="text-right py-2 px-2 font-semibold" title="Agend. → Fechamento">Ag→Fech</th>
              <th className="text-right py-2 px-2 font-semibold" title="1ª Reunião → Fechamento">1ª→Fech</th>
              <th className="text-right py-2 px-2 font-semibold text-[hsl(var(--success))]" title="2ª Reunião → Fechamento (taxa principal)">2ª→Fech</th>
              <th className="text-right py-2 pl-2 font-semibold">Faturamento</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.nome} className="border-b border-border/40 hover:bg-accent/30">
                <td className="py-2 pr-3 font-semibold text-foreground">{r.nome}</td>
                <td className="text-right py-2 px-2">{r.ag}</td>
                <td className="text-right py-2 px-2">{r.r1}</td>
                <td className="text-right py-2 px-2">{r.r2}</td>
                <td className="text-right py-2 px-2 font-semibold">{r.fechamentos}</td>
                <td className="text-right py-2 px-2 text-amber-600 dark:text-amber-400">{r.noShow}</td>
                <td className="text-right py-2 px-2">{pct(r.r1, r.ag)}</td>
                <td className="text-right py-2 px-2">{pct(r.r2, r.r1)}</td>
                <td className="text-right py-2 px-2">{pct(r.r2, r.ag)}</td>
                <td className="text-right py-2 px-2">{pct(r.fechamentos, r.ag)}</td>
                <td className="text-right py-2 px-2">{pct(r.fechamentos, r.r1)}</td>
                <td className="text-right py-2 px-2 font-semibold text-[hsl(var(--success))]">{pct(r.fechamentos, r.r2)}</td>
                <td className="text-right py-2 pl-2 text-xs text-muted-foreground">{formatBRL(r.faturamento)}</td>
              </tr>
            ))}
            <tr className="bg-accent/40 font-bold">
              <td className="py-2 pr-3">Total</td>
              <td className="text-right py-2 px-2">{totals.ag}</td>
              <td className="text-right py-2 px-2">{totals.r1}</td>
              <td className="text-right py-2 px-2">{totals.r2}</td>
              <td className="text-right py-2 px-2">{totals.fechamentos}</td>
              <td className="text-right py-2 px-2 text-amber-600 dark:text-amber-400">{totals.noShow}</td>
              <td className="text-right py-2 px-2">{pct(totals.r1, totals.ag)}</td>
              <td className="text-right py-2 px-2">{pct(totals.r2, totals.r1)}</td>
              <td className="text-right py-2 px-2">{pct(totals.r2, totals.ag)}</td>
              <td className="text-right py-2 px-2">{pct(totals.fechamentos, totals.ag)}</td>
              <td className="text-right py-2 px-2">{pct(totals.fechamentos, totals.r1)}</td>
              <td className="text-right py-2 px-2 text-[hsl(var(--success))]">{pct(totals.fechamentos, totals.r2)}</td>
              <td className="text-right py-2 pl-2 text-xs">{formatBRL(totals.faturamento)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        💡 Para que a taxa de fechamento por SDR funcione, atribua o SDR responsável ao cadastrar cada venda unitária abaixo.
      </p>
    </div>
  );
};
