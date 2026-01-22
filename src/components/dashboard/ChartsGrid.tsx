import { MonthData, FilterType, MONTHS, TAXA_COMPARECIMENTO } from '@/types/dashboard';
import { ComparisonChart } from './ComparisonChart';
import type { AgendamentoRow } from '@/hooks/useDashboardData';

interface ChartsGridProps {
  filteredData: MonthData[];
  aggregatedData: MonthData;
  filterType: FilterType;
  agendamentos?: AgendamentoRow[];
}

export const ChartsGrid = ({ filteredData, aggregatedData, filterType, agendamentos = [] }: ChartsGridProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const createChartData = (metaKey: keyof MonthData, realizadoKey: keyof MonthData) => {
    if (filterType === 'month') {
      return [{
        name: aggregatedData.month,
        meta: aggregatedData[metaKey] as number,
        realizado: aggregatedData[realizadoKey] as number
      }];
    }
    
    return filteredData.map(month => ({
      name: month.month.slice(0, 3),
      meta: month[metaKey] as number,
      realizado: month[realizadoKey] as number
    }));
  };

  // Gráfico de agendamentos
  const createAgendamentosChartData = () => {
    if (filterType === 'month') {
      const monthName = aggregatedData.month;
      const metaPrimeiraReuniao = aggregatedData.metaPrimeiraReuniao;
      const metaAgendamentos = Math.ceil(metaPrimeiraReuniao / TAXA_COMPARECIMENTO);
      const realizadoAgendamentos = agendamentos
        .filter(a => a.month === monthName)
        .reduce((sum, a) => sum + a.quantidade, 0);
      
      return [{
        name: monthName,
        meta: metaAgendamentos,
        realizado: realizadoAgendamentos
      }];
    }
    
    return filteredData.map(month => {
      const metaAgendamentos = Math.ceil(month.metaPrimeiraReuniao / TAXA_COMPARECIMENTO);
      const realizadoAgendamentos = agendamentos
        .filter(a => a.month === month.month)
        .reduce((sum, a) => sum + a.quantidade, 0);
      
      return {
        name: month.month.slice(0, 3),
        meta: metaAgendamentos,
        realizado: realizadoAgendamentos
      };
    });
  };

  // Ordem do funil: Agendamentos → 1ª Reuniões → 2ª Reuniões → Vendas → Faturamento
  const charts = [
    {
      title: 'Agendamentos',
      data: createAgendamentosChartData()
    },
    {
      title: '1ª Reuniões',
      data: createChartData('metaPrimeiraReuniao', 'realizadoPrimeiraReuniao')
    },
    {
      title: '2ª Reuniões',
      data: createChartData('metaSegundaReuniao', 'realizadoSegundaReuniao')
    },
    {
      title: 'Vendas',
      data: createChartData('metaVendas', 'realizadoVendas')
    },
    {
      title: 'Faturamento (R$)',
      data: createChartData('metaFaturamento', 'realizadoFaturamento'),
      formatValue: formatCurrency
    }
  ];

  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold text-foreground mb-6">Gráficos Comparativos</h2>
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
