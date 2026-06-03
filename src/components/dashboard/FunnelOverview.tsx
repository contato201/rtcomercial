import { MonthData, TAXA_COMPARECIMENTO } from '@/types/dashboard';
import { clampPercentage, safePercentage } from '@/lib/formatters';
import { Calendar, Users, UserCheck, ShoppingCart, DollarSign, LucideIcon } from 'lucide-react';
import { useCountUp } from '@/hooks/useCountUp';


interface FunnelOverviewProps {
  data: MonthData;
  realizadoAgendamentos: number;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatNumber = (value: number) => value.toLocaleString('pt-BR');

interface StageProps {
  label: string;
  realizado: number;
  meta: number;
  highlight?: boolean;
  formatter?: (v: number) => string;
  icon: LucideIcon;
  index: number;
}

const Stage = ({ label, realizado, meta, highlight, formatter = formatNumber, icon: Icon, index }: StageProps) => {
  const pct = safePercentage(realizado, meta);
  const width = clampPercentage(pct);
  const delay = `${index * 80}ms`;
  const animatedRealizado = useCountUp(realizado);
  const displayRealizado = formatter === formatNumber ? Math.round(animatedRealizado) : animatedRealizado;


  if (highlight) {
    return (
      <div
        style={{ animationDelay: delay }}
        className="animate-fade-in group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))] p-5 shadow-[0_10px_40px_-12px_hsl(var(--gold)/0.6)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_50px_-12px_hsl(var(--gold)/0.8)]"
      >
        {/* shimmer */}
        <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
        <div className="flex items-start justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/70">{label}</span>
          <div className="rounded-lg bg-black/10 p-1.5 backdrop-blur-sm">
            <Icon className="h-3.5 w-3.5 text-black" strokeWidth={2.5} />
          </div>
        </div>
        <div className="mt-4 flex flex-col">
          <span className="text-2xl font-bold leading-tight tabular-nums text-black">{formatter(displayRealizado)}</span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-black/60">
            Meta: {formatter(meta)}
          </span>
        </div>
        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-black/15">
          <div className="h-full rounded-full bg-black transition-all duration-1000 ease-out" style={{ width: `${width}%` }} />
        </div>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-tighter text-black">{pct.toFixed(1)}% da meta</p>
      </div>
    );
  }

  return (
    <div
      style={{ animationDelay: delay }}
      className="animate-fade-in group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
    >
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{label}</span>
        <div className="rounded-lg bg-accent p-1.5 text-primary opacity-70 transition-opacity group-hover:opacity-100">
          <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
        </div>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-bold leading-none tabular-nums text-foreground">{formatter(realizado)}</span>
        <span className="text-xs font-semibold italic text-muted-foreground">/ {formatter(meta)}</span>
      </div>
      <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--gold-dark))] to-[hsl(var(--gold))] shadow-[0_0_10px_hsl(var(--gold)/0.5)] transition-all duration-1000 ease-out"
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="mt-2 text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">{pct.toFixed(1)}% da meta</p>
    </div>
  );
};

export const FunnelOverview = ({ data, realizadoAgendamentos }: FunnelOverviewProps) => {
  const metaAgendamentos = Math.ceil(data.metaPrimeiraReuniao / TAXA_COMPARECIMENTO);

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      <Stage index={0} icon={Calendar} label="Agendamentos" realizado={realizadoAgendamentos} meta={metaAgendamentos} />
      <Stage index={1} icon={Users} label="1ª Reuniões" realizado={data.realizadoPrimeiraReuniao} meta={data.metaPrimeiraReuniao} />
      <Stage index={2} icon={UserCheck} label="2ª Reuniões" realizado={data.realizadoSegundaReuniao} meta={data.metaSegundaReuniao} />
      <Stage index={3} icon={ShoppingCart} label="Vendas" realizado={data.realizadoVendas} meta={data.metaVendas} />
      <Stage
        index={4}
        icon={DollarSign}
        label="Faturamento"
        realizado={data.realizadoFaturamento}
        meta={data.metaFaturamento}
        highlight
        formatter={formatBRL}
      />
    </div>
  );
};
