// Definições de siglas e tooltips para métricas do dashboard
export const METRIC_TOOLTIPS: Record<string, { title: string; description: string; formula?: string }> = {
  MQL: {
    title: 'Marketing Qualified Lead',
    description: 'Lead que passou por qualificação de marketing e está pronto para ser contatado pelo time de vendas.',
  },
  CPL: {
    title: 'Custo Por Lead',
    description: 'Quanto você gasta em média para adquirir cada lead.',
    formula: 'Investimento Total ÷ Número de Leads',
  },
  CAC: {
    title: 'Custo de Aquisição de Cliente',
    description: 'Quanto você gasta em média para adquirir cada cliente.',
    formula: 'Investimento em Marketing ÷ Novos Clientes',
  },
  CPC: {
    title: 'Custo Por Clique',
    description: 'Quanto você paga por cada clique em seus anúncios.',
    formula: 'Investimento em Anúncios ÷ Número de Cliques',
  },
  ROAS: {
    title: 'Retorno sobre Investimento em Anúncios',
    description: 'Quanto você ganha para cada real gasto em anúncios.',
    formula: 'Faturamento ÷ Investimento em Anúncios',
  },
  CPA: {
    title: 'Custo Por Aquisição',
    description: 'Quanto você gasta em média para adquirir cada conversão.',
    formula: 'Investimento ÷ Número de Conversões',
  },
  ROI: {
    title: 'Retorno sobre Investimento',
    description: 'Porcentagem de retorno sobre o investimento realizado.',
    formula: '(Faturamento - Investimento) ÷ Investimento × 100',
  },
};

// Helper para verificar se uma sigla tem tooltip
export const hasTooltip = (label: string): boolean => {
  return label.toUpperCase() in METRIC_TOOLTIPS;
};

// Helper para obter o tooltip de uma sigla
export const getTooltip = (label: string) => {
  return METRIC_TOOLTIPS[label.toUpperCase()] || null;
};
