import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[çÇ]/g, 'c')
    .toUpperCase();
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

// Parse date string and return month (0-11) or -1 if invalid
function getMonthFromDate(dateStr: string): number {
  if (!dateStr || !dateStr.trim()) return -1;
  
  // Try common date formats
  const trimmed = dateStr.trim();
  
  // MM/DD/YYYY or DD/MM/YYYY
  const slashParts = trimmed.split('/');
  if (slashParts.length === 3) {
    // Assume MM/DD/YYYY (common in US/Sheets)
    const month = parseInt(slashParts[0], 10);
    if (month >= 1 && month <= 12) {
      return month - 1;
    }
  }
  
  // YYYY-MM-DD
  const dashParts = trimmed.split('-');
  if (dashParts.length === 3 && dashParts[0].length === 4) {
    const month = parseInt(dashParts[1], 10);
    if (month >= 1 && month <= 12) {
      return month - 1;
    }
  }
  
  // Try native Date parse as fallback
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.getMonth();
  }
  
  return -1;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Missing authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace('Bearer ', '');
  const { data, error: authError } = await supabaseClient.auth.getClaims(token);

  if (authError || !data?.claims) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const userEmail = data.claims.email;
  if (userEmail !== 'contato@allancatao.com.br') {
    return new Response(
      JSON.stringify({ error: 'Forbidden - Only authorized users can access this data' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Parse optional month filter from query params (0-11)
  const url = new URL(req.url);
  const monthParam = url.searchParams.get('month');
  const filterMonth = monthParam !== null ? parseInt(monthParam, 10) : null;

  try {
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
    
    console.log(`=== BUSCANDO DADOS ===`);
    console.log(`URL: ${sheetUrl}`);
    console.log(`User: ${userEmail}`);
    console.log(`Filtro mês: ${filterMonth !== null ? filterMonth : 'TODOS'}`);
    
    const response = await fetch(sheetUrl);
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar planilha: ${response.status} ${response.statusText}`);
    }
    
    const csvText = await response.text();
    const lines = csvText.split('\n').filter(line => line.trim());
    
    console.log(`=== LINHAS ENCONTRADAS: ${lines.length} ===`);
    
    if (lines.length < 2) {
      throw new Error('Planilha vazia ou sem dados');
    }
    
    const headers = parseCSVLine(lines[0]);
    console.log(`=== HEADERS ===`);
    console.log(JSON.stringify(headers.slice(0, 20)));
    
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
    
    const dateIndex = findColumn(['date', 'data', 'dia']);
    const columnIndices = {
      date: dateIndex,
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
    
    // Processar dados
    const campaigns: CampaignData[] = [];
    // Acumulador por mês para totais mensais
    const monthlyTotals: Record<number, { investimento: number; impressoes: number; cliques: number; linkClicks: number; leads: number }> = {};
    
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      
      const campaignName = columnIndices.campaignName >= 0 ? (cols[columnIndices.campaignName] || '') : '';
      
      // Incluir todas as campanhas (sem filtro de CAPTACAO)
      
      // Parse date to get month
      const dateStr = dateIndex >= 0 ? (cols[dateIndex] || '') : '';
      const rowMonth = getMonthFromDate(dateStr);
      
      const campaign: CampaignData = {
        campaignName,
        adsetName: columnIndices.adsetName >= 0 ? (cols[columnIndices.adsetName] || '') : '',
        adName: columnIndices.adName >= 0 ? (cols[columnIndices.adName] || '') : '',
        amountSpent: columnIndices.amountSpent >= 0 ? parseNumber(cols[columnIndices.amountSpent]) : 0,
        impressions: columnIndices.impressions >= 0 ? parseNumber(cols[columnIndices.impressions]) : 0,
        clicks: columnIndices.clicks >= 0 ? parseNumber(cols[columnIndices.clicks]) : 0,
        linkClicks: columnIndices.linkClicks >= 0 ? parseNumber(cols[columnIndices.linkClicks]) : 0,
        leads: columnIndices.leads >= 0 ? parseNumber(cols[columnIndices.leads]) : 0,
        status: columnIndices.status >= 0 ? (cols[columnIndices.status] || 'active') : 'active',
      };
      
      // Acumular totais por mês (para o acumulado geral)
      if (rowMonth >= 0) {
        if (!monthlyTotals[rowMonth]) {
          monthlyTotals[rowMonth] = { investimento: 0, impressoes: 0, cliques: 0, linkClicks: 0, leads: 0 };
        }
        monthlyTotals[rowMonth].investimento += campaign.amountSpent;
        monthlyTotals[rowMonth].impressoes += campaign.impressions;
        monthlyTotals[rowMonth].cliques += campaign.clicks;
        monthlyTotals[rowMonth].linkClicks += campaign.linkClicks;
        monthlyTotals[rowMonth].leads += campaign.leads;
      }
      
      // Se há filtro de mês, só incluir campanhas desse mês
      if (filterMonth !== null) {
        if (rowMonth !== filterMonth) continue;
      }
      
      campaigns.push(campaign);
    }
    
    console.log(`=== RESULTADO: ${campaigns.length} campanhas TODAS ${filterMonth !== null ? `do mês ${filterMonth}` : 'TOTAL'} ===`);
    console.log(`=== MESES ENCONTRADOS: ${Object.keys(monthlyTotals).join(', ')} ===`);
    
    // Calcular totais do mês filtrado
    const totals = campaigns.reduce((acc, c) => ({
      investimento: acc.investimento + c.amountSpent,
      impressoes: acc.impressoes + c.impressions,
      cliques: acc.cliques + c.clicks,
      linkClicks: acc.linkClicks + c.linkClicks,
      leads: acc.leads + c.leads,
    }), { investimento: 0, impressoes: 0, cliques: 0, linkClicks: 0, leads: 0 });
    
    const cpc = totals.cliques > 0 ? totals.investimento / totals.cliques : 0;
    const cpl = totals.leads > 0 ? totals.investimento / totals.leads : 0;
    
    // Calcular investimento acumulado (todos os meses até o mês filtrado ou todos)
    let investimentoAcumulado = 0;
    const maxMonth = filterMonth !== null ? filterMonth : 11;
    for (let m = 0; m <= maxMonth; m++) {
      if (monthlyTotals[m]) {
        investimentoAcumulado += monthlyTotals[m].investimento;
      }
    }
    
    console.log(`=== TOTAIS MÊS ===`);
    console.log(JSON.stringify({ ...totals, cpc, cpl }));
    console.log(`=== INVESTIMENTO ACUMULADO: ${investimentoAcumulado} ===`);
    
    // Filtros disponíveis
    const uniqueCampaigns = [...new Set(campaigns.map(c => c.campaignName).filter(Boolean))];
    const uniqueAdsets = [...new Set(campaigns.map(c => c.adsetName).filter(Boolean))];
    const uniqueStatuses = [...new Set(campaigns.map(c => c.status).filter(Boolean))];
    
    return new Response(
      JSON.stringify({
        success: true,
        campaigns,
        totals: { ...totals, cpc, cpl },
        investimentoAcumulado,
        monthlyTotals,
        filters: {
          campaigns: uniqueCampaigns,
          adsets: uniqueAdsets,
          statuses: uniqueStatuses,
        },
        count: campaigns.length,
        debug: {
          totalLines: lines.length,
          captacaoCount: campaigns.length,
          headers: headers.slice(0, 15),
          indices: columnIndices,
          gid: SHEET_GID,
          filterMonth,
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
        totals: { investimento: 0, impressoes: 0, cliques: 0, linkClicks: 0, leads: 0, cpc: 0, cpl: 0 },
        investimentoAcumulado: 0,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
