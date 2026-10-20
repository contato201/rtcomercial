import { supabase } from '@/integrations/supabase/client';

/**
 * Funis de tráfego pago cadastrados em Growth › Orçamento por Funil.
 * Mesma fonte usada para casar investimento da Meta com o nome da campanha,
 * então o funil marcado na 2ª reunião bate com o funil que recebeu a verba.
 */
export const fetchFunis = async (): Promise<string[]> => {
  const { data, error } = await (supabase as any)
    .from('orcamento_funil')
    .select('funil')
    .order('funil');

  if (error) {
    console.error('Erro ao carregar funis:', error);
    return [];
  }

  const nomes = ((data as { funil: string }[]) ?? [])
    .map((r) => (r.funil ?? '').trim().toUpperCase())
    .filter(Boolean);

  return Array.from(new Set(nomes));
};
