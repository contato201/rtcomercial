import { useState, useCallback, useMemo } from 'react';
import { MonthData, FilterType, QuarterType, QUARTERS, VALOR_POR_VENDA, createInitialData, METAS_FIXAS } from '@/types/dashboard';

const STORAGE_KEY = 'dashboard_realizados_v2';

// Carrega APENAS os realizados do storage, sempre usando metas fixas
const loadFromStorage = (): MonthData[] => {
  const initialData = createInitialData(); // Sempre usa metas fixas
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const savedData = JSON.parse(stored);
      // Mesclar apenas os valores REALIZADOS com as metas fixas
      return initialData.map((month, index) => ({
        ...month, // Metas fixas sempre preservadas
        realizadoVendas: savedData[index]?.realizadoVendas || 0,
        realizadoFaturamento: savedData[index]?.realizadoFaturamento || 0,
        ticketRealizado: savedData[index]?.ticketRealizado || VALOR_POR_VENDA,
        realizadoPrimeiraReuniao: savedData[index]?.realizadoPrimeiraReuniao || 0,
        realizadoSegundaReuniao: savedData[index]?.realizadoSegundaReuniao || 0,
        realizadoFechamentos: savedData[index]?.realizadoFechamentos || 0
      }));
    }
  } catch (e) {
    console.error('Erro ao carregar dados:', e);
  }
  
  return initialData;
};

// Salva apenas os realizados
const saveToStorage = (data: MonthData[]) => {
  try {
    const realizados = data.map(month => ({
      realizadoVendas: month.realizadoVendas,
      realizadoFaturamento: month.realizadoFaturamento,
      ticketRealizado: month.ticketRealizado,
      realizadoPrimeiraReuniao: month.realizadoPrimeiraReuniao,
      realizadoSegundaReuniao: month.realizadoSegundaReuniao,
      realizadoFechamentos: month.realizadoFechamentos
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(realizados));
  } catch (e) {
    console.error('Erro ao salvar dados:', e);
  }
};

export const useDashboardData = () => {
  const [data, setData] = useState<MonthData[]>(loadFromStorage);
  const [filterType, setFilterType] = useState<FilterType>('month');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterType>('Q1');

  const updateMonthData = useCallback((monthIndex: number, updates: Partial<MonthData>) => {
    setData(prevData => {
      const newData = [...prevData];
      const currentMonth = { ...newData[monthIndex], ...updates };
      
      // Recalcula faturamento quando vendas ou ticket mudam
      if (updates.realizadoVendas !== undefined || updates.ticketRealizado !== undefined) {
        const vendas = updates.realizadoVendas ?? currentMonth.realizadoVendas;
        const ticket = updates.ticketRealizado ?? currentMonth.ticketRealizado;
        currentMonth.realizadoFaturamento = vendas * ticket;
      }
      
      newData[monthIndex] = currentMonth;
      saveToStorage(newData);
      return newData;
    });
  }, []);

  const filteredData = useMemo(() => {
    switch (filterType) {
      case 'month':
        return [data[selectedMonth]];
      case 'quarter':
        return QUARTERS[selectedQuarter].map(i => data[i]);
      case 'year':
        return data;
      default:
        return data;
    }
  }, [data, filterType, selectedMonth, selectedQuarter]);

  const aggregatedData = useMemo(() => {
    if (filteredData.length === 1) {
      return filteredData[0];
    }
    
    return filteredData.reduce((acc, month) => ({
      month: filterType === 'quarter' ? `${selectedQuarter}` : 'Anual',
      monthIndex: -1,
      metaVendas: acc.metaVendas + month.metaVendas,
      realizadoVendas: acc.realizadoVendas + month.realizadoVendas,
      metaFaturamento: acc.metaFaturamento + month.metaFaturamento,
      realizadoFaturamento: acc.realizadoFaturamento + month.realizadoFaturamento,
      ticketRealizado: VALOR_POR_VENDA, // Ticket padrão para agregados
      metaPrimeiraReuniao: acc.metaPrimeiraReuniao + month.metaPrimeiraReuniao,
      realizadoPrimeiraReuniao: acc.realizadoPrimeiraReuniao + month.realizadoPrimeiraReuniao,
      metaSegundaReuniao: acc.metaSegundaReuniao + month.metaSegundaReuniao,
      realizadoSegundaReuniao: acc.realizadoSegundaReuniao + month.realizadoSegundaReuniao,
      metaFechamentos: acc.metaFechamentos + month.metaFechamentos,
      realizadoFechamentos: acc.realizadoFechamentos + month.realizadoFechamentos
    }), createInitialData()[0]);
  }, [filteredData, filterType, selectedQuarter]);

  const calculateVariation = useCallback((meta: number, realizado: number): number => {
    if (meta === 0) return realizado > 0 ? 100 : 0;
    return ((realizado - meta) / meta) * 100;
  }, []);

  const resetData = useCallback(() => {
    const initial = createInitialData();
    setData(initial);
    saveToStorage(initial);
  }, []);

  return {
    data,
    filteredData,
    aggregatedData,
    filterType,
    setFilterType,
    selectedMonth,
    setSelectedMonth,
    selectedQuarter,
    setSelectedQuarter,
    updateMonthData,
    calculateVariation,
    resetData
  };
};
