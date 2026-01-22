import { useState, useCallback, useMemo, useEffect } from 'react';
import { z } from 'zod';
import { MonthData, FilterType, QuarterType, QUARTERS, VALOR_POR_VENDA, createInitialData, MONTHS, TAXA_COMPARECIMENTO } from '@/types/dashboard';
import { supabase } from '@/integrations/supabase/client';

type UnitSaleRow = {
  id: string;
  month: string;
  valor: number;
  created_at: string;
  updated_at: string;
};

export type AgendamentoRow = {
  id: string;
  month: string;
  pessoa: 'Tadeu' | 'Nicole';
  quantidade: number;
  data_lancamento: string;
  created_at: string;
};

const monthSchema = z.enum(MONTHS as [string, ...string[]]);
const valorSchema = z
  .number({ invalid_type_error: 'Valor inválido' })
  .finite()
  .positive('Valor precisa ser maior que zero')
  .max(1_000_000, 'Valor muito alto');

const pessoaSchema = z.enum(['Tadeu', 'Nicole']);
const quantidadeSchema = z
  .number({ invalid_type_error: 'Quantidade inválida' })
  .int()
  .positive('Quantidade precisa ser maior que zero')
  .max(10_000, 'Quantidade muito alta');

export const useDashboardData = () => {
  const [data, setData] = useState<MonthData[]>(createInitialData());
  const [unitSalesByMonth, setUnitSalesByMonth] = useState<Record<string, UnitSaleRow[]>>({});
  const [agendamentos, setAgendamentos] = useState<AgendamentoRow[]>([]);
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

      // Query separada para agendamentos (tabela nova, tipos ainda não gerados)
      const { data: agendamentosData, error: agendamentosError } = await supabase
        .from('agendamentos' as any)
        .select('*')
        .order('data_lancamento', { ascending: false });

      if (error) {
        console.error('Erro ao carregar dados:', error);
        return;
      }

      if (unitError) {
        console.error('Erro ao carregar vendas unitárias:', unitError);
      }

      if (agendamentosError) {
        console.error('Erro ao carregar agendamentos:', agendamentosError);
      }

      // Processa agendamentos
      const processedAgendamentos: AgendamentoRow[] = ((agendamentosData as any[]) ?? []).map((row: any) => ({
        id: row.id,
        month: row.month,
        pessoa: row.pessoa as 'Tadeu' | 'Nicole',
        quantidade: row.quantidade,
        data_lancamento: row.data_lancamento,
        created_at: row.created_at,
      }));
      setAgendamentos(processedAgendamentos);

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

  const applyUnitSalesAggregateToMonth = useCallback((monthName: string, list: UnitSaleRow[]) => {
    const count = list.length;
    const sum = list.reduce((s, it) => s + Number(it.valor || 0), 0);
    const avg = count > 0 ? sum / count : 0;

    setData((prev) =>
      prev.map((m) => {
        if (m.month !== monthName) return m;
        return {
          ...m,
          realizadoVendas: count,
          realizadoFaturamento: sum,
          ticketRealizado: count > 0 ? avg : m.ticketRealizado,
        };
      })
    );
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agendamentos' },
        (payload) => {
          console.log('Realtime update (agendamentos):', payload);
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

    const { data: inserted, error } = await supabase
      .from('vendas_unitarias')
      .insert({ month: m.data, valor: v.data })
      .select('*')
      .single();
    if (error) {
      console.error('Erro ao inserir venda unitária:', error);
      return;
    }

    // Atualização otimista do estado (não depende de realtime)
    setUnitSalesByMonth((prev) => {
      const next = { ...prev };
      const list = [...(next[m.data] ?? [])];
      const newRow: UnitSaleRow = {
        id: inserted.id,
        month: inserted.month,
        valor: Number(inserted.valor || 0),
        created_at: inserted.created_at,
        updated_at: inserted.updated_at,
      };
      list.push(newRow);
      next[m.data] = list;
      // Atualiza agregados no dashboard imediatamente
      applyUnitSalesAggregateToMonth(m.data, list);
      return next;
    });
  }, [applyUnitSalesAggregateToMonth]);

  const updateUnitSale = useCallback(async (id: string, valor: number) => {
    const v = valorSchema.safeParse(valor);
    if (!v.success) return;

    const { data: updated, error } = await supabase
      .from('vendas_unitarias')
      .update({ valor: v.data })
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      console.error('Erro ao atualizar venda unitária:', error);
      return;
    }

    setUnitSalesByMonth((prev) => {
      const next = { ...prev };
      const monthName = String(updated.month);
      const list = [...(next[monthName] ?? [])];
      const idx = list.findIndex((s) => s.id === id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], valor: Number(updated.valor || 0), updated_at: updated.updated_at };
      }
      next[monthName] = list;
      applyUnitSalesAggregateToMonth(monthName, list);
      return next;
    });
  }, [applyUnitSalesAggregateToMonth]);

  const deleteUnitSale = useCallback(async (id: string) => {
    const { data: deleted, error } = await supabase
      .from('vendas_unitarias')
      .delete()
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) {
      console.error('Erro ao excluir venda unitária:', error);
      return;
    }
    if (!deleted) return;

    const monthName = String(deleted.month);
    setUnitSalesByMonth((prev) => {
      const next = { ...prev };
      const list = (next[monthName] ?? []).filter((s) => s.id !== id);
      next[monthName] = list;
      applyUnitSalesAggregateToMonth(monthName, list);
      return next;
    });
  }, [applyUnitSalesAggregateToMonth]);

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

  // Funções de agendamentos
  const addAgendamento = useCallback(async (monthIndex: number, pessoa: 'Tadeu' | 'Nicole', quantidade: number) => {
    const monthName = MONTHS[monthIndex];
    const m = monthSchema.safeParse(monthName);
    const p = pessoaSchema.safeParse(pessoa);
    const q = quantidadeSchema.safeParse(quantidade);
    if (!m.success || !p.success || !q.success) return;

    const { data: inserted, error } = await supabase
      .from('agendamentos' as any)
      .insert({ month: m.data, pessoa: p.data, quantidade: q.data })
      .select('*')
      .single();
    
    if (error) {
      console.error('Erro ao inserir agendamento:', error);
      return;
    }

    // Atualização otimista
    const newRow: AgendamentoRow = {
      id: (inserted as any).id,
      month: (inserted as any).month,
      pessoa: (inserted as any).pessoa,
      quantidade: (inserted as any).quantidade,
      data_lancamento: (inserted as any).data_lancamento,
      created_at: (inserted as any).created_at,
    };
    setAgendamentos((prev) => [newRow, ...prev]);
  }, []);

  const deleteAgendamento = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('agendamentos' as any)
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Erro ao excluir agendamento:', error);
      return;
    }

    setAgendamentos((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Calcula meta de agendamentos para um mês
  const getMetaAgendamentos = useCallback((monthIndex: number) => {
    const monthData = data[monthIndex];
    if (!monthData) return 0;
    // Meta de agendamentos = Meta 1ª Reuniões / taxa de comparecimento (60%)
    return Math.ceil(monthData.metaPrimeiraReuniao / TAXA_COMPARECIMENTO);
  }, [data]);

  return {
    data,
    unitSalesByMonth,
    agendamentos,
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
    addAgendamento,
    deleteAgendamento,
    getMetaAgendamentos,
    calculateVariation,
    resetData,
    revertToValue,
    isLoading
  };
};
