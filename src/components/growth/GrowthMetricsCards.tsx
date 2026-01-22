import { GrowthData } from '@/types/growth';
import { Card, CardContent } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DollarSign, Users, Target, TrendingUp, MousePointer, Percent } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { MetricValue } from '@/components/dashboard/MetricValue';
import { MetricTooltip } from './MetricTooltip';

interface GrowthMetricsCardsProps {
  data: GrowthData;
  lastSyncTime?: Date | null;
  isLoading?: boolean;
  isSyncing?: boolean;
  hasData?: boolean;
}

// Estilo monocromático padronizado para todos os ícones
const ICON_STYLE = {
  color: '#374151', // Cinza escuro
  size: 'w-5 h-5 sm:w-6 sm:h-6',
  sizeSmall: 'w-4 h-4 sm:w-5 sm:h-5',
  strokeWidth: 2,
  bg: 'bg-gray-100 dark:bg-gray-800',
};

// Estilo visual monocromático para cards
const CARD_STYLE = {
  border: 'border-border',
  iconBg: 'bg-gray-100 dark:bg-gray-800',
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
    showSyncTooltip: true,
  };

  const performanceMetrics = [
    {
      title: 'ROI',
      value: roi,
      formatter: (v: number) => `${v.toFixed(1)}%`,
      icon: Percent,
    },
    {
      title: 'ROAS',
      value: roas,
      formatter: (v: number) => `${v.toFixed(2)}x`,
      icon: TrendingUp,
    },
  ];

  const costsMetrics = [
    {
      title: 'CPL',
      subtitle: 'Custo por Lead',
      value: data.cpl,
      formatter: formatCurrency,
      icon: Target,
    },
    {
      title: 'CPC',
      subtitle: 'Custo por Clique',
      value: data.cpc,
      formatter: formatCurrency,
      icon: MousePointer,
    },
  ];

  const resultsMetrics = [
    {
      title: 'FATURAMENTO',
      value: data.valorVendas,
      formatter: formatCurrency,
      icon: TrendingUp,
    },
    {
      title: 'CAC',
      subtitle: 'Custo de Aquisição',
      value: data.cac,
      formatter: formatCurrency,
      icon: Users,
    },
  ];

  const renderMetricCard = (metric: typeof performanceMetrics[0] & { subtitle?: string; showSyncTooltip?: boolean }, isLarge = false) => (
    <Card 
      key={metric.title} 
      className={`relative overflow-hidden border ${CARD_STYLE.border} ${isLarge ? 'col-span-2 sm:col-span-2' : ''}`}
    >
      <CardContent className={`${isLarge ? 'p-4 sm:p-6' : 'p-3 sm:p-4'}`}>
        <div className="flex items-start justify-between">
          <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
            <p className={`font-medium text-muted-foreground uppercase tracking-wide ${isLarge ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-xs'}`}>
              <MetricTooltip label={metric.title}>
                {metric.title}
              </MetricTooltip>
            </p>
            {metric.subtitle && (
              <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">
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
              className={`text-foreground ${isLarge ? 'text-xl sm:text-3xl font-bold' : 'text-base sm:text-lg font-semibold'}`}
            />
          </div>
          <div className={`${isLarge ? 'p-2 sm:p-3' : 'p-1.5 sm:p-2'} rounded-lg ${CARD_STYLE.iconBg} flex-shrink-0`}>
            <metric.icon 
              className={isLarge ? ICON_STYLE.size : ICON_STYLE.sizeSmall} 
              style={{ color: ICON_STYLE.color }}
              strokeWidth={ICON_STYLE.strokeWidth}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <TooltipProvider>
      <div className="space-y-3 sm:space-y-4">
        {/* Card Destaque: INVESTIMENTO */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {renderMetricCard(investmentMetric, true)}
        </div>

        {/* Performance: ROI & ROAS */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {performanceMetrics.map((metric) => renderMetricCard(metric))}
        </div>

        {/* Custos: CPL & CPC */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {costsMetrics.map((metric) => renderMetricCard(metric))}
        </div>

        {/* Resultados: FATURAMENTO & CAC */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {resultsMetrics.map((metric) => renderMetricCard(metric))}
        </div>
      </div>
    </TooltipProvider>
  );
};
