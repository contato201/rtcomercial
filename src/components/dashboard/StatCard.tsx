import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  meta: number;
  realizado: number;
  variation: number;
  icon: LucideIcon;
  formatValue?: (value: number) => string;
}

export const StatCard = ({
  title,
  meta,
  realizado,
  variation,
  icon: Icon,
  formatValue = (v) => v.toLocaleString('pt-BR')
}: StatCardProps) => {
  const isPositive = variation > 0;
  const isNeutral = variation === 0;

  return (
    <div className="stat-card">
      <div className="flex items-start justify-between mb-4">
        <div className="bg-accent p-3 rounded-xl">
          <Icon className="w-6 h-6 text-accent-foreground" />
        </div>
        {!isNeutral ? (
          <div className={isPositive ? 'variation-positive' : 'variation-negative'}>
            {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {Math.abs(variation).toFixed(1)}%
          </div>
        ) : (
          <div className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm font-semibold inline-flex items-center gap-1">
            <Minus className="w-4 h-4" />
            0%
          </div>
        )}
      </div>
      
      <h3 className="text-sm font-medium text-muted-foreground mb-1">{title}</h3>
      
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold text-foreground">{formatValue(realizado)}</span>
          <span className="text-sm text-muted-foreground">realizado</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-semibold text-primary">{formatValue(meta)}</span>
          <span className="text-sm text-muted-foreground">meta</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-[hsl(var(--success))] rounded-full transition-all duration-500"
            style={{ width: `${Math.min((realizado / meta) * 100, 100) || 0}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {meta > 0 ? `${((realizado / meta) * 100).toFixed(1)}% da meta` : 'Defina uma meta'}
        </p>
      </div>
    </div>
  );
};
