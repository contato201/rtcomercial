import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GrowthData, MONTHS, createEmptyGrowthData, calculateMetrics } from '@/types/growth';
import { toast } from 'sonner';

// Interface para os dados do banco (antes de gerar os types)
interface DadosTrafego {
  id: string;
  month: string;
  investimento: number;
  impressoes: number;
  cliques: number;
  cpc: number;
  leads_total: number;
  leads_qualificados: number;
  reunioes_agendadas: number;
  vendas_fechadas: number;
  valor_vendas: number;
  created_at: string;
  updated_at: string;
}

export const useGrowthData = () => {
  const [data, setData] = useState<GrowthData[]>(() => 
    MONTHS.map((_, index) => createEmptyGrowthData(index))
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());

  const loadFromDatabase = useCallback(async () => {
    try {
      const { data: dbData, error } = await supabase
        .from('dados_trafego' as any)
        .select('*') as { data: DadosTrafego[] | null; error: any };

      if (error) throw error;

      setData(prevData => {
        const newData = [...prevData];
        
        
        dbData?.forEach(row => {
          const monthIndex = MONTHS.indexOf(row.month);
          if (monthIndex !== -1) {
            const growthData: GrowthData = {
              id: row.id,
              month: row.month,
              monthIndex,
              investimento: Number(row.investimento) || 0,
              impressoes: row.impressoes || 0,
              cliques: row.cliques || 0,
              cpc: Number(row.cpc) || 0,
              leadsTotal: row.leads_total || 0,
              leadsQualificados: row.leads_qualificados || 0,
              reunioesAgendadas: row.reunioes_agendadas || 0,
              vendasFechadas: row.vendas_fechadas || 0,
              valorVendas: Number(row.valor_vendas) || 0,
              cpl: 0,
              cac: 0,
              taxaMQL: 0,
              taxaReuniao: 0,
              taxaFechamento: 0,
            };
            newData[monthIndex] = calculateMetrics(growthData);
          }
        });

        return newData;
      });
    } catch (error) {
      console.error('Erro ao carregar dados de tráfego:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const syncFromSheets = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { data: response, error } = await supabase.functions.invoke('fetch-sheets-data');

      if (error) throw error;

      if (response?.success && response?.data) {
        // Atualizar dados no banco com os dados do Sheets
        for (const [month, values] of Object.entries(response.data)) {
          const sheetsData = values as { investimento: number; impressoes: number; cliques: number; leads: number; cpc: number };
          
          const { error: upsertError } = await supabase
            .from('dados_trafego' as any)
            .upsert({
              month,
              investimento: sheetsData.investimento || 0,
              impressoes: sheetsData.impressoes || 0,
              cliques: sheetsData.cliques || 0,
              cpc: sheetsData.cpc || 0,
              leads_total: sheetsData.leads || 0,
            }, {
              onConflict: 'month'
            });

          if (upsertError) {
            console.error('Erro ao salvar dados:', upsertError);
          }
        }

        await loadFromDatabase();
        toast.success('Dados sincronizados com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
      toast.error('Erro ao sincronizar dados do Sheets');
    } finally {
      setIsSyncing(false);
    }
  }, [loadFromDatabase]);

  const updateManualData = useCallback(async (
    monthIndex: number,
    updates: Partial<Pick<GrowthData, 'leadsQualificados' | 'reunioesAgendadas' | 'vendasFechadas' | 'valorVendas'>>
  ) => {
    const monthName = MONTHS[monthIndex];
    
    try {
      // Mapear campos para snake_case do banco
      const dbUpdates: Record<string, number> = {};
      if (updates.leadsQualificados !== undefined) dbUpdates.leads_qualificados = updates.leadsQualificados;
      if (updates.reunioesAgendadas !== undefined) dbUpdates.reunioes_agendadas = updates.reunioesAgendadas;
      if (updates.vendasFechadas !== undefined) dbUpdates.vendas_fechadas = updates.vendasFechadas;
      if (updates.valorVendas !== undefined) dbUpdates.valor_vendas = updates.valorVendas;

      const { error } = await supabase
        .from('dados_trafego' as any)
        .upsert({
          month: monthName,
          ...dbUpdates,
        }, {
          onConflict: 'month'
        });

      if (error) throw error;

      setData(prevData => {
        const newData = [...prevData];
        newData[monthIndex] = calculateMetrics({
          ...newData[monthIndex],
          ...updates,
        });
        return newData;
      });

      toast.success('Dados atualizados!');
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      toast.error('Erro ao salvar dados');
    }
  }, []);

  useEffect(() => {
    loadFromDatabase();

    const channel = supabase
      .channel('growth-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dados_trafego' },
        () => loadFromDatabase()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadFromDatabase]);

  const currentMonthData = data[selectedMonth];

  return {
    data,
    currentMonthData,
    selectedMonth,
    setSelectedMonth,
    isLoading,
    isSyncing,
    syncFromSheets,
    updateManualData,
  };
};
