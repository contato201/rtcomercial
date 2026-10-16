import { supabase } from '@/integrations/supabase/client';

/**
 * RT Meet — tudo que o site precisa saber sobre as salas de reunião.
 *
 * Quem fala com o banco é a edge function `sala-token` (o porteiro). O site
 * nunca lê a tabela `reunioes_salas` direto quando é visitante; a equipe
 * logada lê pelo Supabase normal, protegida pelas políticas de RLS.
 */

export type StatusSala = 'agendada' | 'ao_vivo' | 'encerrada' | 'cancelada';
export type PapelSala = 'anfitriao' | 'observador' | 'lead';

/** Uma reunião como a equipe vê (tabela completa). */
export interface Sala {
  id: string;
  slug: string;
  titulo: string;
  lead_nome: string;
  lead_email: string;
  sdr: string;
  origem: string | null;
  inicio: string;
  duracao_min: number;
  status: StatusSala;
  gravar: boolean;
  entrou_em: string | null;
  encerrada_em: string | null;
  lead_entrou: boolean;
  observacoes: string | null;
  created_at: string;
}

/** Uma reunião como o lead vê: só o necessário para ele se reconhecer. */
export interface SalaDoLead {
  slug: string;
  titulo: string;
  inicio: string;
  duracao_min: number;
  com: string;
  aberta: boolean;
}

/** O crachá devolvido pelo porteiro, já pronto para abrir a sala. */
export interface Cracha {
  token: string;
  url: string;
  papel: PapelSala;
  sala: {
    slug: string;
    titulo: string;
    inicio: string;
    lead_nome: string;
    sdr: string;
    origem: string | null;
    gravar: boolean;
  };
}

/**
 * A tabela é nova e o arquivo de tipos do Supabase é gerado automaticamente
 * (não se edita à mão). Até ele ser regerado, o acesso tipado fica concentrado
 * aqui — é o único lugar do projeto que precisa desse desvio.
 */
const tabela = () => (supabase as unknown as {
  from: (nome: string) => ReturnType<typeof supabase.from>;
}).from('reunioes_salas');

/** Mensagens de erro do porteiro, em português de gente. */
const RECADOS: Record<string, string> = {
  email_invalido: 'Esse e-mail não parece certo. Confira e tente de novo.',
  email_nao_confere: 'Não encontramos reunião marcada para esse e-mail.',
  sala_nao_encontrada: 'Esse link de reunião não existe mais.',
  sala_cancelada: 'Essa reunião foi cancelada.',
  sala_encerrada: 'Essa reunião já foi encerrada.',
  fora_do_horario: 'A sala abre 30 minutos antes do horário marcado.',
  livekit_nao_configurado: 'A sala de vídeo ainda não foi configurada. Avise a equipe.',
  nao_autorizado: 'Você precisa estar logado para fazer isso.',
};

export const recado = (erro?: string) =>
  (erro && RECADOS[erro]) || 'Não consegui agora. Tente de novo em instantes.';

async function chamaPorteiro<T>(corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('sala-token', { body: corpo });
  if (error) {
    // A função devolve o motivo no corpo mesmo quando o status não é 200.
    const detalhe = (error as { context?: { body?: unknown } }).context?.body;
    let erro: string | undefined;
    try {
      erro = typeof detalhe === 'string' ? JSON.parse(detalhe)?.erro : (detalhe as { erro?: string })?.erro;
    } catch {
      erro = undefined;
    }
    throw new Error(recado(erro));
  }
  if (!data?.ok) throw new Error(recado(data?.erro));
  return data as T;
}

/** O lead digita o e-mail e descobre quais reuniões tem marcadas. */
export async function buscaReunioesPorEmail(email: string): Promise<SalaDoLead[]> {
  const r = await chamaPorteiro<{ salas: SalaDoLead[] }>({ acao: 'buscar', email });
  return r.salas ?? [];
}

/** Pede o crachá para entrar numa sala. */
export async function pedeCracha(opts: {
  slug: string;
  email?: string;
  nome?: string;
  papel?: 'anfitriao' | 'observador';
}): Promise<Cracha> {
  return chamaPorteiro<Cracha>({ acao: 'entrar', ...opts });
}

/** Encerra a reunião (só equipe logada). */
export async function encerraSala(slug: string): Promise<void> {
  await chamaPorteiro({ acao: 'encerrar', slug });
}

// ── Leitura e escrita pela equipe (Supabase direto, protegido por RLS) ──────

export async function listaSalas(): Promise<Sala[]> {
  const { data, error } = await tabela()
    .select('*')
    .order('inicio', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as Sala[];
}

export type NovaSala = Pick<Sala, 'titulo' | 'lead_nome' | 'lead_email' | 'sdr' | 'inicio'> &
  Partial<Pick<Sala, 'origem' | 'duracao_min' | 'gravar' | 'observacoes'>>;

export async function criaSala(nova: NovaSala): Promise<Sala> {
  const { data: sessao } = await supabase.auth.getUser();
  const { data, error } = await tabela()
    .insert({ ...nova, criado_por: sessao?.user?.id ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Sala;
}

export async function cancelaSala(id: string): Promise<void> {
  const { error } = await tabela().update({ status: 'cancelada' }).eq('id', id);
  if (error) throw error;
}

// ── Formatação ──────────────────────────────────────────────────────────────

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "quinta, 16 de outubro · 14:30" */
export function quando(iso: string): string {
  const d = new Date(iso);
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} · ${hora}`;
}

/** O link que o SDR manda para o lead. */
export const linkDaSala = (slug: string) => `${window.location.origin}/sala/${slug}`;
