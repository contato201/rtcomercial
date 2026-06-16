import { useMemo, useState, useEffect } from 'react';
import { MONTHS } from '@/types/dashboard';
import { CalendarRange, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import type { AgendamentoRow } from './AgendamentosEditor';
import type { ReuniaoEntry } from './ReunioesEditor';
import type { UnitSale } from './UnitSalesEditor';
import { DASHBOARD_YEAR } from '@/lib/businessDays';
import { fetchSdrNamesFromDb, loadSdrNames, subscribeSdrNames, type SdrNames } from '@/lib/sdrNames';

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

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

// Build all weeks of the month (Mon-Sun), clamped to month boundaries
const buildMonthWeeks = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstWeekday = firstDay.getDay(); // 0=Sun..6=Sat
  const offset = firstWeekday === 0 ? 6 : firstWeekday - 1;
  // Monday of the week containing day 1
  const start0 = new Date(year, month, 1 - offset);
  const weeks: { index: number; start: Date; end: Date; label: string }[] = [];
  let cursor = new Date(start0);
  let i = 1;
  while (cursor <= lastDay) {
    const wkStart = new Date(cursor);
    const wkEnd = new Date(cursor);
    wkEnd.setDate(wkEnd.getDate() + 6);
    // Clamp display range to month
    const dispStart = wkStart < firstDay ? firstDay : wkStart;
    const dispEnd = wkEnd > lastDay ? lastDay : wkEnd;
    const f = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    weeks.push({
      index: i,
      start: wkStart,
      end: wkEnd,
      label: `Semana ${i} (${f(dispStart)}–${f(dispEnd)})`,
    });
    cursor.setDate(cursor.getDate() + 7);
    i++;
  }
  return weeks;
};

