import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SHEET_ID = '1eHadRBjkkm7d2yq5-MKDcVtC6naXrz26FVn7OObUejI';

// Tentar diferentes abas comuns
const POSSIBLE_SHEETS = [
  'Ads',
  'ads', 
  'Campanhas',
  'campanhas',
  'Meta Ads',
  'Facebook Ads',
  'Dados',
  'Sheet1',
  'Sheet2',
  'Planilha1',
  'Planilha2',
];

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

async function fetchSheetData(sheetName?: string): Promise<{ headers: string[], lines: string[] } | null> {
  try {
    // gid=0 é a primeira aba, podemos tentar exportar por nome
    let csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
    if (sheetName) {
      csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    }
    
    const response = await fetch(csvUrl);
    if (!response.ok) return null;
    
    const csvText = await response.text();
    const lines = csvText.split('\n').filter(l => l.trim());
    if (lines.length < 2) return null;
    
    const headers = parseCSVLine(lines[0]);
    return { headers, lines };
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let data: { headers: string[], lines: string[] } | null = null;
    let usedSheet = 'default';

    // Primeiro tentar a aba padrão
    data = await fetchSheetData();
    
    // Se os headers não parecem ser de campanhas, tentar outras abas
    if (data) {
      const hasAdsColumns = data.headers.some(h => 
        h.toLowerCase().includes('campaign') || 
        h.toLowerCase().includes('amount') ||
        h.toLowerCase().includes('impressions')
      );
      
      if (!hasAdsColumns) {
        console.log('Aba padrão não contém dados de Ads, tentando outras abas...');
        
        for (const sheetName of POSSIBLE_SHEETS) {
          const sheetData = await fetchSheetData(sheetName);
          if (sheetData) {
            const hasColumns = sheetData.headers.some(h => 
              h.toLowerCase().includes('campaign') || 
              h.toLowerCase().includes('amount') ||
              h.toLowerCase().includes('impressions')
            );
            if (hasColumns) {
              data = sheetData;
              usedSheet = sheetName;
              console.log(`Usando aba: ${sheetName}`);
              break;
            }
          }
        }
      }
    }

    if (!data) {
      throw new Error('Não foi possível acessar a planilha');
    }

    const { headers, lines } = data;
    
    console.log('=== HEADERS ENCONTRADOS ===');
    console.log(JSON.stringify(headers.slice(0, 15)));

    // Mapear índices - mais flexível
    const findColumn = (patterns: string[]): number => {
      return headers.findIndex(h => {
        const lower = h.toLowerCase().trim();
        return patterns.some(p => lower.includes(p));
      });
    };

    const columnIndexes = {
      campaignName: findColumn(['campaign name', 'campaign_name', 'campanha', 'nome da campanha']),
      adsetName: findColumn(['adset name', 'adset_name', 'conjunto', 'nome do conjunto']),
      adName: findColumn(['ad name', 'ad_name', 'anuncio', 'anúncio', 'nome do anúncio']),
      amountSpent: findColumn(['amount spent', 'amount_spent', 'gasto', 'valor gasto']),
      impressions: findColumn(['impressions', 'impressões', 'impressoes']),
      clicks: findColumn(['clicks', 'cliques']),
      linkClicks: findColumn(['link clicks', 'link_clicks', 'cliques no link']),
      leads: findColumn(['leads', 'lead']),
      status: findColumn(['status']),
    };
    
    console.log('=== ÍNDICES DAS COLUNAS ===');
    console.log(JSON.stringify(columnIndexes));

    // Se não achou Campaign Name, usar primeira coluna de texto significativa
    if (columnIndexes.campaignName === -1) {
      // Procurar primeira coluna que parece ter nomes de campanhas
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i].toLowerCase();
        if (header.includes('name') || header.includes('nome') || header.includes('campaign') || header.includes('campanha')) {
          columnIndexes.campaignName = i;
          break;
        }
      }
      if (columnIndexes.campaignName === -1) {
        columnIndexes.campaignName = 0;
      }
      console.log(`Campaign Name fallback para coluna ${columnIndexes.campaignName}`);
    }

    const allCampaigns: CampaignData[] = [];
    let captacaoCount = 0;
    let totalRows = 0;
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      totalRows++;
      
      const values = parseCSVLine(lines[i]);
      const campaignName = (values[columnIndexes.campaignName] || '').trim();
      
      // Log das primeiras linhas para debug
      if (i <= 5) {
        console.log(`Linha ${i}: Campaign="${campaignName.substring(0, 60)}"`);
      }
      
      // FILTRAR APENAS CAMPANHAS COM "CAPTACAO" ou "CAPTAÇÃO"
      const upperName = campaignName.toUpperCase();
      if (!upperName.includes('CAPTACAO') && !upperName.includes('CAPTAÇÃO')) {
        continue;
      }
      
      captacaoCount++;
      
      const campaign: CampaignData = {
        campaignName: campaignName,
        adsetName: columnIndexes.adsetName >= 0 ? (values[columnIndexes.adsetName] || '').trim() : '',
        adName: columnIndexes.adName >= 0 ? (values[columnIndexes.adName] || '').trim() : '',
        amountSpent: parseNumber(values[columnIndexes.amountSpent]),
        impressions: parseNumber(values[columnIndexes.impressions]),
        clicks: parseNumber(values[columnIndexes.clicks]),
        linkClicks: parseNumber(values[columnIndexes.linkClicks]),
        leads: parseNumber(values[columnIndexes.leads]),
        status: columnIndexes.status >= 0 ? (values[columnIndexes.status] || '').trim() : '',
      };
      
      allCampaigns.push(campaign);
    }

    console.log(`=== RESULTADO: ${captacaoCount} campanhas de CAPTAÇÃO de ${totalRows} linhas (aba: ${usedSheet}) ===`);

    // Se não encontrou campanhas com CAPTACAO, retornar todas (limitado)
    let finalCampaigns = allCampaigns;
    if (allCampaigns.length === 0 && totalRows > 0) {
      console.log('Nenhuma campanha CAPTACAO, retornando primeiras 50 linhas...');
      for (let i = 1; i < Math.min(lines.length, 51); i++) {
        if (!lines[i].trim()) continue;
        const values = parseCSVLine(lines[i]);
        
        finalCampaigns.push({
          campaignName: columnIndexes.campaignName >= 0 ? (values[columnIndexes.campaignName] || '').trim() : (values[0] || '').trim(),
          adsetName: columnIndexes.adsetName >= 0 ? (values[columnIndexes.adsetName] || '').trim() : '',
          adName: columnIndexes.adName >= 0 ? (values[columnIndexes.adName] || '').trim() : '',
          amountSpent: parseNumber(values[columnIndexes.amountSpent]),
          impressions: parseNumber(values[columnIndexes.impressions]),
          clicks: parseNumber(values[columnIndexes.clicks]),
          linkClicks: parseNumber(values[columnIndexes.linkClicks]),
          leads: parseNumber(values[columnIndexes.leads]),
          status: columnIndexes.status >= 0 ? (values[columnIndexes.status] || '').trim() : '',
        });
      }
    }

    // Agregar totais
    const totals = {
      investimento: finalCampaigns.reduce((sum, c) => sum + c.amountSpent, 0),
      impressoes: finalCampaigns.reduce((sum, c) => sum + c.impressions, 0),
      cliques: finalCampaigns.reduce((sum, c) => sum + c.clicks, 0),
      linkClicks: finalCampaigns.reduce((sum, c) => sum + c.linkClicks, 0),
      leads: finalCampaigns.reduce((sum, c) => sum + c.leads, 0),
      cpc: 0,
      cpl: 0,
    };
    
    totals.cpc = totals.cliques > 0 ? totals.investimento / totals.cliques : 0;
    totals.cpl = totals.leads > 0 ? totals.investimento / totals.leads : 0;

    console.log('=== TOTAIS ===');
    console.log(JSON.stringify(totals));

    // Extrair listas únicas para filtros
    const uniqueCampaigns = [...new Set(finalCampaigns.map(c => c.campaignName))].filter(Boolean);
    const uniqueAdsets = [...new Set(finalCampaigns.map(c => c.adsetName))].filter(Boolean);
    const uniqueStatuses = [...new Set(finalCampaigns.map(c => c.status))].filter(Boolean);

    return new Response(JSON.stringify({ 
      success: true, 
      campaigns: finalCampaigns,
      totals,
      filters: {
        campaigns: uniqueCampaigns,
        adsets: uniqueAdsets,
        statuses: uniqueStatuses,
      },
      count: finalCampaigns.length,
      debug: {
        headers: headers.slice(0, 15),
        columnIndexes,
        totalRows,
        captacaoCount,
        usedSheet
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error fetching sheets data:', errorMessage);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function parseNumber(value: string | undefined): number {
  if (!value || value === undefined) return 0;
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
