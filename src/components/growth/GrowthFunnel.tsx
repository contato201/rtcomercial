import { GrowthData } from '@/types/growth';

interface GrowthFunnelProps {
  data: GrowthData;
}

export const GrowthFunnel = ({ data }: GrowthFunnelProps) => {
  const stages = [
    { 
      label: 'Impressões', 
      value: data.impressoes, 
      icon: '👁️',
      color: '#3B82F6',
      bgGradient: 'from-blue-500 to-blue-600'
    },
    { 
      label: 'Cliques', 
      value: data.cliques, 
      icon: '👆',
      color: '#06B6D4',
      bgGradient: 'from-cyan-500 to-cyan-600',
      rate: data.impressoes > 0 ? (data.cliques / data.impressoes * 100) : 0
    },
    { 
      label: 'Leads', 
      value: data.leadsTotal, 
      icon: '📋',
      color: '#8B5CF6',
      bgGradient: 'from-violet-500 to-violet-600',
      rate: data.cliques > 0 ? (data.leadsTotal / data.cliques * 100) : 0
    },
    { 
      label: 'MQL', 
      value: data.leadsQualificados, 
      icon: '⭐',
      color: '#F59E0B',
      bgGradient: 'from-amber-500 to-amber-600',
      rate: data.taxaMQL
    },
    { 
      label: 'Reuniões', 
      value: data.reunioesAgendadas, 
      icon: '📅',
      color: '#F97316',
      bgGradient: 'from-orange-500 to-orange-600',
      rate: data.taxaReuniao
    },
    { 
      label: 'Vendas', 
      value: data.vendasFechadas, 
      icon: '🎯',
      color: '#10B981',
      bgGradient: 'from-emerald-500 to-emerald-600',
      rate: data.taxaFechamento
    },
  ];

  const maxValue = Math.max(...stages.map(s => s.value), 1);

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700/50 shadow-2xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/60 rounded-xl flex items-center justify-center shadow-lg">
          <span className="text-xl">📊</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Funil de Conversão</h3>
          <p className="text-xs text-slate-400">Taxa de conversão entre etapas</p>
        </div>
      </div>
      
      <div className="relative">
        {stages.map((stage, index) => {
          const widthPercent = Math.max((stage.value / maxValue) * 100, 15);
          const isLast = index === stages.length - 1;
          
          return (
            <div key={stage.label} className="relative mb-2">
              {/* Connector Arrow */}
              {index > 0 && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                  <div className="flex flex-col items-center">
                    <div 
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold shadow-lg"
                      style={{ 
                        backgroundColor: stage.rate && stage.rate >= 5 ? '#10B981' : stage.rate && stage.rate >= 1 ? '#F59E0B' : '#EF4444',
                        color: 'white'
                      }}
                    >
                      {stage.rate?.toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}
              
              {/* Funnel Bar */}
              <div 
                className="relative mx-auto transition-all duration-700 ease-out"
                style={{ 
                  width: `${widthPercent}%`,
                  minWidth: '140px'
                }}
              >
                <div 
                  className={`
                    relative h-14 rounded-xl bg-gradient-to-r ${stage.bgGradient}
                    flex items-center justify-between px-4
                    shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300
                    border border-white/10
                  `}
                  style={{
                    clipPath: isLast 
                      ? 'polygon(5% 0%, 95% 0%, 100% 50%, 95% 100%, 5% 100%, 0% 50%)'
                      : 'polygon(0% 0%, 95% 0%, 100% 50%, 95% 100%, 0% 100%)'
                  }}
                >
                  {/* Icon + Label */}
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{stage.icon}</span>
                    <span className="text-white font-semibold text-sm">{stage.label}</span>
                  </div>
                  
                  {/* Value */}
                  <div className="text-white font-bold text-lg">
                    {stage.value.toLocaleString('pt-BR')}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="mt-8 pt-6 border-t border-slate-700/50">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-slate-800/50 rounded-xl">
            <p className="text-2xl font-bold text-emerald-400">
              {data.impressoes > 0 ? ((data.vendasFechadas / data.impressoes) * 100).toFixed(3) : 0}%
            </p>
            <p className="text-xs text-slate-400 mt-1">Conversão Total</p>
          </div>
          <div className="text-center p-3 bg-slate-800/50 rounded-xl">
            <p className="text-2xl font-bold text-amber-400">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.cpl)}
            </p>
            <p className="text-xs text-slate-400 mt-1">CPL</p>
          </div>
          <div className="text-center p-3 bg-slate-800/50 rounded-xl">
            <p className="text-2xl font-bold text-blue-400">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.cac)}
            </p>
            <p className="text-xs text-slate-400 mt-1">CAC</p>
          </div>
        </div>
      </div>
    </div>
  );
};
