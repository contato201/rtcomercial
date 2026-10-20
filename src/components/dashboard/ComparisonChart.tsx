import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Target } from 'lucide-react';
import { clampPercentage, safePercentage, safeVariation, toFiniteNumber } from '@/lib/formatters';

interface ComparisonChartProps {
  title: string;
  data: { name: string; meta: number; realizado: number }[];
  formatValue?: (value: number) => string;
  /** Fração do período já decorrida (0–1), em dias úteis. null quando não se aplica. */
  paceRatio?: number | null;
  /** Ex.: "dia útil 10 de 22" — explica de onde vem o ritmo esperado. */
  paceLabel?: string;
}

/** IDs de gradiente SVG não aceitam espaço, acento ou parêntese: url(#...) quebra e a barra some. */
const toSlug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

export const ComparisonChart = ({
  title,
  data,
  formatValue = (v) => v.toLocaleString('pt-BR'),
  paceRatio = null,
  paceLabel,
}: ComparisonChartProps) => {
  const slug = toSlug(title);
  const totalMeta = data.reduce((acc, item) => acc + toFiniteNumber(item.meta), 0);
  const totalRealizado = data.reduce((acc, item) => acc + toFiniteNumber(item.realizado), 0);
  const variation = safeVariation(totalMeta, totalRealizado);
  const progressPercent = Math.min(safePercentage(totalRealizado, totalMeta), 150);

  const hasPace = typeof paceRatio === 'number' && paceRatio > 0 && paceRatio <= 1 && totalMeta > 0;
  // Arredondado: "deveria estar em 90,909 agendamentos" não é uma meta que alguém persegue.
  const esperadoHoje = hasPace ? Math.round(totalMeta * paceRatio) : null;
  const projecao = hasPace ? Math.round(totalRealizado / paceRatio) : null;
  /** Quanto do ritmo esperado foi cumprido: 100% = exatamente no plano. */
  const ritmoPercent = hasPace && esperadoHoje > 0 ? (totalRealizado / esperadoHoje) * 100 : null;

  const isPositive = hasPace ? ritmoPercent >= 100 : totalRealizado >= totalMeta;
  const esperadoPercent = hasPace ? clampPercentage((esperadoHoje / totalMeta) * 100) : 0;

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
            {hasPace && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-[hsl(var(--gold))] font-medium">Deveria estar hoje:</span>
                <span className="font-bold">{formatValue(esperadoHoje)}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <span className="text-[hsl(var(--success))] font-medium">Realizado:</span>
              <span className="font-bold">{formatValue(realizado)}</span>
            </div>
            <div className={`flex items-center justify-between gap-4 pt-2 border-t border-border ${diff >= 0 ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
              <span className="font-medium">Diferença p/ meta:</span>
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
          {hasPace ? `${ritmoPercent.toFixed(0)}% do ritmo` : `${Math.abs(variation).toFixed(1)}%`}
        </div>
      </div>

      {hasPace && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <div className="rounded-lg bg-secondary/50 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Meta do mês</p>
            <p className="text-sm font-bold text-foreground">{formatValue(totalMeta)}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Deveria estar hoje</p>
            <p className="text-sm font-bold text-[hsl(var(--gold))]">{formatValue(esperadoHoje)}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Está agora</p>
            <p className={`text-sm font-bold ${isPositive ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
              {formatValue(totalRealizado)}
            </p>
          </div>
          <div className="rounded-lg bg-secondary/50 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Projeção do mês</p>
            <p className="text-sm font-bold text-foreground">{formatValue(projecao)}</p>
          </div>
        </div>
      )}

      <div className="mb-4">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Progresso: {progressPercent.toFixed(0)}%</span>
          <span>{formatValue(totalRealizado)} / {formatValue(totalMeta)}</span>
        </div>
        <div className="relative h-2 bg-secondary rounded-full">
          <div className="h-full rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                isPositive
                  ? 'bg-gradient-to-r from-[hsl(var(--success))] to-[hsl(142,76%,50%)]'
                  : 'bg-gradient-to-r from-destructive to-[hsl(0,84%,70%)]'
              }`}
              style={{ width: `${clampPercentage(progressPercent)}%` }}
            />
          </div>
          {hasPace && (
            <div
              className="absolute -top-1 h-4 w-0.5 bg-[hsl(var(--gold))] rounded-full"
              style={{ left: `${esperadoPercent}%` }}
              title={`Deveria estar em ${formatValue(esperadoHoje)}`}
            />
          )}
        </div>
        {hasPace && paceLabel && (
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Ritmo esperado no {paceLabel} · projeção mantendo o ritmo atual
          </p>
        )}
      </div>

      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 5 }} barCategoryGap="20%">
            <defs>
              <linearGradient id={`meta-grad-${slug}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--gold-light))" stopOpacity={0.95} />
                <stop offset="100%" stopColor="hsl(var(--gold-dark))" stopOpacity={0.85} />
              </linearGradient>
              <linearGradient id={`success-grad-${slug}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={1} />
                <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.7} />
              </linearGradient>
              <linearGradient id={`danger-grad-${slug}`} x1="0" y1="0" x2="0" y2="1">
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
            {hasPace && data.length === 1 && (
              <ReferenceLine
                y={esperadoHoje}
                stroke="hsl(var(--gold))"
                strokeDasharray="5 4"
                strokeWidth={2}
                label={{
                  value: `Deveria: ${formatValue(esperadoHoje)}`,
                  position: 'insideTopLeft',
                  fill: 'hsl(var(--gold))',
                  fontSize: 10,
                  fontWeight: 700,
                }}
              />
            )}
            <Bar
              dataKey="meta"
              name="Meta"
              fill={`url(#meta-grad-${slug})`}
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
                      ? `url(#success-grad-${slug})`
                      : `url(#danger-grad-${slug})`
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-center gap-5 mt-3 pt-3 border-t border-border flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-[hsl(var(--gold))]" />
          <span className="text-xs font-medium text-muted-foreground">Meta</span>
        </div>
        {hasPace && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-[hsl(var(--gold))]" />
            <span className="text-xs font-medium text-muted-foreground">Deveria hoje</span>
          </div>
        )}
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
