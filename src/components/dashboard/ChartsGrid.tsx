import { MonthData, FilterType, MONTHS } from '@/types/dashboard';
import { ComparisonChart } from './ComparisonChart';

interface ChartsGridProps {
  filteredData: MonthData[];
  aggregatedData: MonthData;
  filterType: FilterType;
}

export const ChartsGrid = ({ filteredData, aggregatedData, filterType }: ChartsGridProps) => {
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

  const charts = [
    {
      title: 'Vendas',
      data: createChartData('metaVendas', 'realizadoVendas')
    },
    {
      title: 'Faturamento (R$)',
      data: createChartData('metaFaturamento', 'realizadoFaturamento'),
      formatValue: formatCurrency
    },
    {
      title: '1ª Reuniões',
      data: createChartData('metaPrimeiraReuniao', 'realizadoPrimeiraReuniao')
    },
    {
      title: '2ª Reuniões',
      data: createChartData('metaSegundaReuniao', 'realizadoSegundaReuniao')
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
