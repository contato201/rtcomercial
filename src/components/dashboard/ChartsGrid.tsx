import { useMemo, useState, useEffect } from 'react';
import { MonthData, FilterType, QuarterType, MONTHS, TAXA_COMPARECIMENTO } from '@/types/dashboard';
import { ComparisonChart } from './ComparisonChart';
import { Skeleton } from '@/components/ui/skeleton';
import type { AgendamentoRow } from '@/hooks/useDashboardData';
import type { ReuniaoEntry } from './ReunioesEditor';
import type { UnitSale } from './UnitSalesEditor';
import { CalendarRange } from 'lucide-react';
import { DASHBOARD_YEAR } from '@/lib/businessDays';

interface ChartsGridProps {
  filteredData: MonthData[];
  aggregatedData: MonthData;
  filterType: FilterType;
  selectedQuarter: QuarterType;
  selectedMonth: number;
  agendamentos?: AgendamentoRow[];
  reunioesEntries?: ReuniaoEntry[];
  unitSales?: UnitSale[];
  isLoading?: boolean;
}

const ChartSkeleton = () => (
  <div className="rounded-xl border border-border bg-card p-4 space-y-4">
    <Skeleton className="h-5 w-32" />
    <Skeleton className="h-[200px] w-full rounded-lg" />
    <div className="flex justify-between">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-3 w-16" />
    </div>
  </div>
);

const parseLocalDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const buildMonthWeeks = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstWeekday = firstDay.getDay();
  const offset = firstWeekday === 0 ? 6 : firstWeekday - 1;
  const start0 = new Date(year, month, 1 - offset);
  const weeks: { index: number; start: Date; end: Date; label: string }[] = [];
  let cursor = new Date(start0);
  let i = 1;
  while (cursor <= lastDay) {
    const wkStart = new Date(cursor);
    const wkEnd = new Date(cursor);
    wkEnd.setDate(wkEnd.getDate() + 6);
    const dispStart = wkStart < firstDay ? firstDay : wkStart;
    const dispEnd = wkEnd > lastDay ? lastDay : wkEnd;
    const f = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    weeks.push({ index: i, start: wkStart, end: wkEnd, label: `Semana ${i} (${f(dispStart)}–${f(dispEnd)})` });
    cursor.setDate(cursor.getDate() + 7);
    i++;
  }
  return weeks;
};

