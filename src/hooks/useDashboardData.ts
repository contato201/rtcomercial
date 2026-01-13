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
          loadFromDatabase();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadFromDatabase]);

  // Salva alteração no histórico
  const saveToHistory = useCallback(async (
    dadosRealizadosId: string,
    monthName: string,
    field: string,
    oldValue: number,
    newValue: number
  ) => {
    if (oldValue === newValue) return;

    const dbFieldMap: Record<string, string> = {
      realizadoVendas: 'realizado_vendas',
      realizadoFaturamento: 'realizado_faturamento',
      realizadoPrimeiraReuniao: 'realizado_primeira_reuniao',
      realizadoSegundaReuniao: 'realizado_segunda_reuniao',
    };

    const dbField = dbFieldMap[field];
    if (!dbField) return;

    try {
      await supabase.from('historico_alteracoes').insert({
        dados_realizados_id: dadosRealizadosId,
        month: monthName,
        campo_alterado: dbField,
        valor_anterior: oldValue,
        valor_novo: newValue,
      });
    } catch (error) {
      console.error('Erro ao salvar histórico:', error);
    }
  }, []);

  const updateMonthData = useCallback(async (monthIndex: number, updates: Partial<MonthData>) => {
    const monthName = MONTHS[monthIndex];
    const currentMonthData = data[monthIndex];
    
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
      const vendas = updates.realizadoVendas ?? currentMonthData.realizadoVendas;
      const ticket = updates.ticketRealizado ?? currentMonthData.ticketRealizado;
      dbUpdates.realizado_faturamento = vendas * ticket;
    }

    // Busca ID do registro e salva histórico
    try {
      const { data: existingRecord } = await supabase
        .from('dados_realizados')
        .select('id')
        .eq('month', monthName)
        .single();

      if (existingRecord) {
        // Salva cada campo alterado no histórico
        for (const [field, newValue] of Object.entries(updates)) {
          const oldValue = currentMonthData[field as keyof MonthData];
          if (typeof oldValue === 'number' && typeof newValue === 'number') {
            await saveToHistory(existingRecord.id, monthName, field, oldValue, newValue);
          }
        }

        // Atualiza o registro
        await supabase
          .from('dados_realizados')
          .update(dbUpdates)
          .eq('month', monthName);
      }
    } catch (error) {
      console.error('Erro ao salvar dados:', error);
    }
  }, [data, saveToHistory]);

  // Reverte para um valor anterior do histórico
  const revertToValue = useCallback(async (month: string, field: string, value: number) => {
    const monthIndex = MONTHS.indexOf(month);
    if (monthIndex === -1) return;
    
    await updateMonthData(monthIndex, { [field]: value } as Partial<MonthData>);
  }, [updateMonthData]);

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
    
    // Valor inicial zerado para evitar duplicar as metas
    const initialValue: MonthData = {
      month: filterType === 'quarter' ? `${selectedQuarter}` : 'Anual',
      monthIndex: -1,
      metaVendas: 0,
      realizadoVendas: 0,
      metaFaturamento: 0,
      realizadoFaturamento: 0,
      ticketRealizado: VALOR_POR_VENDA,
      metaPrimeiraReuniao: 0,
      realizadoPrimeiraReuniao: 0,
      metaSegundaReuniao: 0,
      realizadoSegundaReuniao: 0
    };
    
    return filteredData.reduce((acc, month) => ({
      ...acc,
      metaVendas: acc.metaVendas + month.metaVendas,
      realizadoVendas: acc.realizadoVendas + month.realizadoVendas,
      metaFaturamento: acc.metaFaturamento + month.metaFaturamento,
      realizadoFaturamento: acc.realizadoFaturamento + month.realizadoFaturamento,
      metaPrimeiraReuniao: acc.metaPrimeiraReuniao + month.metaPrimeiraReuniao,
      realizadoPrimeiraReuniao: acc.realizadoPrimeiraReuniao + month.realizadoPrimeiraReuniao,
      metaSegundaReuniao: acc.metaSegundaReuniao + month.metaSegundaReuniao,
      realizadoSegundaReuniao: acc.realizadoSegundaReuniao + month.realizadoSegundaReuniao
    }), initialValue);
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
    revertToValue,
    isLoading
  };
};
