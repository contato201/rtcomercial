export interface CampaignData {
  campaignName: string;
  adsetName: string;
  adName: string;
  amountSpent: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  leads: number;
  status: string;
}

export interface GrowthTotals {
  investimento: number;
  impressoes: number;
  cliques: number;
  linkClicks: number;
  leads: number;
  cpc: number;
  cpl: number;
}

export interface GrowthFilters {
  campaigns: string[];
  adsets: string[];
  statuses: string[];
}

export interface SheetsResponse {
  success: boolean;
  campaigns: CampaignData[];
  totals: GrowthTotals;
  filters: GrowthFilters;
  count: number;
}

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
  cpl: number;
  cac: number;
  taxaMQL: number;
  taxaReuniao: number;
  taxaFechamento: number;
}

export interface ActiveFilters {
  campaign: string | null;
  adset: string | null;
  status: string | null;
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

const safeDiv = (a: number, b: number): number => {
  if (!b || b === 0) return 0;
  const r = a / b;
  return isFinite(r) ? r : 0;
};

export const calculateMetrics = (data: GrowthData): GrowthData => {
  return {
    ...data,
    cpl: safeDiv(data.investimento, data.leadsTotal),
    cac: safeDiv(data.investimento, data.vendasFechadas),
    taxaMQL: safeDiv(data.leadsQualificados * 100, data.leadsTotal),
    taxaReuniao: safeDiv(data.reunioesAgendadas * 100, data.leadsQualificados),
    taxaFechamento: safeDiv(data.vendasFechadas * 100, data.reunioesAgendadas),
  };
};