export const ChartsGrid = ({
  filteredData,
  aggregatedData,
  filterType,
  selectedQuarter,
  selectedMonth,
  agendamentos = [],
  reunioesEntries = [],
  unitSales = [],
  isLoading = false,
}: ChartsGridProps) => {
  const weeks = useMemo(
    () => (filterType === 'month' ? buildMonthWeeks(DASHBOARD_YEAR, selectedMonth) : []),
    [filterType, selectedMonth]
  );

  // 0 = mês inteiro; >0 = semana específica
  const [selectedWeek, setSelectedWeek] = useState<number>(0);
  useEffect(() => { setSelectedWeek(0); }, [selectedMonth, filterType]);

  if (isLoading) {
    return (
      <div className="mt-8">
        <Skeleton className="h-7 w-56 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <ChartSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value);

  const isWeekFilter = filterType === 'month' && selectedWeek > 0 && weeks.length > 0;
  const week = isWeekFilter ? weeks.find((w) => w.index === selectedWeek) : null;
  const weeksInMonth = weeks.length || 1;

  const inWeekDate = (s: string) => {
    if (!week) return true;
    const t = parseLocalDate(s).getTime();
    return t >= week.start.getTime() && t <= week.end.getTime();
  };
  const inWeekIso = (s: string) => {
    if (!week) return true;
    const d = new Date(s);
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return t >= week.start.getTime() && t <= week.end.getTime();
  };

  const monthName = aggregatedData.month;
  const metaPerWeek = (m: number) => m / weeksInMonth;

  const createChartData = (metaKey: keyof MonthData, realizadoKey: keyof MonthData, weekRealizado?: number) => {
    if (filterType === 'month') {
      const meta = aggregatedData[metaKey] as number;
      if (isWeekFilter) {
        return [{ name: `${monthName} · Sem ${selectedWeek}`, meta: metaPerWeek(meta), realizado: weekRealizado ?? 0 }];
      }
      return [{ name: monthName, meta, realizado: aggregatedData[realizadoKey] as number }];
    }
    return filteredData.map((m) => ({
      name: m.month.slice(0, 3),
      meta: m[metaKey] as number,
      realizado: m[realizadoKey] as number,
    }));
  };

  // Real semana — derivado das fontes por data
  const realPrimeiraSemana = reunioesEntries
    .filter((r) => r.month === monthName && r.tipo === 'primeira' && inWeekDate(r.data_lancamento))
    .reduce((s, r) => s + r.quantidade, 0);
  const realSegundaSemana = reunioesEntries
    .filter((r) => r.month === monthName && r.tipo === 'segunda' && inWeekDate(r.data_lancamento))
    .reduce((s, r) => s + r.quantidade, 0);
  const vendasSemana = unitSales.filter((v) => v.month === monthName && inWeekIso(v.created_at));
  const realVendasSemana = vendasSemana.length;
  const realFatSemana = vendasSemana.reduce((s, v) => s + Number(v.valor || 0), 0);

  const createAgendamentosChartData = () => {
    if (filterType === 'month') {
      const metaPrimeiraReuniao = aggregatedData.metaPrimeiraReuniao;
      const metaAgendamentos = Math.ceil(metaPrimeiraReuniao / TAXA_COMPARECIMENTO);
      const filtered = agendamentos.filter((a) => a.month === monthName && (!isWeekFilter || inWeekDate(a.data_lancamento)));
      const realizadoAgendamentos = filtered.reduce((sum, a) => sum + a.quantidade, 0);
      return [{
        name: isWeekFilter ? `${monthName} · Sem ${selectedWeek}` : monthName,
        meta: isWeekFilter ? metaPerWeek(metaAgendamentos) : metaAgendamentos,
        realizado: realizadoAgendamentos,
      }];
    }
    return filteredData.map((m) => {
      const metaAgendamentos = Math.ceil(m.metaPrimeiraReuniao / TAXA_COMPARECIMENTO);
      const realizadoAgendamentos = agendamentos.filter((a) => a.month === m.month).reduce((s, a) => s + a.quantidade, 0);
      return { name: m.month.slice(0, 3), meta: metaAgendamentos, realizado: realizadoAgendamentos };
    });
  };

  const charts = [
    { title: 'Agendamentos', data: createAgendamentosChartData() },
    { title: '1ª Reuniões', data: createChartData('metaPrimeiraReuniao', 'realizadoPrimeiraReuniao', realPrimeiraSemana) },
    { title: '2ª Reuniões', data: createChartData('metaSegundaReuniao', 'realizadoSegundaReuniao', realSegundaSemana) },
    { title: 'Vendas', data: createChartData('metaVendas', 'realizadoVendas', realVendasSemana) },
    { title: 'Faturamento (R$)', data: createChartData('metaFaturamento', 'realizadoFaturamento', realFatSemana), formatValue: formatCurrency },
  ];

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-xl font-semibold text-foreground">Gráficos Comparativos</h2>
        {filterType === 'month' && weeks.length > 0 && (
          <div className="flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-muted-foreground" />
            <label className="text-xs text-muted-foreground font-medium">Filtrar por semana:</label>
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(Number(e.target.value))}
              className="input-field text-sm py-1 px-2 max-w-[280px]"
            >
              <option value={0}>Mês inteiro</option>
              {weeks.map((w) => (
                <option key={w.index} value={w.index}>{w.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      {isWeekFilter && (
        <p className="text-xs text-muted-foreground mb-4">
          💡 Meta exibida = meta do mês ÷ {weeksInMonth} semanas. Realizado = lançamentos com data dentro da semana selecionada.
        </p>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {charts.map((chart) => (
          <ComparisonChart
            key={chart.title}
            title={chart.title}
            data={chart.data}
            formatValue={chart.formatValue}
          />
        ))}
      </div>
    </div>
  );
};
