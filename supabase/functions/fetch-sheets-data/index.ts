import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SHEET_ID = '1eHadRBjkkm7d2yq5-MKDcVtC6naXrz26FVn7OObUejI';

// Tentar estas abas em ordem
const SHEET_NAMES = ['Ads', 'Meta Ads', 'Facebook Ads', 'ads', 'ADS'];

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

async function fetchSheetByName(sheetName: string): Promise<string | null> {
  try {
    // Usar gviz API para buscar por nome da aba
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    console.log(`Tentando aba: ${sheetName}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`Aba ${sheetName} não encontrada: ${response.status}`);
      return null;
    }
    
    const text = await response.text();
    
    // Verificar se retornou erro
    if (text.includes('Error') || text.length < 100) {
      console.log(`Aba ${sheetName} retornou erro ou vazia`);
      return null;
    }
    
    return text;
  } catch (e) {
    console.log(`Erro ao buscar aba ${sheetName}:`, e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let csvText: string | null = null;
    let usedSheet = '';

    // Tentar cada nome de aba
    for (const sheetName of SHEET_NAMES) {
      csvText = await fetchSheetByName(sheetName);
      if (csvText && csvText.length > 100) {
        usedSheet = sheetName;
        console.log(`=== USANDO ABA: ${sheetName} ===`);
        break;
      }
    }

    if (!csvText) {
      // Fallback para exportação padrão
      console.log('Nenhuma aba específica encontrada, usando padrão');
      const defaultUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
      const response = await fetch(defaultUrl);
      csvText = await response.text();
      usedSheet = 'default';
    }

    const lines = csvText.split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0]);
    
    console.log('=== HEADERS ===');
    console.log(JSON.stringify(headers.slice(0, 20)));

    // Mapeamento flexível de colunas
    const findColumn = (patterns: string[]): number => {
      for (let i = 0; i < headers.length; i++) {
        const h = headers[i].toLowerCase().trim();
        for (const p of patterns) {
          if (h === p || h.includes(p)) {
            console.log(`Coluna "${patterns[0]}" encontrada: índice ${i} (${headers[i]})`);
            return i;
          }
        }
      }
      return -1;
    };

    const columnIndexes = {
      campaignName: findColumn(['campaign name', 'nome da campanha', 'campanha']),
      adsetName: findColumn(['adset name', 'nome do conjunto', 'conjunto de anúncios']),
      adName: findColumn(['ad name', 'nome do anúncio']),
      amountSpent: findColumn(['amount spent', 'valor gasto', 'gasto', 'investimento']),
      impressions: findColumn(['impressions', 'impressões']),
      clicks: findColumn(['clicks', 'cliques']),
      linkClicks: findColumn(['link clicks', 'cliques no link']),
      leads: findColumn(['leads']),
      status: findColumn(['status']),
    };
    
    console.log('=== ÍNDICES ===');
    console.log(JSON.stringify(columnIndexes));

    const allCampaigns: CampaignData[] = [];
    let captacaoCount = 0;
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = parseCSVLine(lines[i]);
      
      // Pegar campaign name
      let campaignName = '';
      if (columnIndexes.campaignName >= 0) {
        campaignName = (values[columnIndexes.campaignName] || '').trim();
      }
      
      if (i <= 3) {
        console.log(`Linha ${i}: "${campaignName.substring(0, 50)}"`);
      }
      
      // FILTRAR CAPTACAO
      const upper = campaignName.toUpperCase();
      if (!upper.includes('CAPTACAO') && !upper.includes('CAPTAÇÃO')) {
        continue;
      }
      
      captacaoCount++;
      
      allCampaigns.push({
        campaignName,
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

    console.log(`=== RESULTADO: ${captacaoCount} campanhas CAPTACAO ===`);

    // Agregar totais
    const totals = {
      investimento: allCampaigns.reduce((sum, c) => sum + c.amountSpent, 0),
      impressoes: allCampaigns.reduce((sum, c) => sum + c.impressions, 0),
      cliques: allCampaigns.reduce((sum, c) => sum + c.clicks, 0),
      linkClicks: allCampaigns.reduce((sum, c) => sum + c.linkClicks, 0),
      leads: allCampaigns.reduce((sum, c) => sum + c.leads, 0),
      cpc: 0,
      cpl: 0,
    };
    
    totals.cpc = totals.cliques > 0 ? totals.investimento / totals.cliques : 0;
    totals.cpl = totals.leads > 0 ? totals.investimento / totals.leads : 0;

    console.log('=== TOTAIS ===');
    console.log(JSON.stringify(totals));

    const uniqueCampaigns = [...new Set(allCampaigns.map(c => c.campaignName))].filter(Boolean);
    const uniqueAdsets = [...new Set(allCampaigns.map(c => c.adsetName))].filter(Boolean);
    const uniqueStatuses = [...new Set(allCampaigns.map(c => c.status))].filter(Boolean);

    return new Response(JSON.stringify({ 
      success: true, 
      campaigns: allCampaigns,
      totals,
      filters: {
        campaigns: uniqueCampaigns,
        adsets: uniqueAdsets,
        statuses: uniqueStatuses,
      },
      count: allCampaigns.length,
      debug: {
        headers: headers.slice(0, 20),
        columnIndexes,
        usedSheet,
        totalRows: lines.length - 1,
        captacaoCount
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error:', errorMessage);
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
