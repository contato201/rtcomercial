import { useState, useCallback, useMemo, useEffect } from 'react';
import { z } from 'zod';
import { MonthData, FilterType, QuarterType, QUARTERS, VALOR_POR_VENDA, createInitialData, MONTHS, TAXA_COMPARECIMENTO } from '@/types/dashboard';
import { supabase } from '@/integrations/supabase/client';
import { safeVariation, toFiniteNumber } from '@/lib/formatters';

type UnitSaleRow = {
  id: string;
  month: string;
  valor: number;
  cliente: string;
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

export type ReuniaoEntryRow = {
  id: string;
  month: string;
  tipo: 'primeira' | 'segunda';
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

const tipoReuniaoSchema = z.enum(['primeira', 'segunda']);

export const useDashboardData = () => {
  const [data, setData] = useState<MonthData[]>(createInitialData());
  const [unitSalesByMonth, setUnitSalesByMonth] = useState<Record<string, UnitSaleRow[]>>({});
  const [agendamentos, setAgendamentos] = useState<AgendamentoRow[]>([]);
  const [reunioesEntries, setReunioesEntries] = useState<ReuniaoEntryRow[]>([]);
  const [filterType, setFilterType] = useState<FilterType>('month');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterType>('Q1');
  const [isLoading, setIsLoading] = useState(true);

  const loadFromDatabase = useCallback(async () => {
    try {
      const [
        { data: dbData, error },
        { data: unitData, error: unitError },
        { data: agendamentosData, error: agendamentosError },
        { data: reunioesData, error: reunioesError },
      ] = await Promise.all([
        supabase.from('dados_realizados').select('*'),
        supabase.from('vendas_unitarias').select('*').order('created_at', { ascending: true }),
        supabase.from('agendamentos' as any).select('*').order('data_lancamento', { ascending: false }),
        supabase.from('reunioes_entries' as any).select('*').order('data_lancamento', { ascending: false }),
      ]);

      if (error) { console.error('Erro ao carregar dados:', error); return; }
      if (unitError) console.error('Erro ao carregar vendas unitárias:', unitError);
      if (agendamentosError) console.error('Erro ao carregar agendamentos:', agendamentosError);
      if (reunioesError) console.error('Erro ao carregar reuniões:', reunioesError);

      // Process agendamentos
      const processedAgendamentos: AgendamentoRow[] = ((agendamentosData as any[]) ?? []).map((row: any) => ({
        id: row.id,
        month: row.month,
        pessoa: row.pessoa as 'Tadeu' | 'Nicole',
        quantidade: toFiniteNumber(row.quantidade),
        data_lancamento: row.data_lancamento,
        created_at: row.created_at,
      }));
      setAgendamentos(processedAgendamentos);

      // Process reunioes entries
      const processedReunioes: ReuniaoEntryRow[] = ((reunioesData as any[]) ?? []).map((row: any) => ({
        id: row.id,
        month: row.month,
        tipo: row.tipo as 'primeira' | 'segunda',
        quantidade: toFiniteNumber(row.quantidade),
        data_lancamento: row.data_lancamento,
        created_at: row.created_at,
      }));
      setReunioesEntries(processedReunioes);

      // Aggregate reunioes by month
      const reunioesAgg = MONTHS.reduce<Record<string, { primeira: number; segunda: number }>>((acc, m) => {
        const monthEntries = processedReunioes.filter(e => e.month === m);
        acc[m] = {
          primeira: monthEntries.filter(e => e.tipo === 'primeira').reduce((s, e) => s + e.quantidade, 0),
          segunda: monthEntries.filter(e => e.tipo === 'segunda').reduce((s, e) => s + e.quantidade, 0),
        };
        return acc;
      }, {});

      // Process unit sales
      const groupedUnitSales = (unitData ?? []).reduce<Record<string, UnitSaleRow[]>>((acc, row) => {
        const month = String(row.month);
        acc[month] = acc[month] ?? [];
        acc[month].push({
          id: row.id, month, valor: Number(row.valor || 0),
          cliente: (row as any).cliente ?? '',
          created_at: row.created_at, updated_at: row.updated_at,
        });
        return acc;
      }, {});
      setUnitSalesByMonth(groupedUnitSales);

      const unitAgg = MONTHS.reduce<Record<string, { count: number; sum: number; avg: number }>>((acc, m) => {
        const list = groupedUnitSales[m] ?? [];
        const count = list.length;
        const sum = list.reduce((s, it) => s + Number(it.valor || 0), 0);
        const avg = count > 0 ? sum / count : 0;
        acc[m] = { count, sum, avg };
        return acc;
      }, {});

      if (dbData) {
        const initialData = createInitialData();
        const updatedData = initialData.map(month => {
          const dbMonth = dbData.find(d => d.month === month.month);
          const agg = unitAgg[month.month] ?? { count: 0, sum: 0, avg: 0 };
          const rAgg = reunioesAgg[month.month] ?? { primeira: 0, segunda: 0 };
          
          // Use reunioes entries as source of truth if there are entries, otherwise fall back to db value
          const hasReuniaoEntries = processedReunioes.some(e => e.month === month.month);
          
          if (dbMonth) {
            return {
              ...month,
              realizadoVendas: toFiniteNumber(agg.count),
              realizadoFaturamento: toFiniteNumber(agg.sum),
              ticketRealizado: agg.count > 0 ? toFiniteNumber(agg.avg) : (toFiniteNumber(dbMonth.ticket_realizado) || VALOR_POR_VENDA),
              realizadoPrimeiraReuniao: hasReuniaoEntries ? toFiniteNumber(rAgg.primeira) : toFiniteNumber(dbMonth.realizado_primeira_reuniao),
              realizadoSegundaReuniao: hasReuniaoEntries ? toFiniteNumber(rAgg.segunda) : toFiniteNumber(dbMonth.realizado_segunda_reuniao),
            };
          }
          return {
            ...month,
            realizadoVendas: toFiniteNumber(agg.count),
            realizadoFaturamento: toFiniteNumber(agg.sum),
            ticketRealizado: agg.count > 0 ? toFiniteNumber(agg.avg) : VALOR_POR_VENDA,
            realizadoPrimeiraReuniao: toFiniteNumber(rAgg.primeira),
            realizadoSegundaReuniao: toFiniteNumber(rAgg.segunda),
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
        return { ...m, realizadoVendas: count, realizadoFaturamento: sum, ticketRealizado: count > 0 ? avg : m.ticketRealizado };
      })
    );
  }, []);

  useEffect(() => {
    loadFromDatabase();
    const channel = supabase
      .channel('dashboard_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dados_realizados' }, () => loadFromDatabase())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendas_unitarias' }, () => loadFromDatabase())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, () => loadFromDatabase())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reunioes_entries' }, () => loadFromDatabase())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadFromDatabase]);

  const saveToHistory = useCallback(async (
    dadosRealizadosId: string, monthName: string, field: string, oldValue: number, newValue: number
  ) => {
    if (oldValue === newValue) return;
    const dbFieldMap: Record<string, string> = {
      realizadoVendas: 'realizado_vendas', realizadoFaturamento: 'realizado_faturamento',
      realizadoPrimeiraReuniao: 'realizado_primeira_reuniao', realizadoSegundaReuniao: 'realizado_segunda_reuniao',
      ticketRealizado: 'ticket_realizado',
    };
    const dbField = dbFieldMap[field];
    if (!dbField) return;
    try {
      await supabase.from('historico_alteracoes').insert({
        dados_realizados_id: dadosRealizadosId, month: monthName,
        campo_alterado: dbField, valor_anterior: oldValue, valor_novo: newValue,
      });
    } catch (error) { console.error('Erro ao salvar histórico:', error); }
  }, []);

  const updateMonthData = useCallback(async (monthIndex: number, updates: Partial<MonthData>) => {
    const monthName = MONTHS[monthIndex];
    const currentMonthData = data[monthIndex];
    const sanitizedUpdates: Partial<MonthData> = { ...updates };
    delete (sanitizedUpdates as Partial<MonthData>).realizadoVendas;
    delete (sanitizedUpdates as Partial<MonthData>).realizadoFaturamento;
    delete (sanitizedUpdates as Partial<MonthData>).ticketRealizado;
    // Don't allow direct edit if reunioes entries exist for this month
    // (they are now managed via incremental entries)
    if (Object.keys(sanitizedUpdates).length === 0) return;

    setData(prevData => {
      const newData = [...prevData];
      newData[monthIndex] = { ...newData[monthIndex], ...sanitizedUpdates };
      return newData;
    });

    const dbUpdates: Record<string, number> = {};
    if (sanitizedUpdates.realizadoPrimeiraReuniao !== undefined) dbUpdates.realizado_primeira_reuniao = sanitizedUpdates.realizadoPrimeiraReuniao;
    if (sanitizedUpdates.realizadoSegundaReuniao !== undefined) dbUpdates.realizado_segunda_reuniao = sanitizedUpdates.realizadoSegundaReuniao;

    try {
      const { data: existingRecord } = await supabase.from('dados_realizados').select('id').eq('month', monthName).maybeSingle();
      if (existingRecord) {
        for (const [field, newValue] of Object.entries(sanitizedUpdates)) {
          const oldValue = currentMonthData[field as keyof MonthData];
          if (typeof oldValue === 'number' && typeof newValue === 'number') {
            await saveToHistory(existingRecord.id, monthName, field, oldValue, newValue);
          }
        }
        await supabase.from('dados_realizados').update(dbUpdates).eq('month', monthName);
      }
    } catch (error) { console.error('Erro ao salvar dados:', error); }
  }, [data, saveToHistory]);

  const addUnitSale = useCallback(async (monthIndex: number, valor: number, cliente: string = '') => {
    const monthName = MONTHS[monthIndex];
    const m = monthSchema.safeParse(monthName);
    const v = valorSchema.safeParse(valor);
    if (!m.success || !v.success) return;

    const { data: inserted, error } = await supabase
      .from('vendas_unitarias')
      .insert({ month: m.data, valor: v.data, cliente } as any)
      .select('*')
      .single();
    if (error) { console.error('Erro ao inserir venda unitária:', error); return; }

    setUnitSalesByMonth((prev) => {
      const next = { ...prev };
      const list = [...(next[m.data] ?? [])];
      const newRow: UnitSaleRow = {
        id: inserted.id, month: inserted.month, valor: Number(inserted.valor || 0),
        cliente: (inserted as any).cliente ?? '', created_at: inserted.created_at, updated_at: inserted.updated_at,
      };
      list.push(newRow);
      next[m.data] = list;
      applyUnitSalesAggregateToMonth(m.data, list);
      return next;
    });
  }, [applyUnitSalesAggregateToMonth]);

  const updateUnitSale = useCallback(async (id: string, valor: number, cliente: string = '') => {
    const v = valorSchema.safeParse(valor);
    if (!v.success) return;

    const { data: updated, error } = await supabase
      .from('vendas_unitarias')
      .update({ valor: v.data, cliente } as any)
      .eq('id', id)
      .select('*')
      .single();
    if (error) { console.error('Erro ao atualizar venda unitária:', error); return; }

    setUnitSalesByMonth((prev) => {
      const next = { ...prev };
      const monthName = String(updated.month);
      const list = [...(next[monthName] ?? [])];
      const idx = list.findIndex((s) => s.id === id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], valor: Number(updated.valor || 0), cliente: (updated as any).cliente ?? '', updated_at: updated.updated_at };
      }
      next[monthName] = list;
      applyUnitSalesAggregateToMonth(monthName, list);
      return next;
    });
  }, [applyUnitSalesAggregateToMonth]);

  const deleteUnitSale = useCallback(async (id: string) => {
    const { data: deleted, error } = await supabase.from('vendas_unitarias').delete().eq('id', id).select('*').maybeSingle();
    if (error) { console.error('Erro ao excluir venda unitária:', error); return; }
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

  const revertToValue = useCallback(async (month: string, field: string, value: number) => {
    const monthIndex = MONTHS.indexOf(month);
    if (monthIndex === -1) return;
    await updateMonthData(monthIndex, { [field]: value } as Partial<MonthData>);
  }, [updateMonthData]);

  const filteredData = useMemo(() => {
    switch (filterType) {
      case 'month': return [data[selectedMonth]];
      case 'quarter': return QUARTERS[selectedQuarter].map(i => data[i]);
      case 'year': return data;
      default: return data;
    }
  }, [data, filterType, selectedMonth, selectedQuarter]);

  const aggregatedData = useMemo(() => {
    if (filteredData.length === 1) return filteredData[0];
    const initialValue: MonthData = {
      month: filterType === 'quarter' ? `${selectedQuarter}` : 'Anual',
      monthIndex: -1, metaVendas: 0, realizadoVendas: 0, metaFaturamento: 0, realizadoFaturamento: 0,
      ticketRealizado: VALOR_POR_VENDA, metaPrimeiraReuniao: 0, realizadoPrimeiraReuniao: 0,
      metaSegundaReuniao: 0, realizadoSegundaReuniao: 0,
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
      realizadoSegundaReuniao: acc.realizadoSegundaReuniao + month.realizadoSegundaReuniao,
    }), initialValue);
  }, [filteredData, filterType, selectedQuarter]);

  const calculateVariation = useCallback((meta: number, realizado: number): number => {
    return safeVariation(meta, realizado);
  }, []);

  const resetData = useCallback(async () => {
    const initial = createInitialData();
    setData(initial);
    setUnitSalesByMonth({});
    try { await supabase.from('vendas_unitarias').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch (e) { console.error(e); }
    try { await supabase.from('reunioes_entries' as any).delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch (e) { console.error(e); }
    for (const month of MONTHS) {
      await supabase.from('dados_realizados').update({
        realizado_vendas: 0, realizado_faturamento: 0,
        realizado_primeira_reuniao: 0, realizado_segunda_reuniao: 0, ticket_realizado: VALOR_POR_VENDA,
      }).eq('month', month);
    }
  }, []);

  // Agendamentos
  const addAgendamento = useCallback(async (monthIndex: number, pessoa: 'Tadeu' | 'Nicole', quantidade: number) => {
    const monthName = MONTHS[monthIndex];
    const m = monthSchema.safeParse(monthName);
    const p = pessoaSchema.safeParse(pessoa);
    const q = quantidadeSchema.safeParse(quantidade);
    if (!m.success || !p.success || !q.success) return;
    const { data: inserted, error } = await supabase.from('agendamentos' as any).insert({ month: m.data, pessoa: p.data, quantidade: q.data }).select('*').single();
    if (error) { console.error('Erro ao inserir agendamento:', error); return; }
    const newRow: AgendamentoRow = {
      id: (inserted as any).id, month: (inserted as any).month, pessoa: (inserted as any).pessoa,
      quantidade: (inserted as any).quantidade, data_lancamento: (inserted as any).data_lancamento, created_at: (inserted as any).created_at,
    };
    setAgendamentos((prev) => [newRow, ...prev]);
  }, []);

  const deleteAgendamento = useCallback(async (id: string) => {
    const { error } = await supabase.from('agendamentos' as any).delete().eq('id', id);
    if (error) { console.error('Erro ao excluir agendamento:', error); return; }
    setAgendamentos((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Reuniões entries
  const addReuniaoEntry = useCallback(async (monthIndex: number, tipo: 'primeira' | 'segunda', quantidade: number) => {
    const monthName = MONTHS[monthIndex];
    const m = monthSchema.safeParse(monthName);
    const t = tipoReuniaoSchema.safeParse(tipo);
    const q = quantidadeSchema.safeParse(quantidade);
    if (!m.success || !t.success || !q.success) return;

    const { data: inserted, error } = await supabase
      .from('reunioes_entries' as any)
      .insert({ month: m.data, tipo: t.data, quantidade: q.data })
      .select('*')
      .single();
    if (error) { console.error('Erro ao inserir reunião:', error); return; }

    const newRow: ReuniaoEntryRow = {
      id: (inserted as any).id, month: (inserted as any).month, tipo: (inserted as any).tipo,
      quantidade: (inserted as any).quantidade, data_lancamento: (inserted as any).data_lancamento,
      created_at: (inserted as any).created_at,
    };
    setReunioesEntries((prev) => [newRow, ...prev]);

    // Update data aggregates optimistically
    setData((prev) => prev.map((md) => {
      if (md.month !== m.data) return md;
      if (tipo === 'primeira') return { ...md, realizadoPrimeiraReuniao: md.realizadoPrimeiraReuniao + quantidade };
      return { ...md, realizadoSegundaReuniao: md.realizadoSegundaReuniao + quantidade };
    }));

    // Also sync to dados_realizados
    try {
      const currentMonth = data.find(d => d.month === m.data);
      if (currentMonth) {
        const newTotal = tipo === 'primeira'
          ? currentMonth.realizadoPrimeiraReuniao + quantidade
          : currentMonth.realizadoSegundaReuniao + quantidade;
        const field = tipo === 'primeira' ? 'realizado_primeira_reuniao' : 'realizado_segunda_reuniao';
        await supabase.from('dados_realizados').update({ [field]: newTotal }).eq('month', m.data);
      }
    } catch (e) { console.error(e); }
  }, [data]);

  const deleteReuniaoEntry = useCallback(async (id: string) => {
    const entry = reunioesEntries.find(e => e.id === id);
    const { error } = await supabase.from('reunioes_entries' as any).delete().eq('id', id);
    if (error) { console.error('Erro ao excluir reunião:', error); return; }
    setReunioesEntries((prev) => prev.filter((e) => e.id !== id));

    if (entry) {
      setData((prev) => prev.map((md) => {
        if (md.month !== entry.month) return md;
        if (entry.tipo === 'primeira') return { ...md, realizadoPrimeiraReuniao: Math.max(0, md.realizadoPrimeiraReuniao - entry.quantidade) };
        return { ...md, realizadoSegundaReuniao: Math.max(0, md.realizadoSegundaReuniao - entry.quantidade) };
      }));

      // Sync to dados_realizados
      try {
        const currentMonth = data.find(d => d.month === entry.month);
        if (currentMonth) {
          const newTotal = entry.tipo === 'primeira'
            ? Math.max(0, currentMonth.realizadoPrimeiraReuniao - entry.quantidade)
            : Math.max(0, currentMonth.realizadoSegundaReuniao - entry.quantidade);
          const field = entry.tipo === 'primeira' ? 'realizado_primeira_reuniao' : 'realizado_segunda_reuniao';
          await supabase.from('dados_realizados').update({ [field]: newTotal }).eq('month', entry.month);
        }
      } catch (e) { console.error(e); }
    }
  }, [reunioesEntries, data]);

  const getMetaAgendamentos = useCallback((monthIndex: number) => {
    const monthData = data[monthIndex];
    if (!monthData) return 0;
    return Math.ceil(monthData.metaPrimeiraReuniao / TAXA_COMPARECIMENTO);
  }, [data]);

  return {
    data,
    unitSalesByMonth,
    agendamentos,
    reunioesEntries,
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
    addReuniaoEntry,
    deleteReuniaoEntry,
    getMetaAgendamentos,
    calculateVariation,
    resetData,
    revertToValue,
    isLoading,
  };
};
