import { GrowthData } from '@/types/growth';
import { Card, CardContent } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DollarSign, Users, Target, TrendingUp, MousePointer } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { MetricValue } from '@/components/dashboard/MetricValue';

interface GrowthMetricsCardsProps {
  data: GrowthData;
  lastSyncTime?: Date | null;
  isLoading?: boolean;
  isSyncing?: boolean;
  hasData?: boolean;
}

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

  const metrics = [
    {
      title: 'Investimento',
      value: data.investimento,
      formatter: formatCurrency,
      icon: DollarSign,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      showSyncTooltip: true,
    },
    {
      title: 'CPL',
      subtitle: 'Custo por Lead',
      value: data.cpl,
      formatter: formatCurrency,
      icon: Target,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'CAC',
      subtitle: 'Custo de Aquisição',
      value: data.cac,
      formatter: formatCurrency,
      icon: Users,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      title: 'Faturamento',
      value: data.valorVendas,
      formatter: formatCurrency,
      icon: TrendingUp,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      title: 'ROI',
      value: roi,
      formatter: (v: number) => `${v.toFixed(1)}%`,
      icon: TrendingUp,
      color: data.valorVendas > data.investimento ? 'text-emerald-500' : 'text-red-500',
      bgColor: data.valorVendas > data.investimento ? 'bg-emerald-500/10' : 'bg-red-500/10',
    },
    {
      title: 'CPC',
      subtitle: 'Custo por Clique',
      value: data.cpc,
      formatter: formatCurrency,
      icon: MousePointer,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
  ];

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.title} className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
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
                    className={metric.color}
                  />
                </div>
                <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                  <metric.icon className={`w-4 h-4 ${metric.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </TooltipProvider>
  );
};
