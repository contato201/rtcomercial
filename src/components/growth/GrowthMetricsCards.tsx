import { GrowthData } from '@/types/growth';
import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, Users, Target, TrendingUp, MousePointer, Eye } from 'lucide-react';

interface GrowthMetricsCardsProps {
  data: GrowthData;
}

export const GrowthMetricsCards = ({ data }: GrowthMetricsCardsProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const metrics = [
    {
      title: 'Investimento',
      value: formatCurrency(data.investimento),
      icon: DollarSign,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
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

  return (
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
      ))}
    </div>
  );
};
