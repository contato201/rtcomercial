import { GrowthData } from '@/types/growth';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DollarSign, TrendingUp, Percent, Target, Receipt, Users, Calendar, Handshake, ShoppingCart, ArrowDown } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { MetricValue } from '@/components/dashboard/MetricValue';
import { DashboardTab, TabState } from './DashboardTab';
import { MetricTooltip } from './MetricTooltip';

interface TabConfig {
  label: string;
  state: TabState;
  expectedDate?: string;
}

interface GrowthFunnelProps {
  data: GrowthData;
  lastSyncTime?: Date | null;
  isLoading?: boolean;
  isSyncing?: boolean;
  hasData?: boolean;
}

export const GrowthFunnel = ({ 
  data, 
  lastSyncTime,
  isLoading = false,
  isSyncing = false,
  hasData = true,
}: GrowthFunnelProps) => {
  // Calcular métricas derivadas
  const mqls = data.leadsQualificados || 0;
  const propostas = Math.round(mqls * 0.6);
  const reunioes = data.reunioesAgendadas || 0;
  const vendas = data.vendasFechadas || 0;
  
  const custoMQL = mqls > 0 ? data.investimento / mqls : 0;
  const custoProposta = propostas > 0 ? data.investimento / propostas : 0;
  const custoReuniao = reunioes > 0 ? data.investimento / reunioes : 0;
  const cpa = vendas > 0 ? data.investimento / vendas : 0;
  
  const roas = data.investimento > 0 ? data.valorVendas / data.investimento : 0;
  const taxaFechamento = reunioes > 0 ? (vendas / reunioes) * 100 : 0;
  const ticketMedio = vendas > 0 ? data.valorVendas / vendas : 0;

  // Paleta de cores coerente: Verde → Vermelho (representa volume do funil)
  // Verde = maior volume (topo) | Vermelho = menor volume (fundo)
  const FUNNEL_COLORS = {
    leads: '#10B981',      // Verde - Emerald 500
    mqls: '#FBBF24',       // Amarelo - Amber 400
    proposta: '#F59E0B',   // Amarelo-Laranja - Amber 500
    reunioes: '#F97316',   // Laranja - Orange 500
    vendas: '#EF4444',     // Vermelho - Red 500
  };

  // Etapas do funil com cores coerentes
  const stages = [
    { label: 'LEADS', value: data.leadsTotal, color: FUNNEL_COLORS.leads, hasTooltip: false },
    { label: 'MQLs', value: mqls, color: FUNNEL_COLORS.mqls, hasTooltip: true, tooltipKey: 'MQL' },
    { label: 'PROPOSTA', value: propostas, color: FUNNEL_COLORS.proposta, hasTooltip: false },
    { label: 'REUNIÕES', value: reunioes, color: FUNNEL_COLORS.reunioes, hasTooltip: false },
    { label: 'VENDAS', value: vendas, color: FUNNEL_COLORS.vendas, hasTooltip: false },
  ];

  // Calcular taxas de conversão
  const getRate = (idx: number) => {
    if (idx === 0) return 0;
    const prev = stages[idx - 1].value;
    const curr = stages[idx].value;
    return prev > 0 ? (curr / prev) * 100 : 0;
  };

  // KPIs da esquerda
  const leftKPIs = [
    { icon: DollarSign, label: 'Investimento', value: data.investimento, formatter: formatCurrency, color: '#4CAF50', showSyncTooltip: true, tooltipKey: '' },
    { icon: TrendingUp, label: 'Valor de Vendas', value: data.valorVendas, formatter: formatCurrency, color: '#4CAF50', tooltipKey: '' },
    { icon: Target, label: 'ROAS Real', value: roas, formatter: (v: number) => `${v.toFixed(2)}x`, color: '#2196F3', tooltipKey: 'ROAS' },
    { icon: Percent, label: 'Tx. Fechamento', value: taxaFechamento, formatter: (v: number) => `${v.toFixed(1)}%`, color: '#9C27B0', tooltipKey: '' },
    { icon: Receipt, label: 'Ticket Médio', value: ticketMedio, formatter: formatCurrency, color: '#4CAF50', tooltipKey: '' },
  ];

  // KPIs da direita (custos) - cores correspondentes ao funil
  const rightKPIs = [
    { icon: Users, label: 'CPL', value: data.cpl, formatter: formatCurrency, borderColor: FUNNEL_COLORS.leads, tooltipKey: 'CPL' },
    { icon: Users, label: 'Custo MQL', value: custoMQL, formatter: formatCurrency, borderColor: FUNNEL_COLORS.mqls, tooltipKey: 'MQL' },
    { icon: Calendar, label: 'Custo Proposta', value: custoProposta, formatter: formatCurrency, borderColor: FUNNEL_COLORS.proposta, tooltipKey: '' },
    { icon: Handshake, label: 'Custo Reunião', value: custoReuniao, formatter: formatCurrency, borderColor: FUNNEL_COLORS.reunioes, tooltipKey: '' },
    { icon: ShoppingCart, label: 'CPA', value: cpa, formatter: formatCurrency, borderColor: FUNNEL_COLORS.vendas, tooltipKey: 'CPA' },
  ];

  // Larguras das barras do funil (decrescente)
  const widths = ['100%', '82%', '64%', '48%', '32%'];

  return (
    <TooltipProvider>
      <div className="bg-card rounded-xl border border-border p-6">
        {/* Tabs com estados visuais distintos */}
        <div className="flex justify-center gap-2 mb-8">
          <DashboardTab
            label="Detalhamento Geral"
            state="active"
            isSelected={true}
          />
          <DashboardTab
            label="Detalhamento Tráfego"
            state="disabled"
            expectedDate="Q2 2025"
          />
          <DashboardTab
            label="Detalhamento por fonte"
            state="no-data"
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px_1fr] gap-6 items-start">
          
          {/* Left KPIs */}
          <div className="space-y-3">
            {leftKPIs.map((kpi, idx) => (
              <div 
                key={idx}
                className="flex items-center gap-3 bg-muted/40 rounded-lg px-4 py-3 border border-border/50"
              >
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${kpi.color}15` }}
                >
                  <kpi.icon className="w-5 h-5" style={{ color: kpi.color }} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {kpi.tooltipKey ? (
                      <MetricTooltip label={kpi.tooltipKey}>
                        {kpi.label}
                      </MetricTooltip>
                    ) : (
                      kpi.label
                    )}
                  </p>
                  <MetricValue
                    value={kpi.value}
                    formatter={kpi.formatter}
                    isLoading={isLoading}
                    isSyncing={isSyncing}
                    hasData={hasData}
                    lastSyncTime={lastSyncTime}
                    showSyncTooltip={kpi.showSyncTooltip}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Center Funnel - Clean horizontal bars */}
          <div className="flex flex-col items-center">
            {stages.map((stage, idx) => (
              <div key={stage.label} className="w-full flex flex-col items-center">
                {/* Conversion rate arrow between stages */}
                {idx > 0 && (
                  <div className="flex items-center gap-1.5 py-2">
                    <ArrowDown className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {getRate(idx).toFixed(1)}%
                    </span>
                  </div>
                )}
                
                {/* Funnel bar */}
                <div 
                  className="flex items-center justify-center py-4 rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-default"
                  style={{ 
                    width: widths[idx],
                    backgroundColor: stage.color,
                    minHeight: '64px'
                  }}
                >
                <div className="text-center">
                    <p className="text-white font-bold text-xl leading-none drop-shadow-sm">
                      {formatNumber(stage.value)}
                    </p>
                    <p className="text-white/90 text-xs font-semibold mt-1 tracking-wide">
                      {stage.hasTooltip && stage.tooltipKey ? (
                        <MetricTooltip label={stage.tooltipKey} showIcon={false} className="text-white/90">
                          {stage.label}
                        </MetricTooltip>
                      ) : (
                        stage.label
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Legenda do funil */}
            <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-border/50">
              <div className="flex items-center gap-1.5">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: FUNNEL_COLORS.leads }}
                />
                <span className="text-xs text-muted-foreground">Maior volume</span>
              </div>
              <div className="text-muted-foreground/40">→</div>
              <div className="flex items-center gap-1.5">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: FUNNEL_COLORS.vendas }}
                />
                <span className="text-xs text-muted-foreground">Conversão final</span>
              </div>
            </div>
          </div>

          {/* Right KPIs - Costs per stage */}
          <div className="space-y-3">
            {rightKPIs.map((kpi, idx) => (
              <div 
                key={idx}
                className="flex items-center gap-3 bg-muted/40 rounded-lg px-4 py-3 border-l-4"
                style={{ borderLeftColor: kpi.borderColor }}
              >
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${kpi.borderColor}15` }}
                >
                  <kpi.icon className="w-5 h-5" style={{ color: kpi.borderColor }} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {kpi.tooltipKey ? (
                      <MetricTooltip label={kpi.tooltipKey}>
                        {kpi.label}
                      </MetricTooltip>
                    ) : (
                      kpi.label
                    )}
                  </p>
                  <MetricValue
                    value={kpi.value}
                    formatter={kpi.formatter}
                    isLoading={isLoading}
                    isSyncing={isSyncing}
                    hasData={hasData}
                    lastSyncTime={lastSyncTime}
                  />
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </TooltipProvider>
  );
};
