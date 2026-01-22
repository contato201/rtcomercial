import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  GrowthData, 
  CampaignData, 
  GrowthFilters, 
  ActiveFilters, 
  MONTHS, 
  createEmptyGrowthData, 
  calculateMetrics 
} from '@/types/growth';
import { toast } from 'sonner';

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
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [availableFilters, setAvailableFilters] = useState<GrowthFilters>({
    campaigns: [],
    adsets: [],
    statuses: [],
  });
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({
    campaign: null,
    adset: null,
    status: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const hasAutoSynced = useRef(false);

  // Campanhas filtradas
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      if (activeFilters.campaign && c.campaignName !== activeFilters.campaign) return false;
      if (activeFilters.adset && c.adsetName !== activeFilters.adset) return false;
      if (activeFilters.status && c.status !== activeFilters.status) return false;
      return true;
    });
  }, [campaigns, activeFilters]);

  // Totais filtrados
  const filteredTotals = useMemo(() => {
    const totals = {
      investimento: filteredCampaigns.reduce((sum, c) => sum + c.amountSpent, 0),
      impressoes: filteredCampaigns.reduce((sum, c) => sum + c.impressions, 0),
      cliques: filteredCampaigns.reduce((sum, c) => sum + c.clicks, 0),
      linkClicks: filteredCampaigns.reduce((sum, c) => sum + c.linkClicks, 0),
      leads: filteredCampaigns.reduce((sum, c) => sum + c.leads, 0),
      cpc: 0,
      cpl: 0,
    };
    totals.cpc = totals.cliques > 0 ? totals.investimento / totals.cliques : 0;
    totals.cpl = totals.leads > 0 ? totals.investimento / totals.leads : 0;
    return totals;
  }, [filteredCampaigns]);

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

      if (response?.success) {
        setCampaigns(response.campaigns || []);
        setAvailableFilters(response.filters || { campaigns: [], adsets: [], statuses: [] });
        
        // Salvar totais no banco para o mês atual
        const monthName = MONTHS[selectedMonth];
        const totals = response.totals;
        
        const { error: upsertError } = await supabase
          .from('dados_trafego' as any)
          .upsert({
            month: monthName,
            investimento: totals.investimento || 0,
            impressoes: totals.impressoes || 0,
            cliques: totals.cliques || 0,
            cpc: totals.cpc || 0,
            leads_total: totals.leads || 0,
          }, {
            onConflict: 'month'
          });

        if (upsertError) {
          console.error('Erro ao salvar dados:', upsertError);
        }

        await loadFromDatabase();
        setLastSyncTime(new Date());
        toast.success(`${response.count} campanhas de CAPTAÇÃO carregadas!`);
      }
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
      toast.error('Erro ao sincronizar dados do Sheets');
    } finally {
      setIsSyncing(false);
    }
  }, [loadFromDatabase, selectedMonth]);

  const updateManualData = useCallback(async (
    monthIndex: number,
    updates: Partial<Pick<GrowthData, 'leadsQualificados' | 'reunioesAgendadas' | 'vendasFechadas' | 'valorVendas'>>
  ): Promise<void> => {
    const monthName = MONTHS[monthIndex];
    
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

    if (error) {
      console.error('Erro ao atualizar:', error);
      throw new Error('Erro ao salvar dados');
    }

    setData(prevData => {
      const newData = [...prevData];
      newData[monthIndex] = calculateMetrics({
        ...newData[monthIndex],
        ...updates,
      });
      return newData;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setActiveFilters({ campaign: null, adset: null, status: null });
  }, []);

  // Load from database on mount
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

  // Auto-sync from Google Sheets on mount (only if authenticated)
  useEffect(() => {
    // Skip if already auto-synced
    if (hasAutoSynced.current) return;
    
    let mounted = true;
    
    const autoSync = async () => {
      // Check if user is authenticated before auto-syncing
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session && mounted) {
        hasAutoSynced.current = true;
        console.log('Auto-syncing from Google Sheets...');
        syncFromSheets();
      }
    };

    // Small delay to ensure component is fully mounted
    const timeoutId = setTimeout(autoSync, 500);
    
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [syncFromSheets]);

  const currentMonthData = useMemo(() => {
    const baseData = data[selectedMonth];
    // Sobrescrever com dados do Sheets se houver sync
    if (lastSyncTime && campaigns.length > 0) {
      // Usar totais filtrados se houver filtros ativos, senão usar todos
      const hasActiveFilters = activeFilters.campaign || activeFilters.adset || activeFilters.status;
      const totalsToUse = hasActiveFilters ? filteredTotals : {
        investimento: campaigns.reduce((sum, c) => sum + c.amountSpent, 0),
        impressoes: campaigns.reduce((sum, c) => sum + c.impressions, 0),
        cliques: campaigns.reduce((sum, c) => sum + c.clicks, 0),
        leads: campaigns.reduce((sum, c) => sum + c.leads, 0),
        cpc: 0,
        cpl: 0,
      };
      totalsToUse.cpc = totalsToUse.cliques > 0 ? totalsToUse.investimento / totalsToUse.cliques : 0;
      totalsToUse.cpl = totalsToUse.leads > 0 ? totalsToUse.investimento / totalsToUse.leads : 0;
      
      return calculateMetrics({
        ...baseData,
        investimento: totalsToUse.investimento,
        impressoes: totalsToUse.impressoes,
        cliques: totalsToUse.cliques,
        cpc: totalsToUse.cpc,
        leadsTotal: totalsToUse.leads,
      });
    }
    return baseData;
  }, [data, selectedMonth, lastSyncTime, campaigns, activeFilters, filteredTotals]);

  // Indica se já houve sincronização (para distinguir "sem dados" de "zerado")
  const hasData = lastSyncTime !== null;

  return {
    data,
    currentMonthData,
    campaigns,
    filteredCampaigns,
    filteredTotals,
    availableFilters,
    activeFilters,
    setActiveFilters,
    clearFilters,
    selectedMonth,
    setSelectedMonth,
    isLoading,
    isSyncing,
    lastSyncTime,
    hasData,
    syncFromSheets,
    updateManualData,
  };
};
