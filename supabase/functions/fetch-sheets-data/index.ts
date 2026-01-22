import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SHEET_ID = '1eHadRBjkkm7d2yq5-MKDcVtC6naXrz26FVn7OObUejI';

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
    
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      // Handle CSV with quoted fields
      const values = parseCSVLine(lines[i]);
      const row: Record<string, string | number> = {};
      
      headers.forEach((header, index) => {
        const value = values[index] || '';
        // Try to parse as number
        const numValue = parseFloat(value.replace(/[R$,.\s]/g, '').replace(',', '.'));
        row[header] = isNaN(numValue) ? value : numValue;
      });
      
      data.push(row);
    }

    // Agregar dados por mês
    const monthlyData = aggregateByMonth(data);

    return new Response(JSON.stringify({ 
      success: true, 
      data: monthlyData,
      rawCount: data.length
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

function aggregateByMonth(data: Record<string, string | number>[]): Record<string, { investimento: number; impressoes: number; cliques: number; leads: number; cpc: number }> {
  const monthMap: Record<string, {
    investimento: number;
    impressoes: number;
    cliques: number;
    leads: number;
  }> = {};

  // Mapear nomes de colunas possíveis
  const columnMappings = {
    investimento: ['Amount Spent', 'amount_spent', 'Investimento', 'Gasto'],
    impressoes: ['Impressions', 'impressions', 'Impressões'],
    cliques: ['Clicks', 'clicks', 'Link Clicks', 'link_clicks', 'Cliques'],
    leads: ['Leads', 'leads', 'Lead'],
  };

  data.forEach(row => {
    // Tentar extrair mês do dado (pode precisar ajustar baseado na estrutura real)
    // Por enquanto, agregar tudo em um mês genérico ou usar data atual
    const currentMonth = new Date().toLocaleString('pt-BR', { month: 'long' });
    const monthKey = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);

    if (!monthMap[monthKey]) {
      monthMap[monthKey] = { investimento: 0, impressoes: 0, cliques: 0, leads: 0 };
    }

    // Encontrar e somar valores
    Object.entries(columnMappings).forEach(([key, possibleNames]) => {
      possibleNames.forEach(name => {
        if (row[name] !== undefined && typeof row[name] === 'number') {
          monthMap[monthKey][key as keyof typeof monthMap[typeof monthKey]] += row[name] as number;
        }
      });
    });
  });

  // Calcular CPC
  const result: Record<string, { investimento: number; impressoes: number; cliques: number; leads: number; cpc: number }> = {};
  Object.entries(monthMap).forEach(([month, values]) => {
    result[month] = {
      ...values,
      cpc: values.cliques > 0 ? values.investimento / values.cliques : 0,
    };
  });

  return result;
}
