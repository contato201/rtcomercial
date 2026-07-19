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

// Semana do mês a partir de uma data (YYYY-MM-DD ou ISO): 1–7=S1, 8–14=S2, 15–21=S3, 22–28=S4, 29–31=S5
const semanaDoMes = (dateStr?: string): number => {
  if (!dateStr) return 0;
  const dia = parseInt(dateStr.slice(8, 10), 10);
  if (!Number.isFinite(dia) || dia < 1) return 0;
  return Math.min(5, Math.floor((dia - 1) / 7) + 1);
};

const SEMANAS = [
  { v: 0, label: "Todas" },
  { v: 1, label: "S1" },
  { v: 2, label: "S2" },
  { v: 3, label: "S3" },
  { v: 4, label: "S4" },
  { v: 5, label: "S5" },
];

const SEMANA_INTERVALO: Record<number, string> = {
  1: "dias 1–7",
  2: "dias 8–14",
  3: "dias 15–21",
  4: "dias 22–28",
  5: "dias 29–31",
};

export const TaxasPorSdr = ({
  selectedMonth,
  agendamentos,
  reunioesEntries,
  unitSales,
}: TaxasPorSdrProps) => {
  const [sdrNames, setSdrNames] = useState<SdrNames>(loadSdrNames());
  const [selectedWeek, setSelectedWeek] = useState(0); // 0 = todas as semanas

  useEffect(() => {
    fetchSdrNamesFromDb().then(setSdrNames).catch(() => {});
    return subscribeSdrNames(setSdrNames);
  }, []);

  const monthName = MONTHS[selectedMonth];

  // Ao trocar de mês, volta para "Todas" as semanas
  useEffect(() => {
    setSelectedWeek(0);
  }, [selectedMonth]);

  const naSemana = (dateStr?: string) =>
    selectedWeek === 0 ? true : semanaDoMes(dateStr) === selectedWeek;

  const rows = useMemo(() => {
    return sdrNames.map((nome) => {
      const ag = agendamentos
        .filter((a) => a.month === monthName && a.pessoa === nome && naSemana(a.data_lancamento))
        .reduce((s, a) => s + a.quantidade, 0);
      const r1 = reunioesEntries
        .filter((e) => e.month === monthName && e.pessoa === nome && e.tipo === "primeira" && naSemana(e.data_lancamento))
        .reduce((s, e) => s + e.quantidade, 0);
      const r2 = reunioesEntries
        .filter((e) => e.month === monthName && e.pessoa === nome && e.tipo === "segunda" && naSemana(e.data_lancamento))
        .reduce((s, e) => s + e.quantidade, 0);
      const vendas = unitSales.filter((v) => v.pessoa === nome && naSemana(v.created_at));
      const fechamentos = vendas.length;
      const faturamento = vendas.reduce((s, v) => s + Number(v.valor || 0), 0);
      const noShow = Math.max(0, ag - r1);
      return { nome, ag, r1, r2, fechamentos, faturamento, noShow };
    });
  }, [sdrNames, agendamentos, reunioesEntries, unitSales, monthName, selectedWeek]);

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

  const subtitulo =
    selectedWeek === 0
      ? `${monthName} — calculado automaticamente a partir dos lançamentos`
      : `${monthName} · Semana ${selectedWeek} (${SEMANA_INTERVALO[selectedWeek]})`;

  return (
    <div className="dashboard-card p-6 border-2 border-primary/20 bg-gradient-to-br from-card to-accent/10">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">📊 Taxas de conversão por SDR</h3>
            <p className="text-xs text-muted-foreground">{subtitulo}</p>
          </div>
        </div>

        {/* Filtro por semana */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
          {SEMANAS.map((s) => (
            <button
              key={s.v}
              type="button"
              onClick={() => setSelectedWeek(s.v)}
              className={
                "px-2.5 py-1 rounded-md text-xs font-semibold transition-colors " +
                (selectedWeek === s.v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted")
              }
              title={s.v === 0 ? "Mês inteiro" : `Semana ${s.v} — ${SEMANA_INTERVALO[s.v]}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase text-muted-foreground">
              <th className="text-left py-2 pr-3 font-semibold">
                <Users className="w-3 h-3 inline mr-1" /> SDR
              </th>
              <th className="text-right py-2 px-2 font-semibold" title="Total agendado no período">Agend.</th>
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
