import { useState, useCallback, useMemo } from 'react';
import { MonthData, FilterType, QuarterType, QUARTERS, VALOR_POR_VENDA, createInitialData } from '@/types/dashboard';

const STORAGE_KEY = 'dashboard_comercial_data';

const loadFromStorage = (): MonthData[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error loading data from storage:', e);
  }
  return createInitialData();
};

const saveToStorage = (data: MonthData[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Error saving data to storage:', e);
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
      
      // Calcular faturamento automaticamente
      if (updates.metaVendas !== undefined) {
        currentMonth.metaFaturamento = updates.metaVendas * VALOR_POR_VENDA;
      }
      if (updates.realizadoVendas !== undefined) {
        currentMonth.realizadoFaturamento = updates.realizadoVendas * VALOR_POR_VENDA;
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
