import { useState, useCallback, useMemo, useEffect } from 'react';
import { z } from 'zod';
import { MonthData, FilterType, QuarterType, QUARTERS, VALOR_POR_VENDA, createInitialData, MONTHS } from '@/types/dashboard';
import { supabase } from '@/integrations/supabase/client';

type UnitSaleRow = {
  id: string;
  month: string;
  valor: number;
  created_at: string;
  updated_at: string;
};

const monthSchema = z.enum(MONTHS as [string, ...string[]]);
const valorSchema = z
  .number({ invalid_type_error: 'Valor inválido' })
  .finite()
  .positive('Valor precisa ser maior que zero')
  .max(1_000_000, 'Valor muito alto');

export const useDashboardData = () => {
  const [data, setData] = useState<MonthData[]>(createInitialData());
  const [unitSalesByMonth, setUnitSalesByMonth] = useState<Record<string, UnitSaleRow[]>>({});
  const [filterType, setFilterType] = useState<FilterType>('month');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterType>('Q1');
  const [isLoading, setIsLoading] = useState(true);

  // Carrega dados do banco
  const loadFromDatabase = useCallback(async () => {
    try {
      const [{ data: dbData, error }, { data: unitData, error: unitError }] = await Promise.all([
        supabase.from('dados_realizados').select('*'),
        supabase
          .from('vendas_unitarias')
          .select('*')
          .order('created_at', { ascending: true }),
      ]);

      if (error) {
        console.error('Erro ao carregar dados:', error);
        return;
      }

      if (unitError) {
        console.error('Erro ao carregar vendas unitárias:', unitError);
      }

      const groupedUnitSales = (unitData ?? []).reduce<Record<string, UnitSaleRow[]>>((acc, row) => {
        const month = String(row.month);
        acc[month] = acc[month] ?? [];
        acc[month].push({
          id: row.id,
          month,
          valor: Number(row.valor || 0),
          created_at: row.created_at,
          updated_at: row.updated_at,
        });
        return acc;
      }, {});
      setUnitSalesByMonth(groupedUnitSales);

      const unitAgg = MONTHS.reduce<Record<string, { count: number; sum: number; avg: number }>>(
        (acc, m) => {
          const list = groupedUnitSales[m] ?? [];
          const count = list.length;
          const sum = list.reduce((s, it) => s + Number(it.valor || 0), 0);
          const avg = count > 0 ? sum / count : 0;
          acc[m] = { count, sum, avg };
          return acc;
        },
        {}
      );

      if (dbData) {
        const initialData = createInitialData();
        const updatedData = initialData.map(month => {
          const dbMonth = dbData.find(d => d.month === month.month);
          const agg = unitAgg[month.month] ?? { count: 0, sum: 0, avg: 0 };
        if (dbMonth) {
            return {
              ...month,
              // Fonte de verdade: vendas unitárias
              realizadoVendas: agg.count,
              realizadoFaturamento: agg.sum,
              ticketRealizado: agg.count > 0 ? agg.avg : (Number(dbMonth.ticket_realizado) || VALOR_POR_VENDA),
              realizadoPrimeiraReuniao: dbMonth.realizado_primeira_reuniao || 0,
              realizadoSegundaReuniao: dbMonth.realizado_segunda_reuniao || 0
            };
          }
          return {
            ...month,
            realizadoVendas: agg.count,
            realizadoFaturamento: agg.sum,
            ticketRealizado: agg.count > 0 ? agg.avg : VALOR_POR_VENDA,
          };
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
      .channel('dashboard_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dados_realizados' },
        (payload) => {
          console.log('Realtime update (dados_realizados):', payload);
          loadFromDatabase();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vendas_unitarias' },
        (payload) => {
          console.log('Realtime update (vendas_unitarias):', payload);
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
      ticketRealizado: 'ticket_realizado',
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

    // Com vendas unitárias como fonte de verdade, não permitimos sobrescrever
    // vendas/faturamento/ticket manualmente por aqui.
    const sanitizedUpdates: Partial<MonthData> = { ...updates };
    delete (sanitizedUpdates as Partial<MonthData>).realizadoVendas;
    delete (sanitizedUpdates as Partial<MonthData>).realizadoFaturamento;
    delete (sanitizedUpdates as Partial<MonthData>).ticketRealizado;

    if (Object.keys(sanitizedUpdates).length === 0) return;
    
    // Atualiza estado local imediatamente para UX responsiva
    setData(prevData => {
      const newData = [...prevData];
      const currentMonth = { ...newData[monthIndex], ...sanitizedUpdates };
      
      newData[monthIndex] = currentMonth;
      return newData;
    });

    // Prepara dados para o banco
    const dbUpdates: Record<string, number> = {};
    if (sanitizedUpdates.realizadoPrimeiraReuniao !== undefined) {
      dbUpdates.realizado_primeira_reuniao = sanitizedUpdates.realizadoPrimeiraReuniao;
    }
    if (sanitizedUpdates.realizadoSegundaReuniao !== undefined) {
      dbUpdates.realizado_segunda_reuniao = sanitizedUpdates.realizadoSegundaReuniao;
    }

    // Busca ID do registro e salva histórico
    try {
        const { data: existingRecord } = await supabase
        .from('dados_realizados')
        .select('id')
        .eq('month', monthName)
          .maybeSingle();

      if (existingRecord) {
        // Salva cada campo alterado no histórico
        for (const [field, newValue] of Object.entries(sanitizedUpdates)) {
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

  const addUnitSale = useCallback(async (monthIndex: number, valor: number) => {
    const monthName = MONTHS[monthIndex];
    const m = monthSchema.safeParse(monthName);
    const v = valorSchema.safeParse(valor);
    if (!m.success || !v.success) return;

    const { error } = await supabase.from('vendas_unitarias').insert({
      month: m.data,
      valor: v.data,
    });
    if (error) console.error('Erro ao inserir venda unitária:', error);
  }, []);

  const updateUnitSale = useCallback(async (id: string, valor: number) => {
    const v = valorSchema.safeParse(valor);
    if (!v.success) return;

    const { error } = await supabase
      .from('vendas_unitarias')
      .update({ valor: v.data })
      .eq('id', id);
    if (error) console.error('Erro ao atualizar venda unitária:', error);
  }, []);

  const deleteUnitSale = useCallback(async (id: string) => {
    const { error } = await supabase.from('vendas_unitarias').delete().eq('id', id);
    if (error) console.error('Erro ao excluir venda unitária:', error);
  }, []);

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
    setUnitSalesByMonth({});

    // Limpa vendas unitárias
    try {
      await supabase.from('vendas_unitarias').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch (e) {
      console.error('Erro ao limpar vendas unitárias:', e);
    }
    
    // Reset no banco para todos os meses
    for (const month of MONTHS) {
      await supabase
        .from('dados_realizados')
        .update({
          realizado_vendas: 0,
          realizado_faturamento: 0,
          realizado_primeira_reuniao: 0,
          realizado_segunda_reuniao: 0,
          ticket_realizado: VALOR_POR_VENDA
        })
        .eq('month', month);
    }
  }, []);

  return {
    data,
    unitSalesByMonth,
    filteredData,
    aggregatedData,
    filterType,
    setFilterType,
    selectedMonth,
    setSelectedMonth,
    selectedQuarter,
    setSelectedQuarter,
    updateMonthData,
    addUnitSale,
    updateUnitSale,
    deleteUnitSale,
    calculateVariation,
    resetData,
    revertToValue,
    isLoading
  };
};
