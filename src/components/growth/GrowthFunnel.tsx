import { GrowthData } from '@/types/growth';
import { DollarSign, TrendingUp, Percent, Target, Receipt, Users, Calendar, Handshake, ShoppingCart } from 'lucide-react';

interface GrowthFunnelProps {
  data: GrowthData;
}

export const GrowthFunnel = ({ data }: GrowthFunnelProps) => {
  // Funnel stages with colors matching the reference
  const stages = [
    { 
      label: 'LEADS', 
      value: data.leadsTotal,
      color: '#E91E63', // Pink/coral
      width: 100,
    },
    { 
      label: 'MQLs', 
      value: data.leadsQualificados,
      color: '#FFC107', // Yellow
      width: 85,
      rate: data.taxaMQL,
    },
    { 
      label: 'PROPOSTA', 
      value: Math.round(data.leadsQualificados * 0.87), // Simulated - adjust based on real data
      color: '#FF9800', // Orange
      width: 70,
      rate: 86.61,
    },
    { 
      label: 'REUNIÕES', 
      value: data.reunioesAgendadas,
      color: '#F44336', // Red/coral
      width: 55,
      rate: data.taxaReuniao || 83.64,
    },
    { 
      label: 'VENDAS', 
      value: data.vendasFechadas,
      color: '#26A69A', // Teal
      width: 40,
      rate: data.taxaFechamento || 69.57,
    },
  ];

  // Calculate costs per stage
  const custoMQL = data.leadsQualificados > 0 ? data.investimento / data.leadsQualificados : 0;
  const custoProposta = custoMQL; // Same as MQL for now
  const custoReuniao = data.reunioesAgendadas > 0 ? data.investimento / data.reunioesAgendadas : 0;
  const cpa = data.cac;
  
  // Calculate ROAS
  const roas = data.investimento > 0 ? data.valorVendas / data.investimento : 0;
  
  // Calculate ticket médio
  const ticketMedio = data.vendasFechadas > 0 ? data.valorVendas / data.vendasFechadas : 0;
  
  // Calculate taxa de fechamento
  const taxaFechamento = data.reunioesAgendadas > 0 ? (data.vendasFechadas / data.reunioesAgendadas) * 100 : 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Left side KPIs
  const leftKPIs = [
    { icon: DollarSign, label: 'Investimento', value: formatCurrency(data.investimento), color: '#4CAF50' },
    { icon: TrendingUp, label: 'Valor de Vendas', value: formatCurrency(data.valorVendas), color: '#4CAF50' },
    { icon: Target, label: 'ROAS Real', value: roas.toFixed(2), color: '#2196F3' },
    { icon: Percent, label: 'Tx. Fechamento', value: `${taxaFechamento.toFixed(2)}%`, color: '#9C27B0' },
    { icon: Receipt, label: 'Ticket Médio', value: formatCurrency(ticketMedio), color: '#4CAF50' },
  ];

  // Right side KPIs
  const rightKPIs = [
    { icon: Users, label: 'CPL', value: data.cpl > 0 ? formatCurrency(data.cpl) : 'No data', color: '#FFC107' },
    { icon: Users, label: 'Custo MQL', value: custoMQL > 0 ? formatCurrency(custoMQL) : 'No data', color: '#FF9800' },
    { icon: Calendar, label: 'Custo Proposta', value: custoProposta > 0 ? formatCurrency(custoProposta) : 'No data', color: '#FF9800' },
    { icon: Handshake, label: 'Custo Reunião', value: custoReuniao > 0 ? formatCurrency(custoReuniao) : 'No data', color: '#F44336' },
    { icon: ShoppingCart, label: 'CPA', value: cpa > 0 ? formatCurrency(cpa) : 'No data', color: '#FF5722' },
  ];

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200">
      {/* Tabs */}
      <div className="flex justify-center gap-2 mb-6">
        <button className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg border-b-2 border-primary">
          Detalhamento Geral
        </button>
        <button className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-700">
          Detalhamento Tráfego
        </button>
        <button className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-700">
          Detalhamento por fonte
        </button>
      </div>
      
      {/* Main Content - 3 Column Layout */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
        {/* Left KPIs */}
        <div className="flex flex-col gap-2">
          {leftKPIs.map((kpi, index) => (
            <div 
              key={index}
              className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200"
            >
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${kpi.color}20` }}
              >
                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">{kpi.label}</p>
                <p className="text-sm font-bold text-slate-800">{kpi.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Center Funnel */}
        <div className="relative flex flex-col items-center" style={{ width: '280px' }}>
          {stages.map((stage, index) => {
            const topWidth = stage.width;
            const bottomWidth = stages[index + 1]?.width || stage.width * 0.7;
            const isLast = index === stages.length - 1;
            
            return (
              <div key={stage.label} className="relative w-full flex flex-col items-center">
                {/* Funnel Stage */}
                <div 
                  className="relative flex items-center justify-center transition-all duration-300 hover:scale-105"
                  style={{
                    width: `${topWidth}%`,
                    height: isLast ? '45px' : '40px',
                    marginBottom: isLast ? 0 : '-2px',
                  }}
                >
                  {/* SVG for 3D funnel shape */}
                  <svg 
                    viewBox="0 0 200 50" 
                    preserveAspectRatio="none"
                    className="absolute inset-0 w-full h-full"
                  >
                    <defs>
                      <linearGradient id={`grad-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" style={{ stopColor: stage.color, stopOpacity: 0.8 }} />
                        <stop offset="50%" style={{ stopColor: stage.color, stopOpacity: 1 }} />
                        <stop offset="100%" style={{ stopColor: stage.color, stopOpacity: 0.8 }} />
                      </linearGradient>
                    </defs>
                    {isLast ? (
                      // Last stage - rounded bottom
                      <path
                        d={`M ${(100 - topWidth) / 2} 0 
                            Q 0 25, ${(100 - bottomWidth) / 2 + 20} 50 
                            L ${100 - (100 - bottomWidth) / 2 - 20} 50 
                            Q 200 25, ${100 - (100 - topWidth) / 2} 0 Z`}
                        fill={`url(#grad-${index})`}
                      />
                    ) : (
                      // Regular stage - trapezoid with curved sides
                      <path
                        d={`M 10 0 
                            Q 0 25, ${((topWidth - bottomWidth) / topWidth) * 15} 50 
                            L ${200 - ((topWidth - bottomWidth) / topWidth) * 15} 50 
                            Q 200 25, 190 0 Z`}
                        fill={`url(#grad-${index})`}
                      />
                    )}
                  </svg>
                  
                  {/* Label and Value */}
                  <div className="relative z-10 flex flex-col items-center">
                    <span className="text-[11px] font-bold text-white drop-shadow-md tracking-wide">
                      {stage.label}
                    </span>
                    <span className="text-lg font-bold text-white drop-shadow-lg">
                      {stage.value.toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>

                {/* Conversion Rate Badge */}
                {index > 0 && stage.rate !== undefined && (
                  <div 
                    className="absolute right-[-50px] top-1/2 -translate-y-1/2 z-20"
                    style={{ right: '-55px' }}
                  >
                    <span 
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-white bg-emerald-500"
                    >
                      {stage.rate.toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right KPIs */}
        <div className="flex flex-col gap-2">
          {rightKPIs.map((kpi, index) => (
            <div 
              key={index}
              className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200"
            >
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${kpi.color}20` }}
              >
                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">{kpi.label}</p>
                <p className="text-sm font-bold text-slate-800">{kpi.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
