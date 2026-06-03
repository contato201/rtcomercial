import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Target } from 'lucide-react';
import { clampPercentage, safePercentage, safeVariation, toFiniteNumber } from '@/lib/formatters';

interface ComparisonChartProps {
  title: string;
  data: { name: string; meta: number; realizado: number }[];
  formatValue?: (value: number) => string;
}

export const ComparisonChart = ({ title, data, formatValue = (v) => v.toLocaleString('pt-BR') }: ComparisonChartProps) => {
  const totalMeta = data.reduce((acc, item) => acc + toFiniteNumber(item.meta), 0);
  const totalRealizado = data.reduce((acc, item) => acc + toFiniteNumber(item.realizado), 0);
  const variation = safeVariation(totalMeta, totalRealizado);
  const isPositive = totalRealizado >= totalMeta;
  const progressPercent = Math.min(safePercentage(totalRealizado, totalMeta), 150);

  const renderCustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const meta = toFiniteNumber(payload.find((p: any) => p.dataKey === 'meta')?.value);
      const realizado = toFiniteNumber(payload.find((p: any) => p.dataKey === 'realizado')?.value);
      const diff = realizado - meta;
      const percentDiff = safeVariation(meta, realizado);
      
      return (
        <div className="bg-card border border-border rounded-xl p-4 shadow-xl">
          <p className="font-semibold text-foreground mb-3 text-center border-b border-border pb-2">{label}</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <span className="text-primary font-medium">Meta:</span>
              <span className="font-bold">{formatValue(meta)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[hsl(var(--success))] font-medium">Realizado:</span>
              <span className="font-bold">{formatValue(realizado)}</span>
            </div>
            <div className={`flex items-center justify-between gap-4 pt-2 border-t border-border ${diff >= 0 ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
              <span className="font-medium">Diferença:</span>
              <span className="font-bold">{diff >= 0 ? '+' : ''}{formatValue(diff)} ({percentDiff.toFixed(1)}%)</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="chart-container relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${
          isPositive 
            ? 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]' 
            : 'bg-destructive/10 text-destructive'
        }`}>
          {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {Math.abs(variation).toFixed(1)}%
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Progresso: {progressPercent.toFixed(0)}%</span>
          <span>{formatValue(totalRealizado)} / {formatValue(totalMeta)}</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-700 ${
              isPositive 
                ? 'bg-gradient-to-r from-[hsl(var(--success))] to-[hsl(142,76%,50%)]' 
                : 'bg-gradient-to-r from-destructive to-[hsl(0,84%,70%)]'
            }`}
            style={{ width: `${clampPercentage(progressPercent)}%` }}
          />
        </div>
      </div>

      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 5 }} barCategoryGap="20%">
            <defs>
              <linearGradient id={`meta-grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--gold-light))" stopOpacity={0.95} />
                <stop offset="100%" stopColor="hsl(var(--gold-dark))" stopOpacity={0.85} />
              </linearGradient>
              <linearGradient id={`success-grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={1} />
                <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.7} />
              </linearGradient>
              <linearGradient id={`danger-grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={1} />
                <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.7} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 600 }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => {
                if (value >= 1000) return `${(value/1000).toFixed(0)}k`;
                return value;
              }}
            />
            <Tooltip content={renderCustomTooltip} cursor={{ fill: 'hsl(var(--accent))', opacity: 0.3 }} />
            <Bar
              dataKey="meta"
              name="Meta"
              fill={`url(#meta-grad-${title})`}
              radius={[6, 6, 0, 0]}
              maxBarSize={45}
              animationDuration={800}
            />
            <Bar
              dataKey="realizado"
              name="Realizado"
              radius={[6, 6, 0, 0]}
              maxBarSize={45}
              animationDuration={1000}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    toFiniteNumber(entry.realizado) >= toFiniteNumber(entry.meta)
                      ? `url(#success-grad-${title})`
                      : `url(#danger-grad-${title})`
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-center gap-6 mt-3 pt-3 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-primary" />
          <span className="text-xs font-medium text-muted-foreground">Meta</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-[hsl(var(--success))]" />
          <span className="text-xs font-medium text-muted-foreground">Atingido</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-destructive" />
          <span className="text-xs font-medium text-muted-foreground">Abaixo</span>
        </div>
      </div>
    </div>
  );
};
