import { useMemo, useState } from 'react';
import { MONTHS } from '@/types/dashboard';
import { CalendarRange, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import type { AgendamentoRow } from './AgendamentosEditor';
import type { ReuniaoEntry } from './ReunioesEditor';
import type { UnitSale } from './UnitSalesEditor';

interface MetasSemanaisProps {
  selectedMonth: number;
  metaAgendamentos: number;
  metaPrimeiraReuniao: number;
  metaSegundaReuniao: number;
  metaVendas: number;
  metaFaturamento: number;
  agendamentos: AgendamentoRow[];
  reunioesEntries: ReuniaoEntry[];
  unitSales: UnitSale[];
}

// Parse YYYY-MM-DD as local date (avoids UTC shift)
const parseLocalDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// Week starts on Monday
const getWeekStart = (d: Date) => {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
};

const sameOrAfter = (a: Date, b: Date) => a.getTime() >= b.getTime();
const sameOrBefore = (a: Date, b: Date) => a.getTime() <= b.getTime();

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export const MetasSemanais = ({
  selectedMonth,
  metaAgendamentos,
  metaPrimeiraReuniao,
  metaSegundaReuniao,
  metaVendas,
  metaFaturamento,
  agendamentos,
  reunioesEntries,
  unitSales,
}: MetasSemanaisProps) => {
  const monthName = MONTHS[selectedMonth];

  const { weeksInMonth, currentWeekIndex, weekStart, weekEnd, isCurrentMonth } = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const firstDay = new Date(year, selectedMonth, 1);
    const lastDay = new Date(year, selectedMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    // Monday-based offset: how many days from monday-of-week-of-day1 until day1
    const firstWeekday = firstDay.getDay(); // 0=Sun..6=Sat
    const offset = firstWeekday === 0 ? 6 : firstWeekday - 1;
    const weeks = Math.ceil((daysInMonth + offset) / 7);

    const isCurrent = now.getMonth() === selectedMonth && now.getFullYear() === year;
    const reference = isCurrent ? now : firstDay;
    const wkStart = getWeekStart(reference);
    const wkEnd = new Date(wkStart);
    wkEnd.setDate(wkEnd.getDate() + 6);

    // Current week index within the month (1-based)
    const dayForIndex = isCurrent ? Math.min(now.getDate(), daysInMonth) : 1;
    const wkIndex = Math.min(weeks, Math.ceil((dayForIndex + offset) / 7));

    return {
      weeksInMonth: weeks,
      currentWeekIndex: wkIndex,
      weekStart: wkStart,
      weekEnd: wkEnd,
      isCurrentMonth: isCurrent,
    };
  }, [selectedMonth]);

  const inCurrentWeek = (dateStr: string) => {
    const d = parseLocalDate(dateStr);
    return sameOrAfter(d, weekStart) && sameOrBefore(d, weekEnd);
  };

  const inCurrentWeekIso = (iso: string) => {
    const d = new Date(iso);
    const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return sameOrAfter(local, weekStart) && sameOrBefore(local, weekEnd);
  };

  const agendMonth = agendamentos.filter((a) => a.month === monthName);
  const reunMonth = reunioesEntries.filter((r) => r.month === monthName);
  const vendasMonth = unitSales; // already filtered by month upstream

  const realAgendSemana = agendMonth.filter((a) => inCurrentWeek(a.data_lancamento)).reduce((s, a) => s + a.quantidade, 0);
  const real1Semana = reunMonth.filter((r) => r.tipo === 'primeira' && inCurrentWeek(r.data_lancamento)).reduce((s, r) => s + r.quantidade, 0);
  const real2Semana = reunMonth.filter((r) => r.tipo === 'segunda' && inCurrentWeek(r.data_lancamento)).reduce((s, r) => s + r.quantidade, 0);
  const vendasSemanaList = vendasMonth.filter((v) => inCurrentWeekIso(v.created_at));
  const realVendasSemana = vendasSemanaList.length;
  const realFatSemana = vendasSemanaList.reduce((s, v) => s + Number(v.valor || 0), 0);

  const metaSemanal = (meta: number) => meta / weeksInMonth;

  type Row = {
    label: string;
    metaSemana: number;
    realSemana: number;
    isCurrency?: boolean;
  };

  const rows: Row[] = [
    { label: 'Agendamentos', metaSemana: metaSemanal(metaAgendamentos), realSemana: realAgendSemana },
    { label: '1ª Reuniões', metaSemana: metaSemanal(metaPrimeiraReuniao), realSemana: real1Semana },
    { label: '2ª Reuniões', metaSemana: metaSemanal(metaSegundaReuniao), realSemana: real2Semana },
    { label: 'Vendas', metaSemana: metaSemanal(metaVendas), realSemana: realVendasSemana },
    { label: 'Faturamento', metaSemana: metaSemanal(metaFaturamento), realSemana: realFatSemana, isCurrency: true },
  ];

  const fmt = (v: number, currency?: boolean) =>
    currency ? formatBRL(v) : (Number.isInteger(v) ? v.toString() : v.toFixed(1));

  const formatRange = (a: Date, b: Date) => {
    const f = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `${f(a)} a ${f(b)}`;
  };

  return (
    <div className="dashboard-card p-5 border-2 border-primary/20 bg-gradient-to-br from-card to-accent/10">
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <CalendarRange className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">📅 Meta Semanal vs Realizado</h3>
            <p className="text-xs text-muted-foreground">
              Semana {currentWeekIndex} de {weeksInMonth} · {formatRange(weekStart, weekEnd)}
              {!isCurrentMonth && ' · (referência: 1ª semana do mês)'}
            </p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Meta semanal = Meta do mês ÷ {weeksInMonth} semanas
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="py-2 pr-4 font-medium">Métrica</th>
              <th className="py-2 px-3 font-medium text-right">Meta semana</th>
              <th className="py-2 px-3 font-medium text-right">Realizado semana</th>
              <th className="py-2 px-3 font-medium text-right">Diferença</th>
              <th className="py-2 pl-3 font-medium text-right">% atingido</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const diff = row.realSemana - row.metaSemana;
              const pct = row.metaSemana > 0 ? (row.realSemana / row.metaSemana) * 100 : 0;
              const ok = pct >= 100;
              const warn = pct >= 70 && pct < 100;
              return (
                <tr key={row.label} className="border-b border-border/50 last:border-0">
                  <td className="py-2.5 pr-4 font-medium text-foreground">{row.label}</td>
                  <td className="py-2.5 px-3 text-right text-foreground">{fmt(row.metaSemana, row.isCurrency)}</td>
                  <td className="py-2.5 px-3 text-right font-semibold text-foreground">{fmt(row.realSemana, row.isCurrency)}</td>
                  <td className={`py-2.5 px-3 text-right font-medium ${diff >= 0 ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
                    <span className="inline-flex items-center gap-1 justify-end">
                      {diff >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {diff >= 0 ? '+' : ''}{fmt(diff, row.isCurrency)}
                    </span>
                  </td>
                  <td className="py-2.5 pl-3 text-right">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                      ok ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' :
                      warn ? 'bg-warning/15 text-warning' :
                      'bg-destructive/15 text-destructive'
                    }`}>
                      {pct.toFixed(0)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        💡 Os valores realizados consideram apenas lançamentos com data dentro da semana atual (segunda a domingo).
      </p>
    </div>
  );
};
