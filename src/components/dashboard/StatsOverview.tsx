import { MonthData } from '@/types/dashboard';
import { StatCard } from './StatCard';
import { ShoppingCart, DollarSign, Users, Calendar } from 'lucide-react';

interface StatsOverviewProps {
  data: MonthData;
  calculateVariation: (meta: number, realizado: number) => number;
}

export const StatsOverview = ({ data, calculateVariation }: StatsOverviewProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value);
  };

  const stats = [
    {
      title: 'Vendas',
      meta: data.metaVendas,
      realizado: data.realizadoVendas,
      icon: ShoppingCart
    },
    {
      title: 'Faturamento',
      meta: data.metaFaturamento,
      realizado: data.realizadoFaturamento,
      icon: DollarSign,
      formatValue: formatCurrency
    },
    {
      title: '1ª Reuniões',
      meta: data.metaPrimeiraReuniao,
      realizado: data.realizadoPrimeiraReuniao,
      icon: Users
    },
    {
      title: '2ª Reuniões',
      meta: data.metaSegundaReuniao,
      realizado: data.realizadoSegundaReuniao,
      icon: Calendar
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
      {stats.map((stat) => (
        <StatCard
          key={stat.title}
          title={stat.title}
          meta={stat.meta}
          realizado={stat.realizado}
          variation={calculateVariation(stat.meta, stat.realizado)}
          icon={stat.icon}
          formatValue={stat.formatValue}
        />
      ))}
    </div>
  );
};
