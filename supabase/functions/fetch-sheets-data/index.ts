import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ID da planilha e GID específico da aba "Meta Ads" com dados de campanhas
const SHEET_ID = '1eHadRBjkkm7d2yq5-MKDcVtC6naXrz26FVn7OObUejI';
const SHEET_GID = '2051070694';

interface CampaignData {
  campaignName: string;
  adsetName: string;
  adName: string;
  amountSpent: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  leads: number;
  status: string;
}

function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.toString().replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // URL direta com GID específico - garante que busca a aba correta
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
    
    console.log(`=== BUSCANDO DADOS ===`);
    console.log(`URL: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar planilha: ${response.status} ${response.statusText}`);
    }
    
    const csvText = await response.text();
    const lines = csvText.split('\n').filter(line => line.trim());
    
    console.log(`=== LINHAS ENCONTRADAS: ${lines.length} ===`);
    
    if (lines.length < 2) {
      throw new Error('Planilha vazia ou sem dados');
    }
    
    // Parse headers (primeira linha)
    const headers = parseCSVLine(lines[0]);
    console.log(`=== HEADERS ===`);
    console.log(JSON.stringify(headers.slice(0, 20)));
    
    // Encontrar índices das colunas (flexível para variações de nome)
    const findColumn = (patterns: string[]): number => {
      for (let i = 0; i < headers.length; i++) {
        const h = headers[i].toLowerCase().trim();
        for (const p of patterns) {
          if (h === p || h.includes(p)) {
            return i;
          }
        }
      }
      return -1;
    };
    
    const columnIndices = {
      campaignName: findColumn(['campaign name', 'nome da campanha', 'campanha']),
      adsetName: findColumn(['adset name', 'nome do conjunto', 'conjunto']),
      adName: findColumn(['ad name', 'nome do anúncio', 'anuncio']),
      amountSpent: findColumn(['amount spent', 'gasto', 'investimento', 'spent', 'valor gasto']),
      impressions: findColumn(['impressions', 'impressões', 'impressoes']),
      clicks: findColumn(['clicks', 'cliques']),
      linkClicks: findColumn(['link clicks', 'cliques no link', 'link click']),
      leads: findColumn(['leads', 'lead', 'resultados']),
      status: findColumn(['status', 'estado', 'delivery']),
    };
    
    console.log(`=== ÍNDICES DAS COLUNAS ===`);
    console.log(JSON.stringify(columnIndices));
    
    // Log primeiras linhas de dados para debug
    for (let i = 1; i <= Math.min(5, lines.length - 1); i++) {
      const cols = parseCSVLine(lines[i]);
      const campaignName = columnIndices.campaignName >= 0 ? (cols[columnIndices.campaignName] || '') : '';
      console.log(`Linha ${i}: Campaign="${campaignName.substring(0, 50)}"`);
    }
    
    // Processar dados - filtrar apenas CAPTACAO/CAPTAÇÃO
    const campaigns: CampaignData[] = [];
    const allCampaigns: CampaignData[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      
      const campaign: CampaignData = {
        campaignName: columnIndices.campaignName >= 0 ? (cols[columnIndices.campaignName] || '') : '',
        adsetName: columnIndices.adsetName >= 0 ? (cols[columnIndices.adsetName] || '') : '',
        adName: columnIndices.adName >= 0 ? (cols[columnIndices.adName] || '') : '',
        amountSpent: columnIndices.amountSpent >= 0 ? parseNumber(cols[columnIndices.amountSpent]) : 0,
        impressions: columnIndices.impressions >= 0 ? parseNumber(cols[columnIndices.impressions]) : 0,
        clicks: columnIndices.clicks >= 0 ? parseNumber(cols[columnIndices.clicks]) : 0,
        linkClicks: columnIndices.linkClicks >= 0 ? parseNumber(cols[columnIndices.linkClicks]) : 0,
        leads: columnIndices.leads >= 0 ? parseNumber(cols[columnIndices.leads]) : 0,
        status: columnIndices.status >= 0 ? (cols[columnIndices.status] || 'active') : 'active',
      };
      
      allCampaigns.push(campaign);
      
      // Filtrar CAPTACAO (case-insensitive)
      const campaignUpper = campaign.campaignName.toUpperCase();
      if (campaignUpper.includes('CAPTACAO') || campaignUpper.includes('CAPTAÇÃO')) {
        campaigns.push(campaign);
      }
    }
    
    console.log(`=== RESULTADO: ${campaigns.length} campanhas CAPTACAO de ${lines.length - 1} linhas ===`);
    
    // Se não encontrou campanhas CAPTACAO, retornar todas (para debug)
    const finalCampaigns = campaigns.length > 0 ? campaigns : allCampaigns;
    if (campaigns.length === 0) {
      console.log('Nenhuma campanha CAPTACAO encontrada, retornando todas...');
    }
    
    // Calcular totais
    const totals = finalCampaigns.reduce((acc, c) => ({
      investimento: acc.investimento + c.amountSpent,
      impressoes: acc.impressoes + c.impressions,
      cliques: acc.cliques + c.clicks,
      linkClicks: acc.linkClicks + c.linkClicks,
      leads: acc.leads + c.leads,
    }), { investimento: 0, impressoes: 0, cliques: 0, linkClicks: 0, leads: 0 });
    
    // Calcular métricas
    const cpc = totals.cliques > 0 ? totals.investimento / totals.cliques : 0;
    const cpl = totals.leads > 0 ? totals.investimento / totals.leads : 0;
    
    console.log(`=== TOTAIS ===`);
    console.log(JSON.stringify({ ...totals, cpc, cpl }));
    
    // Filtros disponíveis
    const uniqueCampaigns = [...new Set(finalCampaigns.map(c => c.campaignName).filter(Boolean))];
    const uniqueAdsets = [...new Set(finalCampaigns.map(c => c.adsetName).filter(Boolean))];
    const uniqueAds = [...new Set(finalCampaigns.map(c => c.adName).filter(Boolean))];
    
    return new Response(
      JSON.stringify({
        success: true,
        campaigns: finalCampaigns,
        totals: { ...totals, cpc, cpl },
        filters: {
          campaigns: uniqueCampaigns,
          adsets: uniqueAdsets,
          ads: uniqueAds,
        },
        count: finalCampaigns.length,
        debug: {
          totalLines: lines.length,
          captacaoCount: campaigns.length,
          allCampaignsCount: allCampaigns.length,
          headers: headers.slice(0, 15),
          indices: columnIndices,
          gid: SHEET_GID,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Erro:', errorMessage);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        campaigns: [],
        totals: { investimento: 0, impressoes: 0, cliques: 0, linkClicks: 0, leads: 0, cpc: 0, cpl: 0 }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
