import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Target } from 'lucide-react';

interface ComparisonChartProps {
  title: string;
  data: { name: string; meta: number; realizado: number }[];
  formatValue?: (value: number) => string;
}

export const ComparisonChart = ({ title, data, formatValue = (v) => v.toLocaleString('pt-BR') }: ComparisonChartProps) => {
  // Calcular totais e variação
  const totalMeta = data.reduce((acc, item) => acc + item.meta, 0);
  const totalRealizado = data.reduce((acc, item) => acc + item.realizado, 0);
  const variation = totalMeta > 0 ? ((totalRealizado - totalMeta) / totalMeta) * 100 : 0;
  const isPositive = totalRealizado >= totalMeta;
  const progressPercent = totalMeta > 0 ? Math.min((totalRealizado / totalMeta) * 100, 150) : 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const meta = payload.find((p: any) => p.dataKey === 'meta')?.value || 0;
      const realizado = payload.find((p: any) => p.dataKey === 'realizado')?.value || 0;
      const diff = realizado - meta;
      const percentDiff = meta > 0 ? ((realizado - meta) / meta) * 100 : 0;
      
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
      {/* Header com título e variação */}
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

      {/* Barra de progresso visual */}
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
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Gráfico */}
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 5 }} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" vertical={false} />
            <XAxis 
              dataKey="name" 
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
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
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--accent))', opacity: 0.3 }} />
            <Bar 
              dataKey="meta" 
              name="Meta" 
              fill="hsl(var(--chart-meta))" 
              radius={[6, 6, 0, 0]}
              maxBarSize={45}
            />
            <Bar 
              dataKey="realizado" 
              name="Realizado" 
              radius={[6, 6, 0, 0]}
              maxBarSize={45}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.realizado >= entry.meta ? 'hsl(var(--chart-realizado))' : 'hsl(var(--destructive))'} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legenda customizada */}
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
