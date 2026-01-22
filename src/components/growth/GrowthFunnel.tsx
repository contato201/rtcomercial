import { GrowthData } from '@/types/growth';

interface GrowthFunnelProps {
  data: GrowthData;
}

export const GrowthFunnel = ({ data }: GrowthFunnelProps) => {
  const stages = [
    { 
      label: 'Impressões', 
      value: data.impressoes, 
      color: 'bg-blue-500',
      gradient: 'from-blue-500 to-blue-600'
    },
    { 
      label: 'Cliques', 
      value: data.cliques, 
      color: 'bg-cyan-500',
      gradient: 'from-cyan-500 to-cyan-600',
      rate: data.impressoes > 0 ? (data.cliques / data.impressoes * 100).toFixed(2) : 0
    },
    { 
      label: 'Leads Totais', 
      value: data.leadsTotal, 
      color: 'bg-purple-500',
      gradient: 'from-purple-500 to-purple-600',
      rate: data.cliques > 0 ? (data.leadsTotal / data.cliques * 100).toFixed(2) : 0
    },
    { 
      label: 'MQL (Qualificados)', 
      value: data.leadsQualificados, 
      color: 'bg-amber-500',
      gradient: 'from-amber-500 to-amber-600',
      rate: data.taxaMQL.toFixed(1)
    },
    { 
      label: 'Reuniões', 
      value: data.reunioesAgendadas, 
      color: 'bg-orange-500',
      gradient: 'from-orange-500 to-orange-600',
      rate: data.taxaReuniao.toFixed(1)
    },
    { 
      label: 'Vendas', 
      value: data.vendasFechadas, 
      color: 'bg-emerald-500',
      gradient: 'from-emerald-500 to-emerald-600',
      rate: data.taxaFechamento.toFixed(1)
    },
  ];

  const maxValue = Math.max(...stages.map(s => s.value), 1);

  return (
    <div className="bg-card rounded-xl p-6 border border-border">
      <h3 className="text-lg font-semibold text-foreground mb-6">Funil de Conversão</h3>
      
      <div className="space-y-3">
        {stages.map((stage, index) => {
          const widthPercent = Math.max((stage.value / maxValue) * 100, 10);
          
          return (
            <div key={stage.label} className="relative">
              {/* Linha de conexão */}
              {index > 0 && (
                <div className="absolute -top-3 left-1/2 w-0.5 h-3 bg-border" />
              )}
              
              <div className="flex items-center gap-4">
                {/* Barra do funil */}
                <div 
                  className={`h-12 rounded-lg bg-gradient-to-r ${stage.gradient} flex items-center justify-between px-4 transition-all duration-500 shadow-lg`}
                  style={{ width: `${widthPercent}%`, minWidth: '120px' }}
                >
                  <span className="text-white font-medium text-sm truncate">
                    {stage.label}
                  </span>
                  <span className="text-white font-bold">
                    {stage.value.toLocaleString('pt-BR')}
                  </span>
                </div>
                
                {/* Taxa de conversão */}
                {stage.rate !== undefined && index > 0 && (
                  <div className="flex items-center gap-1 text-sm">
                    <span className="text-muted-foreground">↓</span>
                    <span className={`font-semibold ${Number(stage.rate) >= 10 ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {stage.rate}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
