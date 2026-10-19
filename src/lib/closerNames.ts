import { supabase } from '@/integrations/supabase/client';

/**
 * Lista de closers — quem ATENDE a reunião (o SDR é quem agendou).
 *
 * Fica no mesmo lugar da lista de SDRs (`app_settings`), com a chave
 * `closer_names`, e é editada na tela Reuniões. Começa vazia: quem cadastra
 * os nomes é o Allan.
 */
const CHAVE = 'closer_names';

const limpa = (lista: unknown): string[] =>
  Array.isArray(lista)
    ? Array.from(new Set(lista.map((v) => String(v ?? '').trim()).filter(Boolean)))
    : [];

// app_settings já é usada assim em sdrNames.ts (fora do arquivo de tipos gerado).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const configuracoes = () => (supabase as any).from('app_settings');

export async function buscaClosers(): Promise<string[]> {
  const { data, error } = await configuracoes().select('value').eq('key', CHAVE).maybeSingle();
  if (error) throw error;
  return limpa(data?.value);
}

export async function salvaClosers(nomes: string[]): Promise<string[]> {
  const lista = limpa(nomes);
  const { error } = await configuracoes().upsert({ key: CHAVE, value: lista }, { onConflict: 'key' });
  if (error) throw error;
  return lista;
}
