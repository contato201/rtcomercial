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

import { getMetaMes, getTicketMedio, getTaxaComparecimento } from '@/lib/planejamento';

// Getters dinâmicos (compat com uso legado)
export const VALOR_POR_VENDA = 2700; // valor de referência default (usado como fallback)
export const TAXA_COMPARECIMENTO = 0.6; // fallback estático

export const getValorPorVenda = () => getTicketMedio();
export const getTaxa = () => getTaxaComparecimento();

export const createEmptyMonthData = (monthIndex: number): MonthData => {
  const meta = getMetaMes(monthIndex);
  const ticket = getTicketMedio();
  return {
    month: MONTHS[monthIndex],
    monthIndex,
    metaVendas: meta.metaVendas,
    realizadoVendas: 0,
    metaFaturamento: meta.metaVendas * ticket,
    realizadoFaturamento: 0,
    ticketRealizado: ticket,
    metaPrimeiraReuniao: meta.metaPrimeiraReuniao,
    realizadoPrimeiraReuniao: 0,
    metaSegundaReuniao: meta.metaSegundaReuniao,
    realizadoSegundaReuniao: 0,
  };
};

export const createInitialData = (): MonthData[] => {
  return MONTHS.map((_, index) => createEmptyMonthData(index));
};
