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

export const createEmptyMonthData = (monthIndex: number): MonthData => ({
  month: MONTHS[monthIndex],
  monthIndex,
  metaVendas: 0,
  realizadoVendas: 0,
  metaFaturamento: 0,
  realizadoFaturamento: 0,
  metaPrimeiraReuniao: 0,
  realizadoPrimeiraReuniao: 0,
  metaSegundaReuniao: 0,
  realizadoSegundaReuniao: 0,
  metaFechamentos: 0,
  realizadoFechamentos: 0
});

export const createInitialData = (): MonthData[] => {
  return MONTHS.map((_, index) => createEmptyMonthData(index));
};
