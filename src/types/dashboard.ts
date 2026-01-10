export interface MonthData {
  month: string;
  monthIndex: number;
  metaVendas: number;
  realizadoVendas: number;
  metaFaturamento: number;
  realizadoFaturamento: number;
  metaPrimeiraReuniao: number;
  realizadoPrimeiraReuniao: number;
  metaSegundaReuniao: number;
  realizadoSegundaReuniao: number;
  metaFechamentos: number;
  realizadoFechamentos: number;
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

// METAS FIXAS - Imutáveis (fornecidas pelo usuário)
export const METAS_FIXAS = [
  { vendas: 10, primeiraReuniao: 86, segundaReuniao: 29, fechamentos: 0 },   // Janeiro
  { vendas: 12, primeiraReuniao: 103, segundaReuniao: 35, fechamentos: 0 },  // Fevereiro
  { vendas: 14, primeiraReuniao: 121, segundaReuniao: 41, fechamentos: 0 },  // Março
  { vendas: 10, primeiraReuniao: 86, segundaReuniao: 29, fechamentos: 0 },   // Abril
  { vendas: 18, primeiraReuniao: 153, segundaReuniao: 52, fechamentos: 0 },  // Maio
  { vendas: 14, primeiraReuniao: 121, segundaReuniao: 41, fechamentos: 0 },  // Junho
  { vendas: 24, primeiraReuniao: 203, segundaReuniao: 69, fechamentos: 0 },  // Julho
  { vendas: 25, primeiraReuniao: 212, segundaReuniao: 72, fechamentos: 0 },  // Agosto
  { vendas: 22, primeiraReuniao: 189, segundaReuniao: 64, fechamentos: 0 },  // Setembro
  { vendas: 24, primeiraReuniao: 203, segundaReuniao: 69, fechamentos: 0 },  // Outubro
  { vendas: 30, primeiraReuniao: 256, segundaReuniao: 87, fechamentos: 0 },  // Novembro
  { vendas: 26, primeiraReuniao: 221, segundaReuniao: 75, fechamentos: 0 },  // Dezembro
];

export const createEmptyMonthData = (monthIndex: number): MonthData => ({
  month: MONTHS[monthIndex],
  monthIndex,
  metaVendas: METAS_FIXAS[monthIndex].vendas,
  realizadoVendas: 0,
  metaFaturamento: METAS_FIXAS[monthIndex].vendas * VALOR_POR_VENDA,
  realizadoFaturamento: 0,
  metaPrimeiraReuniao: METAS_FIXAS[monthIndex].primeiraReuniao,
  realizadoPrimeiraReuniao: 0,
  metaSegundaReuniao: METAS_FIXAS[monthIndex].segundaReuniao,
  realizadoSegundaReuniao: 0,
  metaFechamentos: METAS_FIXAS[monthIndex].fechamentos,
  realizadoFechamentos: 0
});

export const createInitialData = (): MonthData[] => {
  return MONTHS.map((_, index) => createEmptyMonthData(index));
};
