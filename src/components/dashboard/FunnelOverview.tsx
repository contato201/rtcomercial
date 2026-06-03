import { MonthData, TAXA_COMPARECIMENTO } from '@/types/dashboard';
import { clampPercentage, safePercentage } from '@/lib/formatters';

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
}

const Stage = ({ label, realizado, meta, highlight, formatter = formatNumber }: StageProps) => {
  const pct = safePercentage(realizado, meta);
  const width = clampPercentage(pct);

  if (highlight) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-[hsl(var(--gold))] p-5 shadow-[0_8px_32px_-12px_hsl(var(--gold)/0.6)] transition-all hover:shadow-[0_12px_40px_-12px_hsl(var(--gold)/0.8)]">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/70">{label}</span>
        <div className="mt-3 flex flex-col">
          <span className="text-2xl font-bold leading-tight text-black">{formatter(realizado)}</span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-black/60">
            Meta: {formatter(meta)}
          </span>
        </div>
        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-black/10">
          <div className="h-full rounded-full bg-black transition-all duration-700" style={{ width: `${width}%` }} />
        </div>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-tighter text-black">{pct.toFixed(1)}% da meta</p>
      </div>
    );
  }

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-sm transition-all hover:border-[hsl(var(--gold)/0.4)] hover:bg-white/[0.04]">
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[hsl(var(--gold))]">{label}</span>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold leading-none text-white">{formatter(realizado)}</span>
        <span className="text-xs font-semibold italic text-white/40">/ {formatter(meta)}</span>
      </div>
      <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-[hsl(var(--gold))] shadow-[0_0_10px_hsl(var(--gold)/0.6)] transition-all duration-700"
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="mt-2 text-[10px] font-bold uppercase tracking-tighter text-white/40">{pct.toFixed(1)}% da meta</p>
    </div>
  );
};

export const FunnelOverview = ({ data, realizadoAgendamentos }: FunnelOverviewProps) => {
  const metaAgendamentos = Math.ceil(data.metaPrimeiraReuniao / TAXA_COMPARECIMENTO);

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      <Stage label="Agendamentos" realizado={realizadoAgendamentos} meta={metaAgendamentos} />
      <Stage label="1ª Reuniões" realizado={data.realizadoPrimeiraReuniao} meta={data.metaPrimeiraReuniao} />
      <Stage label="2ª Reuniões" realizado={data.realizadoSegundaReuniao} meta={data.metaSegundaReuniao} />
      <Stage label="Vendas" realizado={data.realizadoVendas} meta={data.metaVendas} />
      <Stage
        label="Faturamento"
        realizado={data.realizadoFaturamento}
        meta={data.metaFaturamento}
        highlight
        formatter={formatBRL}
      />
    </div>
  );
};
