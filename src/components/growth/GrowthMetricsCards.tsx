import { GrowthData } from '@/types/growth';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DollarSign, Users, Target, TrendingUp, MousePointer } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/formatters';

interface GrowthMetricsCardsProps {
  data: GrowthData;
  lastSyncTime?: Date | null;
}

export const GrowthMetricsCards = ({ data, lastSyncTime }: GrowthMetricsCardsProps) => {
  const metrics = [
    {
      title: 'Investimento',
      value: formatCurrency(data.investimento),
      icon: DollarSign,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      showSyncTooltip: true,
    },
    {
      title: 'CPL',
      subtitle: 'Custo por Lead',
      value: formatCurrency(data.cpl),
      icon: Target,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'CAC',
      subtitle: 'Custo de Aquisição',
      value: formatCurrency(data.cac),
      icon: Users,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      title: 'Faturamento',
      value: formatCurrency(data.valorVendas),
      icon: TrendingUp,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      title: 'ROI',
      value: data.investimento > 0 
        ? `${(((data.valorVendas - data.investimento) / data.investimento) * 100).toFixed(1)}%`
        : '0%',
      icon: TrendingUp,
      color: data.valorVendas > data.investimento ? 'text-emerald-500' : 'text-red-500',
      bgColor: data.valorVendas > data.investimento ? 'bg-emerald-500/10' : 'bg-red-500/10',
    },
    {
      title: 'CPC',
      subtitle: 'Custo por Clique',
      value: formatCurrency(data.cpc),
      icon: MousePointer,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
  ];

  const renderMetricCard = (metric: typeof metrics[0]) => {
    const cardContent = (
      <Card className="relative overflow-hidden">
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
              <p className={`text-lg font-bold ${metric.color}`}>
                {metric.value}
              </p>
            </div>
            <div className={`p-2 rounded-lg ${metric.bgColor}`}>
              <metric.icon className={`w-4 h-4 ${metric.color}`} />
            </div>
          </div>
        </CardContent>
      </Card>
    );

    if (metric.showSyncTooltip && lastSyncTime) {
      return (
        <Tooltip key={metric.title}>
          <TooltipTrigger asChild>
            <div className="cursor-help">
              {cardContent}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <p>Sincronizado em {formatDateTime(lastSyncTime)}</p>
            <p className="text-muted-foreground">(fonte: Google Sheets)</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return <div key={metric.title}>{cardContent}</div>;
  };

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metrics.map(renderMetricCard)}
      </div>
    </TooltipProvider>
  );
};
