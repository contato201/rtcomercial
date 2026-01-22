export interface GrowthData {
  id?: string;
  month: string;
  monthIndex: number;
  // Dados do Sheets
  investimento: number;
  impressoes: number;
  cliques: number;
  cpc: number;
  leadsTotal: number;
  // Dados manuais
  leadsQualificados: number; // MQL
  reunioesAgendadas: number;
  vendasFechadas: number;
  valorVendas: number;
  // Métricas calculadas
  cpl: number; // Custo por Lead = investimento / leadsTotal
  cac: number; // Custo de Aquisição = investimento / vendasFechadas
  taxaMQL: number; // % MQL = leadsQualificados / leadsTotal
  taxaReuniao: number; // % Reunião = reunioesAgendadas / leadsQualificados
  taxaFechamento: number; // % Fechamento = vendasFechadas / reunioesAgendadas
}

export interface FunnelStage {
  label: string;
  value: number;
  percentage?: number;
  color: string;
}

export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const createEmptyGrowthData = (monthIndex: number): GrowthData => ({
  month: MONTHS[monthIndex],
  monthIndex,
  investimento: 0,
  impressoes: 0,
  cliques: 0,
  cpc: 0,
  leadsTotal: 0,
  leadsQualificados: 0,
  reunioesAgendadas: 0,
  vendasFechadas: 0,
  valorVendas: 0,
  cpl: 0,
  cac: 0,
  taxaMQL: 0,
  taxaReuniao: 0,
  taxaFechamento: 0,
});

export const calculateMetrics = (data: GrowthData): GrowthData => {
  return {
    ...data,
    cpl: data.leadsTotal > 0 ? data.investimento / data.leadsTotal : 0,
    cac: data.vendasFechadas > 0 ? data.investimento / data.vendasFechadas : 0,
    taxaMQL: data.leadsTotal > 0 ? (data.leadsQualificados / data.leadsTotal) * 100 : 0,
    taxaReuniao: data.leadsQualificados > 0 ? (data.reunioesAgendadas / data.leadsQualificados) * 100 : 0,
    taxaFechamento: data.reunioesAgendadas > 0 ? (data.vendasFechadas / data.reunioesAgendadas) * 100 : 0,
  };
};
