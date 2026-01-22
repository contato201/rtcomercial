import { GrowthData } from '@/types/growth';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DollarSign, TrendingUp, Percent, Target, Receipt, Users, Calendar, Handshake, ShoppingCart, ArrowDown } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { MetricValue } from '@/components/dashboard/MetricValue';
import { DashboardTab, TabState } from './DashboardTab';

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

  // Etapas do funil
  const stages = [
    { label: 'LEADS', value: data.leadsTotal, color: '#E91E63' },
    { label: 'MQLs', value: mqls, color: '#FFC107' },
    { label: 'PROPOSTA', value: propostas, color: '#FF9800' },
    { label: 'REUNIÕES', value: reunioes, color: '#F44336' },
    { label: 'VENDAS', value: vendas, color: '#26A69A' },
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
    { icon: DollarSign, label: 'Investimento', value: data.investimento, formatter: formatCurrency, color: '#4CAF50', showSyncTooltip: true },
    { icon: TrendingUp, label: 'Valor de Vendas', value: data.valorVendas, formatter: formatCurrency, color: '#4CAF50' },
    { icon: Target, label: 'ROAS Real', value: roas, formatter: (v: number) => `${v.toFixed(2)}x`, color: '#2196F3' },
    { icon: Percent, label: 'Tx. Fechamento', value: taxaFechamento, formatter: (v: number) => `${v.toFixed(1)}%`, color: '#9C27B0' },
    { icon: Receipt, label: 'Ticket Médio', value: ticketMedio, formatter: formatCurrency, color: '#4CAF50' },
  ];

  // KPIs da direita (custos)
  const rightKPIs = [
    { icon: Users, label: 'CPL', value: data.cpl, formatter: formatCurrency, borderColor: '#E91E63' },
    { icon: Users, label: 'Custo MQL', value: custoMQL, formatter: formatCurrency, borderColor: '#FFC107' },
    { icon: Calendar, label: 'Custo Proposta', value: custoProposta, formatter: formatCurrency, borderColor: '#FF9800' },
    { icon: Handshake, label: 'Custo Reunião', value: custoReuniao, formatter: formatCurrency, borderColor: '#F44336' },
    { icon: ShoppingCart, label: 'CPA', value: cpa, formatter: formatCurrency, borderColor: '#26A69A' },
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
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
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
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
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
                      {stage.label}
                    </p>
                  </div>
                </div>
              </div>
            ))}
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
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
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
