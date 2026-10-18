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

/**
 * Encerra a reunião quando o anfitrião FECHA A ABA em vez de clicar em sair.
 *
 * Nessa hora o navegador está desmontando a página e não espera resposta, então
 * não dá para usar o caminho normal (que é assíncrono). O `keepalive` pede ao
 * navegador para terminar de mandar o pedido mesmo com a aba já fechada. O
 * crachá de login precisa ter sido guardado antes (`tokenDeLogin`), porque
 * aqui não dá tempo de buscá-lo.
 */
export function encerraSalaAoFechar(slug: string, tokenDeLogin: string): void {
  try {
    void fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sala-token`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${tokenDeLogin}`,
      },
      body: JSON.stringify({ acao: 'encerrar', slug }),
    });
  } catch {
    // Melhor esforço: se falhar, a tela Reuniões fecha a sala esquecida depois.
  }
}

/** O crachá de login de quem é da equipe, para usar ao fechar a aba. */
export async function tokenDeLogin(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
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

/**
 * Fecha uma reunião que ficou "ao vivo" esquecida — o anfitrião saiu de um
 * jeito que a página não conseguiu avisar (bateria acabou, internet caiu de
 * vez). O fim fica em branco de propósito: a gente não sabe a hora real, e
 * inventar uma deixaria a duração mentindo.
 */
export async function fechaSalaEsquecida(id: string): Promise<void> {
  const { error } = await tabela()
    .update({ status: 'encerrada' })
    .eq('id', id)
    .eq('status', 'ao_vivo');
  if (error) throw error;
}

// ── Situação de cada reunião (o que a tela mostra) ──────────────────────────

/** Depois disso sem ninguém entrar, a reunião "não aconteceu". Igual à janela do porteiro. */
const JANELA_DEPOIS_MS = 4 * 60 * 60 * 1000;
/** Folga depois do fim previsto para considerar uma sala "ao vivo" esquecida. */
const FOLGA_ESQUECIDA_MS = 60 * 60 * 1000;

export type Situacao = StatusSala | 'nao_aconteceu';

/**
 * O status do banco nem sempre diz a verdade sozinho: uma reunião "agendada"
 * cujo horário passou sem ninguém entrar não aconteceu — e isso é dado de
 * funil (lead que faltou), não reunião pendente.
 */
export function situacao(sala: Sala, agora = Date.now()): Situacao {
  if (sala.status === 'agendada' && new Date(sala.inicio).getTime() + JANELA_DEPOIS_MS < agora) {
    return 'nao_aconteceu';
  }
  return sala.status;
}

/** Ficou "ao vivo" muito além do fim previsto: alguém saiu sem a página avisar. */
export function estaEsquecida(sala: Sala, agora = Date.now()): boolean {
  if (sala.status !== 'ao_vivo' || !sala.entrou_em) return false;
  const fimPrevisto = new Date(sala.entrou_em).getTime() + sala.duracao_min * 60 * 1000;
  return fimPrevisto + FOLGA_ESQUECIDA_MS < agora;
}

/** Quantos minutos a reunião durou, ou null se não deu para medir. */
export function duracaoMin(sala: Sala): number | null {
  if (!sala.entrou_em || !sala.encerrada_em) return null;
  const ms = new Date(sala.encerrada_em).getTime() - new Date(sala.entrou_em).getTime();
  return ms > 0 ? Math.max(1, Math.round(ms / 60000)) : null;
}

// ── Convite no Google Agenda ────────────────────────────────────────────────

/** "20261021T173000Z" — o formato de data que o Google Agenda entende no link. */
const dataGoogle = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/**
 * Link que abre o Google Agenda de quem clicou, com o evento já preenchido:
 * título, horário, o lead como convidado e o link da nossa sala.
 *
 * Quem salva o evento é o próprio SDR, na conta Google dele — e aí o Google
 * faz o resto: manda o convite por e-mail, o lead confirma na agenda dele e
 * recebe lembrete. Sem servidor de e-mail, sem integração para manter.
 */
export function linkGoogleAgenda(sala: Pick<Sala, 'slug' | 'titulo' | 'inicio' | 'duracao_min' | 'lead_email'>): string {
  const inicio = new Date(sala.inicio);
  const fim = new Date(inicio.getTime() + sala.duracao_min * 60 * 1000);
  const link = linkDaSala(sala.slug);
  const detalhes = [
    'Reunião com a Reproduzindo Talentos.',
    '',
    `Para entrar, acesse: ${link}`,
    `Na entrada, confirme com este e-mail: ${sala.lead_email}`,
    '',
    'Não precisa instalar nada. A sala abre 30 minutos antes do horário.',
  ].join('\n');

  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${sala.titulo} — Reproduzindo Talentos`,
    dates: `${dataGoogle(inicio)}/${dataGoogle(fim)}`,
    details: detalhes,
    location: link,
    add: sala.lead_email,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
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
