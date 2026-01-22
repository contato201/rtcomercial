import { GrowthData } from '@/types/growth';
import { Card, CardContent } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DollarSign, Users, Target, TrendingUp, MousePointer, Percent } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { MetricValue } from '@/components/dashboard/MetricValue';

interface GrowthMetricsCardsProps {
  data: GrowthData;
  lastSyncTime?: Date | null;
  isLoading?: boolean;
  isSyncing?: boolean;
  hasData?: boolean;
}

// Cores por categoria
const CATEGORY_COLORS = {
  investment: {
    primary: '#3B82F6', // Azul
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
    border: 'border-blue-500/30',
  },
  performance: {
    primary: '#10B981', // Verde
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-500',
    border: 'border-emerald-500/30',
  },
  costs: {
    primary: '#EF4444', // Vermelho
    bg: 'bg-red-500/10',
    text: 'text-red-500',
    border: 'border-red-500/30',
  },
  results: {
    primary: '#6B7280', // Cinza
    bg: 'bg-gray-500/10',
    text: 'text-gray-500',
    border: 'border-gray-500/30',
  },
};

export const GrowthMetricsCards = ({ 
  data, 
  lastSyncTime,
  isLoading = false,
  isSyncing = false,
  hasData = true,
}: GrowthMetricsCardsProps) => {
  const roi = data.investimento > 0 
    ? ((data.valorVendas - data.investimento) / data.investimento) * 100
    : 0;

  const roas = data.investimento > 0 
    ? data.valorVendas / data.investimento
    : 0;

  // Métricas agrupadas por categoria
  const investmentMetric = {
    title: 'INVESTIMENTO',
    value: data.investimento,
    formatter: formatCurrency,
    icon: DollarSign,
    category: CATEGORY_COLORS.investment,
    showSyncTooltip: true,
  };

  const performanceMetrics = [
    {
      title: 'ROI',
      value: roi,
      formatter: (v: number) => `${v.toFixed(1)}%`,
      icon: Percent,
      category: roi >= 0 ? CATEGORY_COLORS.performance : CATEGORY_COLORS.costs,
    },
    {
      title: 'ROAS',
      value: roas,
      formatter: (v: number) => `${v.toFixed(2)}x`,
      icon: TrendingUp,
      category: roas >= 1 ? CATEGORY_COLORS.performance : CATEGORY_COLORS.costs,
    },
  ];

  const costsMetrics = [
    {
      title: 'CPL',
      subtitle: 'Custo por Lead',
      value: data.cpl,
      formatter: formatCurrency,
      icon: Target,
      category: CATEGORY_COLORS.costs,
    },
    {
      title: 'CPC',
      subtitle: 'Custo por Clique',
      value: data.cpc,
      formatter: formatCurrency,
      icon: MousePointer,
      category: CATEGORY_COLORS.costs,
    },
  ];

  const resultsMetrics = [
    {
      title: 'FATURAMENTO',
      value: data.valorVendas,
      formatter: formatCurrency,
      icon: TrendingUp,
      category: data.valorVendas > 0 ? CATEGORY_COLORS.performance : CATEGORY_COLORS.results,
    },
    {
      title: 'CAC',
      subtitle: 'Custo de Aquisição',
      value: data.cac,
      formatter: formatCurrency,
      icon: Users,
      category: CATEGORY_COLORS.costs,
    },
  ];

  const renderMetricCard = (metric: typeof performanceMetrics[0] & { subtitle?: string; showSyncTooltip?: boolean }, isLarge = false) => (
    <Card 
      key={metric.title} 
      className={`relative overflow-hidden border ${metric.category.border} ${isLarge ? 'col-span-2' : ''}`}
    >
      <CardContent className={`${isLarge ? 'p-6' : 'p-4'}`}>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className={`font-medium text-muted-foreground uppercase tracking-wide ${isLarge ? 'text-sm' : 'text-xs'}`}>
              {metric.title}
            </p>
            {metric.subtitle && (
              <p className="text-[10px] text-muted-foreground">
                {metric.subtitle}
              </p>
            )}
            <MetricValue
              value={metric.value}
              formatter={metric.formatter}
              isLoading={isLoading}
              isSyncing={isSyncing}
              hasData={hasData}
              lastSyncTime={lastSyncTime}
              showSyncTooltip={metric.showSyncTooltip}
              className={`${metric.category.text} ${isLarge ? 'text-3xl font-bold' : 'text-lg font-semibold'}`}
            />
          </div>
          <div className={`${isLarge ? 'p-3' : 'p-2'} rounded-lg ${metric.category.bg}`}>
            <metric.icon className={`${isLarge ? 'w-6 h-6' : 'w-4 h-4'} ${metric.category.text}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Card Destaque: INVESTIMENTO */}
        <div className="grid grid-cols-2 gap-4">
          {renderMetricCard(investmentMetric, true)}
        </div>

        {/* Performance: ROI & ROAS */}
        <div className="grid grid-cols-2 gap-4">
          {performanceMetrics.map((metric) => renderMetricCard(metric))}
        </div>

        {/* Custos: CPL & CPC */}
        <div className="grid grid-cols-2 gap-4">
          {costsMetrics.map((metric) => renderMetricCard(metric))}
        </div>

        {/* Resultados: FATURAMENTO & CAC */}
        <div className="grid grid-cols-2 gap-4">
          {resultsMetrics.map((metric) => renderMetricCard(metric))}
        </div>
      </div>
    </TooltipProvider>
  );
};
