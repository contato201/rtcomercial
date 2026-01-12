import { useState, useCallback, useMemo, useEffect } from 'react';
import { MonthData, FilterType, QuarterType, QUARTERS, VALOR_POR_VENDA, createInitialData, MONTHS } from '@/types/dashboard';
import { supabase } from '@/integrations/supabase/client';

export const useDashboardData = () => {
  const [data, setData] = useState<MonthData[]>(createInitialData());
  const [filterType, setFilterType] = useState<FilterType>('month');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterType>('Q1');
  const [isLoading, setIsLoading] = useState(true);

  // Carrega dados do banco
  const loadFromDatabase = useCallback(async () => {
    try {
      const { data: dbData, error } = await supabase
        .from('dados_realizados')
        .select('*');

      if (error) {
        console.error('Erro ao carregar dados:', error);
        return;
      }

      if (dbData) {
        const initialData = createInitialData();
        const updatedData = initialData.map(month => {
          const dbMonth = dbData.find(d => d.month === month.month);
          if (dbMonth) {
            return {
              ...month,
              realizadoVendas: dbMonth.realizado_vendas || 0,
              realizadoFaturamento: Number(dbMonth.realizado_faturamento) || 0,
              realizadoPrimeiraReuniao: dbMonth.realizado_primeira_reuniao || 0,
              realizadoSegundaReuniao: dbMonth.realizado_segunda_reuniao || 0
            };
          }
          return month;
        });
        setData(updatedData);
      }
    } catch (e) {
      console.error('Erro ao carregar dados:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Carrega dados iniciais e configura realtime
  useEffect(() => {
    loadFromDatabase();

    // Configurar listener de realtime
    const channel = supabase
      .channel('dados_realizados_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dados_realizados'
        },
        (payload) => {
          console.log('Realtime update:', payload);
          // Recarrega todos os dados quando há mudança
          loadFromDatabase();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadFromDatabase]);

  const updateMonthData = useCallback(async (monthIndex: number, updates: Partial<MonthData>) => {
    const monthName = MONTHS[monthIndex];
    
    // Atualiza estado local imediatamente para UX responsiva
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
      return newData;
    });

    // Prepara dados para o banco
    const dbUpdates: Record<string, number> = {};
    if (updates.realizadoVendas !== undefined) {
      dbUpdates.realizado_vendas = updates.realizadoVendas;
    }
    if (updates.realizadoFaturamento !== undefined) {
      dbUpdates.realizado_faturamento = updates.realizadoFaturamento;
    }
    if (updates.realizadoPrimeiraReuniao !== undefined) {
      dbUpdates.realizado_primeira_reuniao = updates.realizadoPrimeiraReuniao;
    }
    if (updates.realizadoSegundaReuniao !== undefined) {
      dbUpdates.realizado_segunda_reuniao = updates.realizadoSegundaReuniao;
    }

    // Recalcula faturamento se necessário
    if (updates.realizadoVendas !== undefined || updates.ticketRealizado !== undefined) {
      const currentData = data[monthIndex];
      const vendas = updates.realizadoVendas ?? currentData.realizadoVendas;
      const ticket = updates.ticketRealizado ?? currentData.ticketRealizado;
      dbUpdates.realizado_faturamento = vendas * ticket;
    }

    // Salva no banco
    const { error } = await supabase
      .from('dados_realizados')
      .update(dbUpdates)
      .eq('month', monthName);

    if (error) {
      console.error('Erro ao salvar dados:', error);
    }
  }, [data]);

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
      ticketRealizado: VALOR_POR_VENDA,
      metaPrimeiraReuniao: acc.metaPrimeiraReuniao + month.metaPrimeiraReuniao,
      realizadoPrimeiraReuniao: acc.realizadoPrimeiraReuniao + month.realizadoPrimeiraReuniao,
      metaSegundaReuniao: acc.metaSegundaReuniao + month.metaSegundaReuniao,
      realizadoSegundaReuniao: acc.realizadoSegundaReuniao + month.realizadoSegundaReuniao
    }), createInitialData()[0]);
  }, [filteredData, filterType, selectedQuarter]);

  const calculateVariation = useCallback((meta: number, realizado: number): number => {
    if (meta === 0) return realizado > 0 ? 100 : 0;
    return ((realizado - meta) / meta) * 100;
  }, []);

  const resetData = useCallback(async () => {
    const initial = createInitialData();
    setData(initial);
    
    // Reset no banco para todos os meses
    for (const month of MONTHS) {
      await supabase
        .from('dados_realizados')
        .update({
          realizado_vendas: 0,
          realizado_faturamento: 0,
          realizado_primeira_reuniao: 0,
          realizado_segunda_reuniao: 0
        })
        .eq('month', month);
    }
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
    resetData,
    isLoading
  };
};