const getCurrentWeekIndex = (weeks: ReturnType<typeof buildMonthWeeks>, ref: Date) => {
  const refLocal = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()).getTime();
  for (const w of weeks) {
    if (refLocal >= w.start.getTime() && refLocal <= w.end.getTime()) return w.index;
  }
  return 1;
};

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

  const weeks = useMemo(() => buildMonthWeeks(DASHBOARD_YEAR, selectedMonth), [selectedMonth]);
  const weeksInMonth = weeks.length;

  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return now.getMonth() === selectedMonth && now.getFullYear() === DASHBOARD_YEAR;
  }, [selectedMonth]);

  const defaultWeekIndex = useMemo(() => {
    const now = new Date();
    return isCurrentMonth ? getCurrentWeekIndex(weeks, now) : 1;
  }, [weeks, isCurrentMonth]);

  const [selectedWeek, setSelectedWeek] = useState<number>(defaultWeekIndex);
  const [sdrNames, setSdrNames] = useState<SdrNames>(loadSdrNames);
  // If the month changes, reset to default week for that month
  useEffect(() => {
    setSelectedWeek(defaultWeekIndex);
  }, [defaultWeekIndex]);

  useEffect(() => {
    const apply = (names: SdrNames) => setSdrNames(names);
    fetchSdrNamesFromDb().then(apply);
    const refresh = () => apply(loadSdrNames());
    window.addEventListener('sdr-names-updated', refresh);
    const unsub = subscribeSdrNames(apply);
    return () => {
      window.removeEventListener('sdr-names-updated', refresh);
      unsub();
    };
  }, []);

  const currentWeek = weeks.find((w) => w.index === selectedWeek) ?? weeks[0];
  const weekStart = currentWeek.start;
  const weekEnd = currentWeek.end;

  const isDateInWeek = (dateStr: string, week: (typeof weeks)[number]) => {
    const d = parseLocalDate(dateStr).getTime();
    return d >= week.start.getTime() && d <= week.end.getTime();
  };

  const inSelectedWeek = (dateStr: string) => {
    return isDateInWeek(dateStr, currentWeek);
  };
  const inSelectedWeekIso = (iso: string) => {
    const d = new Date(iso);
    const local = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return local >= weekStart.getTime() && local <= weekEnd.getTime();
  };

  const agendMonth = useMemo(() => agendamentos.filter((a) => a.month === monthName), [agendamentos, monthName]);
  const reunMonth = useMemo(() => reunioesEntries.filter((r) => r.month === monthName), [reunioesEntries, monthName]);
  const vendasMonth = unitSales;

  type SdrMetricKey = 'agendamentos' | 'primeira' | 'segunda' | 'vendas' | 'faturamento';
  const sdrMetricOptions: { key: SdrMetricKey; label: string; isCurrency?: boolean }[] = [
    { key: 'agendamentos', label: 'Agendamentos' },
    { key: 'primeira', label: '1ª Reuniões' },
    { key: 'segunda', label: '2ª Reuniões' },
    { key: 'vendas', label: 'Vendas' },
    { key: 'faturamento', label: 'Faturamento', isCurrency: true },
  ];

  const pessoasUniverso = useMemo(() => {
    const nomes = [
      ...agendMonth.map((a) => String(a.pessoa || '').trim()),
      ...reunMonth.map((r) => String(r.pessoa || '').trim()),
      ...vendasMonth.map((v) => String((v as any).pessoa || '').trim()),
    ].filter(Boolean);
    return Array.from(new Set([...sdrNames, ...nomes]));
  }, [agendMonth, reunMonth, vendasMonth, sdrNames]);

  const isoInWeek = (iso: string, week: (typeof weeks)[number]) => {
    const d = new Date(iso);
    const local = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return local >= week.start.getTime() && local <= week.end.getTime();
  };

  const buildSdrRows = (metric: SdrMetricKey) => pessoasUniverso.map((pessoa) => {
    const weekTotals = weeks.map((week) => {
      if (metric === 'agendamentos') {
        return agendMonth
          .filter((a) => String(a.pessoa || '').trim() === pessoa && isDateInWeek(a.data_lancamento, week))
          .reduce((s, a) => s + Number(a.quantidade || 0), 0);
      }
      if (metric === 'primeira' || metric === 'segunda') {
        return reunMonth
          .filter((r) => String(r.pessoa || '').trim() === pessoa && r.tipo === metric && isDateInWeek(r.data_lancamento, week))
          .reduce((s, r) => s + Number(r.quantidade || 0), 0);
      }
      if (metric === 'vendas') {
        return vendasMonth.filter((v) => String((v as any).pessoa || '').trim() === pessoa && isoInWeek(v.created_at, week)).length;
      }
      return vendasMonth
        .filter((v) => String((v as any).pessoa || '').trim() === pessoa && isoInWeek(v.created_at, week))
        .reduce((s, v) => s + Number(v.valor || 0), 0);
    });
    return { pessoa, weekTotals, total: weekTotals.reduce((s, v) => s + v, 0) };
  });

  // Realizado da SEMANA SELECIONADA
  const realAgendSemana = agendMonth.filter((a) => inSelectedWeek(a.data_lancamento)).reduce((s, a) => s + a.quantidade, 0);
  const real1Semana = reunMonth.filter((r) => r.tipo === 'primeira' && inSelectedWeek(r.data_lancamento)).reduce((s, r) => s + r.quantidade, 0);
  const real2Semana = reunMonth.filter((r) => r.tipo === 'segunda' && inSelectedWeek(r.data_lancamento)).reduce((s, r) => s + r.quantidade, 0);
  const vendasSemanaList = vendasMonth.filter((v) => inSelectedWeekIso(v.created_at));
  const realVendasSemana = vendasSemanaList.length;
  const realFatSemana = vendasSemanaList.reduce((s, v) => s + Number(v.valor || 0), 0);

  // Acumulado do MÊS
  const realAgendMes = agendMonth.reduce((s, a) => s + a.quantidade, 0);
  const real1Mes = reunMonth.filter((r) => r.tipo === 'primeira').reduce((s, r) => s + r.quantidade, 0);
  const real2Mes = reunMonth.filter((r) => r.tipo === 'segunda').reduce((s, r) => s + r.quantidade, 0);
  const realVendasMes = vendasMonth.length;
  const realFatMes = vendasMonth.reduce((s, v) => s + Number(v.valor || 0), 0);

  const metaSemanal = (meta: number) => meta / weeksInMonth;
  // Esperado até o FINAL da semana selecionada
  const esperadoAteSemana = (meta: number) => (meta / weeksInMonth) * selectedWeek;

  type Row = { label: string; metaSemana: number; realSemana: number; isCurrency?: boolean };
  const rows: Row[] = [
    { label: 'Agendamentos', metaSemana: metaSemanal(metaAgendamentos), realSemana: realAgendSemana },
    { label: '1ª Reuniões', metaSemana: metaSemanal(metaPrimeiraReuniao), realSemana: real1Semana },
    { label: '2ª Reuniões', metaSemana: metaSemanal(metaSegundaReuniao), realSemana: real2Semana },
    { label: 'Vendas', metaSemana: metaSemanal(metaVendas), realSemana: realVendasSemana },
    { label: 'Faturamento', metaSemana: metaSemanal(metaFaturamento), realSemana: realFatSemana, isCurrency: true },
  ];

  const allMetrics = [
    { key: 'agendamentos', label: 'Agendamentos', meta: metaAgendamentos, realizadoMes: realAgendMes, realizadoSemana: realAgendSemana, isCurrency: false },
    { key: 'primeira', label: '1ª Reuniões', meta: metaPrimeiraReuniao, realizadoMes: real1Mes, realizadoSemana: real1Semana, isCurrency: false },
    { key: 'segunda', label: '2ª Reuniões', meta: metaSegundaReuniao, realizadoMes: real2Mes, realizadoSemana: real2Semana, isCurrency: false },
    { key: 'vendas', label: 'Vendas', meta: metaVendas, realizadoMes: realVendasMes, realizadoSemana: realVendasSemana, isCurrency: false },
    { key: 'faturamento', label: 'Faturamento', meta: metaFaturamento, realizadoMes: realFatMes, realizadoSemana: realFatSemana, isCurrency: true },
  ] as const;

  const [activeMetric, setActiveMetric] = useState<string>('all');
  const [chartMode, setChartMode] = useState<'semana' | 'acumulado'>('semana');

  const visibleMetrics = activeMetric === 'all'
    ? allMetrics.filter((m) => !m.isCurrency)
    : allMetrics.filter((m) => m.key === activeMetric);

  const chartData = visibleMetrics.map((m) => {
    if (chartMode === 'semana') {
      return {
        name: m.label,
        meta: metaSemanal(m.meta),
        realizado: m.realizadoSemana,
        esperado: metaSemanal(m.meta), // mesma referência: meta da semana
        isCurrency: m.isCurrency,
      };
    }
    return {
      name: m.label,
      meta: m.meta,
      realizado: m.realizadoMes,
      esperado: esperadoAteSemana(m.meta),
      isCurrency: m.isCurrency,
    };
  });

  const fmtAxis = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`);
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
              {monthName} · Semana {selectedWeek} de {weeksInMonth} · {formatRange(weekStart, weekEnd)}
              {!isCurrentMonth && ' · (mês não corrente)'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground font-medium">Semana:</label>
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(Number(e.target.value))}
            className="input-field text-sm py-1 px-2 max-w-[260px]"
          >
            {weeks.map((w) => (
              <option key={w.index} value={w.index}>{w.label}</option>
            ))}
          </select>
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
        💡 Meta semana = Meta do mês ÷ {weeksInMonth} semanas. Realizado = lançamentos com data dentro da semana selecionada (segunda a domingo).
      </p>

      <div className="mt-5 rounded-xl border border-border/60 bg-muted/20 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-foreground">Agendamentos por SDR na semana</h4>
            <p className="text-xs text-muted-foreground">{monthName} · {formatRange(weekStart, weekEnd)}</p>
          </div>
          <span className="rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold text-foreground">
            Total semana: {realAgendSemana}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">SDR</th>
                {weeks.map((week) => (
                  <th key={week.index} className={`px-2 py-2 text-center font-medium ${week.index === selectedWeek ? 'text-primary' : ''}`}>
                    Sem {week.index}
                  </th>
                ))}
                <th className="py-2 pl-3 text-right font-medium">Mês</th>
              </tr>
            </thead>
            <tbody>
              {agendamentosPorSdrSemana.map((row) => (
                <tr key={row.pessoa} className="border-b border-border/50 last:border-0">
                  <td className="py-2.5 pr-3 font-semibold text-foreground">{row.pessoa}</td>
                  {row.weekTotals.map((value, index) => (
                    <td key={`${row.pessoa}-${index}`} className={`px-2 py-2.5 text-center font-bold ${index + 1 === selectedWeek ? 'rounded-md bg-primary/10 text-primary' : 'text-foreground'}`}>
                      {value}
                    </td>
                  ))}
                  <td className="py-2.5 pl-3 text-right font-bold text-foreground">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gráfico */}
      <div className="mt-6 pt-5 border-t border-border">
        <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-1.5 rounded-md">
              <BarChart3 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground text-sm">📊 Pacing visual</h4>
              <p className="text-xs text-muted-foreground">
                {chartMode === 'semana'
                  ? `Comparando Meta da semana × Realizado da semana ${selectedWeek}`
                  : `Acumulado do mês até a semana ${selectedWeek} (esperado = ${selectedWeek}/${weeksInMonth} da meta)`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              <button
                onClick={() => setChartMode('semana')}
                className={`px-2.5 py-1 text-xs font-medium ${chartMode === 'semana' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}
              >
                Por semana
              </button>
              <button
                onClick={() => setChartMode('acumulado')}
                className={`px-2.5 py-1 text-xs font-medium border-l border-border ${chartMode === 'acumulado' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}
              >
                Acumulado mês
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {[
                { key: 'all', label: 'Unidades' },
                ...allMetrics.map((m) => ({ key: m.key, label: m.label })),
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setActiveMetric(opt.key)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
                    activeMetric === opt.key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 16, right: 12, left: -8, bottom: 5 }} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtAxis} />
              <Tooltip
                cursor={{ fill: 'hsl(var(--accent))', opacity: 0.3 }}
                content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload;
                  const f = (v: number) => (row?.isCurrency ? formatBRL(v) : Math.round(v).toLocaleString('pt-BR'));
                  const meta = row?.meta ?? 0;
                  const realizado = row?.realizado ?? 0;
                  const esperado = row?.esperado ?? 0;
                  const gap = realizado - esperado;
                  return (
                    <div className="bg-card border border-border rounded-xl p-3 shadow-xl text-sm">
                      <p className="font-semibold text-foreground mb-2 border-b border-border pb-1.5">{label}</p>
                      <div className="space-y-1">
                        <div className="flex justify-between gap-6">
                          <span className="text-primary">{chartMode === 'semana' ? 'Meta semana' : 'Meta total'}:</span>
                          <span className="font-bold">{f(meta)}</span>
                        </div>
                        <div className="flex justify-between gap-6">
                          <span className="text-[hsl(var(--success))]">Realizado:</span>
                          <span className="font-bold">{f(realizado)}</span>
                        </div>
                        {chartMode === 'acumulado' && (
                          <div className="flex justify-between gap-6">
                            <span className="text-warning">Esperado até semana {selectedWeek}:</span>
                            <span className="font-bold">{f(esperado)}</span>
                          </div>
                        )}
                        <div className={`flex justify-between gap-6 pt-1.5 border-t border-border ${gap >= 0 ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
                          <span className="font-medium">vs. {chartMode === 'semana' ? 'meta' : 'esperado'}:</span>
                          <span className="font-bold">{gap >= 0 ? '+' : ''}{f(gap)}</span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="meta" name={chartMode === 'semana' ? 'Meta semana' : 'Meta total'} fill="hsl(var(--chart-meta))" radius={[6, 6, 0, 0]} maxBarSize={50} />
              <Bar dataKey="realizado" name="Realizado" radius={[6, 6, 0, 0]} maxBarSize={50}>
                {chartData.map((entry, i) => (
                  <Cell key={`r-${i}`} fill={entry.realizado >= entry.esperado ? 'hsl(var(--chart-realizado))' : 'hsl(var(--destructive))'} />
                ))}
              </Bar>
              {chartMode === 'acumulado' && (
                <Bar dataKey="esperado" name={`Esperado (sem ${selectedWeek})`} fill="hsl(var(--warning))" radius={[6, 6, 0, 0]} maxBarSize={50} fillOpacity={0.75} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
