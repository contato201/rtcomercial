export interface MonthData {
  month: string;
  monthIndex: number;
  metaVendas: number;
  realizadoVendas: number;
  metaFaturamento: number;
  realizadoFaturamento: number;
  ticketRealizado: number; // Valor por venda digitado pelo usuário
  metaPrimeiraReuniao: number;
  realizadoPrimeiraReuniao: number;
  metaSegundaReuniao: number;
  realizadoSegundaReuniao: number;
}

export interface ChartData {
  name: string;
  meta: number;
  realizado: number;
}

export type FilterType = 'month' | 'quarter' | 'year';

export type QuarterType = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const QUARTERS: Record<QuarterType, number[]> = {
  Q1: [0, 1, 2],
  Q2: [3, 4, 5],
  Q3: [6, 7, 8],
  Q4: [9, 10, 11]
};

export const VALOR_POR_VENDA = 2700;

// Taxa de comparecimento (60% = 40% no-show)
export const TAXA_COMPARECIMENTO = 0.6;

// METAS FIXAS - Imutáveis (fornecidas pelo usuário)
export const METAS_FIXAS = [
  { vendas: 10, primeiraReuniao: 86, segundaReuniao: 29 },   // Janeiro
  { vendas: 12, primeiraReuniao: 103, segundaReuniao: 35 },  // Fevereiro
  { vendas: 14, primeiraReuniao: 121, segundaReuniao: 41 },  // Março
  { vendas: 10, primeiraReuniao: 86, segundaReuniao: 29 },   // Abril
  { vendas: 18, primeiraReuniao: 153, segundaReuniao: 52 },  // Maio
  { vendas: 14, primeiraReuniao: 121, segundaReuniao: 41 },  // Junho
  { vendas: 24, primeiraReuniao: 203, segundaReuniao: 69 },  // Julho
  { vendas: 25, primeiraReuniao: 212, segundaReuniao: 72 },  // Agosto
  { vendas: 22, primeiraReuniao: 189, segundaReuniao: 64 },  // Setembro
  { vendas: 24, primeiraReuniao: 203, segundaReuniao: 69 },  // Outubro
  { vendas: 30, primeiraReuniao: 256, segundaReuniao: 87 },  // Novembro
  { vendas: 26, primeiraReuniao: 221, segundaReuniao: 75 },  // Dezembro
];

export const createEmptyMonthData = (monthIndex: number): MonthData => ({
  month: MONTHS[monthIndex],
  monthIndex,
  metaVendas: METAS_FIXAS[monthIndex].vendas,
  realizadoVendas: 0,
  metaFaturamento: METAS_FIXAS[monthIndex].vendas * VALOR_POR_VENDA,
  realizadoFaturamento: 0,
  ticketRealizado: VALOR_POR_VENDA, // Começa com o valor padrão
  metaPrimeiraReuniao: METAS_FIXAS[monthIndex].primeiraReuniao,
  realizadoPrimeiraReuniao: 0,
  metaSegundaReuniao: METAS_FIXAS[monthIndex].segundaReuniao,
  realizadoSegundaReuniao: 0
});

export const createInitialData = (): MonthData[] => {
  return MONTHS.map((_, index) => createEmptyMonthData(index));
};
