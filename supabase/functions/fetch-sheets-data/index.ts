import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SHEET_ID = '1eHadRBjkkm7d2yq5-MKDcVtC6naXrz26FVn7OObUejI';

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Buscar dados da planilha pública via CSV export
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
    
    const response = await fetch(csvUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch sheet: ${response.status}`);
    }

    const csvText = await response.text();
    
    // Parse CSV
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    console.log('Headers encontrados:', headers);
    
    // Mapear índices das colunas
    const columnIndexes = {
      campaignName: headers.findIndex(h => h.toLowerCase().includes('campaign') && h.toLowerCase().includes('name')),
      adsetName: headers.findIndex(h => h.toLowerCase().includes('adset') && h.toLowerCase().includes('name')),
      adName: headers.findIndex(h => h.toLowerCase().includes('ad') && h.toLowerCase().includes('name') && !h.toLowerCase().includes('campaign') && !h.toLowerCase().includes('adset')),
      amountSpent: headers.findIndex(h => h.toLowerCase().includes('amount') && h.toLowerCase().includes('spent')),
      impressions: headers.findIndex(h => h.toLowerCase() === 'impressions'),
      clicks: headers.findIndex(h => h.toLowerCase() === 'clicks'),
      linkClicks: headers.findIndex(h => h.toLowerCase().includes('link') && h.toLowerCase().includes('click')),
      leads: headers.findIndex(h => h.toLowerCase() === 'leads'),
      status: headers.findIndex(h => h.toLowerCase() === 'status'),
    };
    
    console.log('Índices das colunas:', columnIndexes);

    const allCampaigns: CampaignData[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = parseCSVLine(lines[i]);
      
      const campaignName = values[columnIndexes.campaignName] || '';
      
      // FILTRAR APENAS CAMPANHAS COM "CAPTACAO"
      if (!campaignName.toUpperCase().includes('CAPTACAO')) {
        continue;
      }
      
      const campaign: CampaignData = {
        campaignName: campaignName,
        adsetName: values[columnIndexes.adsetName] || '',
        adName: values[columnIndexes.adName] || '',
        amountSpent: parseNumber(values[columnIndexes.amountSpent]),
        impressions: parseNumber(values[columnIndexes.impressions]),
        clicks: parseNumber(values[columnIndexes.clicks]),
        linkClicks: parseNumber(values[columnIndexes.linkClicks]),
        leads: parseNumber(values[columnIndexes.leads]),
        status: values[columnIndexes.status] || '',
      };
      
      allCampaigns.push(campaign);
    }

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

    // Extrair listas únicas para filtros
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
      count: allCampaigns.length
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
  if (!value) return 0;
  // Remove currency symbols, spaces, and handle comma as decimal separator
  const cleaned = value.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
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
