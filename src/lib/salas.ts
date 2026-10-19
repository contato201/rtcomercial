import { supabase } from '@/integrations/supabase/client';

/**
 * RT Meet — tudo que o site precisa saber sobre as salas de reunião.
 *
 * Quem fala com o banco é a edge function `sala-token` (o porteiro). O site
 * nunca lê a tabela `reunioes_salas` direto quando é visitante; a equipe
 * logada lê pelo Supabase normal, protegida pelas políticas de RLS.
 */

export type StatusSala = 'agendada' | 'ao_vivo' | 'encerrada' | 'cancelada';
export type PapelSala = 'anfitriao' | 'observador' | 'lead' | 'convidado';
/** 'convidados': só a lista entra. 'espera': os outros pedem e o anfitrião aceita. */
export type AcessoSala = 'convidados' | 'espera';

/** Uma reunião como a equipe vê (tabela completa). */
export interface Sala {
  id: string;
  slug: string;
  titulo: string;
  /** Vazios numa reunião instantânea, aberta pelo "Começar agora". */
  lead_nome: string | null;
  lead_email: string | null;
  /** Quem agendou. */
  sdr: string | null;
  /** Quem atende. */
  closer: string | null;
  /** E-mails que entram direto, além do lead. */
  convidados: string[];
  acesso: AcessoSala;
  instantanea: boolean;
  consentimento_em: string | null;
  /** 1 = Consultoria/Diagnóstico, 2 = Plano de Ação/Proposta. O Coach segue o roteiro de cada uma. */
  tipo_reuniao: 1 | 2;
  /** O que o SDR já descobriu — o Coach lê antes de começar. */
  notas_sdr: string | null;
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
  com: string | null;
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
    /** Primeiro nome de quem atende — o que o lead vê. */
    com: string | null;
    // Os campos abaixo só chegam para a equipe; para quem é de fora vêm vazios.
    id: string | null;
    tipo_reuniao: 1 | 2 | null;
    lead_nome: string | null;
    sdr: string | null;
    closer: string | null;
    origem: string | null;
    acesso: AcessoSala | null;
    /** Começa a gravar sozinho quando o anfitrião entra. */
    gravar: boolean;
  };
}

/** Quem está na sala de espera, como o anfitrião vê. */
export interface PedidoDeEntrada {
  id: string;
  nome: string;
  email: string;
  created_at: string;
}

/** O que acontece ao tentar entrar: ou entra, ou vai para a sala de espera. */
export type ResultadoEntrada =
  | { tipo: 'entrou'; cracha: Cracha }
  | { tipo: 'esperando'; pedido: { id: string; chave: string } };

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
  email_nao_confere:
    'Esse e-mail não é o do convite desta reunião. Use o mesmo e-mail em que você recebeu o convite.',
  sala_nao_encontrada: 'Esse link de reunião não existe mais.',
  sala_cancelada: 'Essa reunião foi cancelada.',
  sala_encerrada: 'Essa reunião já foi encerrada.',
  fora_do_horario: 'A sala abre 30 minutos antes do horário marcado.',
  livekit_nao_configurado: 'A sala de vídeo ainda não foi configurada. Avise a equipe.',
  nao_autorizado: 'Você precisa estar logado para fazer isso.',
  dados_incompletos: 'Preencha seu nome e um e-mail válido para pedir para entrar.',
  pedido_recusado: 'O anfitrião não aceitou sua entrada nesta reunião.',
  pedido_invalido: 'Esse pedido de entrada não vale mais. Peça para entrar de novo.',
  fila_cheia: 'Tem gente demais esperando para entrar agora. Tente de novo em instantes.',
  gravacao_nao_configurada: 'A gravação ainda não foi ligada: faltam as chaves do armazém no Supabase.',
  gravacao_falhou: 'Não consegui começar a gravação agora. Tente de novo em instantes.',
};

/** Monta o recado. Fora do horário, diz a hora em que a sala abre. */
export const recado = (erro?: string, inicio?: string) => {
  if (erro === 'fora_do_horario' && inicio) {
    const abre = new Date(new Date(inicio).getTime() - 30 * 60 * 1000);
    const hora = abre.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `A sala ainda não abriu. Ela abre às ${hora}, 30 minutos antes do horário marcado.`;
  }
  return (erro && RECADOS[erro]) || 'Não consegui agora. Tente de novo em instantes.';
};

/**
 * Lê o motivo que o porteiro mandou quando recusou (status 403, 404…).
 *
 * O Supabase entrega esse caso como erro, com a resposta original guardada em
 * `context` — um Response, que precisa ser lido com `.json()`. Antes a tela
 * tentava ler como texto pronto, não achava nada e mostrava sempre o recado
 * genérico: o lead via "tente de novo" quando o problema era o e-mail.
 */
async function motivoDaRecusa(error: unknown): Promise<{ erro?: string; inicio?: string }> {
  const resposta = (error as { context?: unknown })?.context;
  if (resposta instanceof Response) {
    try {
      return (await resposta.clone().json()) ?? {};
    } catch {
      return {};
    }
  }
  return {};
}

async function chamaPorteiro<T>(corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('sala-token', { body: corpo });
  if (error) {
    const { erro, inicio } = await motivoDaRecusa(error);
    throw new Error(recado(erro, inicio));
  }
  if (!data?.ok) throw new Error(recado(data?.erro, data?.inicio));
  return data as T;
}

/** O lead digita o e-mail e descobre quais reuniões tem marcadas. */
export async function buscaReunioesPorEmail(email: string): Promise<SalaDoLead[]> {
  const r = await chamaPorteiro<{ salas: SalaDoLead[] }>({ acao: 'buscar', email });
  return r.salas ?? [];
}

type RespostaEntrada = Cracha & { aguardando?: boolean; pedido?: { id: string; chave: string } };

const resultado = (r: RespostaEntrada): ResultadoEntrada =>
  r.aguardando && r.pedido ? { tipo: 'esperando', pedido: r.pedido } : { tipo: 'entrou', cracha: r };

/**
 * Tenta entrar na sala. A equipe logada entra sempre. Quem é de fora entra
 * direto se estiver na lista de convidados; se não estiver e a reunião tiver
 * sala de espera, vira um pedido que o anfitrião aceita ou recusa.
 */
export async function entraNaSala(opts: {
  slug: string;
  email?: string;
  nome?: string;
  papel?: 'anfitriao' | 'observador';
  /** Marcou "Concordo" com transcrição e análise por IA (LGPD). */
  consentiu?: boolean;
}): Promise<ResultadoEntrada> {
  return resultado(await chamaPorteiro<RespostaEntrada>({ acao: 'entrar', ...opts }));
}

/** Pede o crachá e falha se cair na sala de espera — para quem sempre entra direto. */
export async function pedeCracha(opts: Parameters<typeof entraNaSala>[0]): Promise<Cracha> {
  const r = await entraNaSala(opts);
  if (r.tipo === 'esperando') throw new Error('Você está na sala de espera.');
  return r.cracha;
}

/** Quem está na sala de espera pergunta se já foi aceito. */
export async function consultaPedido(pedido: { id: string; chave: string }): Promise<ResultadoEntrada> {
  const r = await chamaPorteiro<RespostaEntrada>({
    acao: 'pedido', pedido_id: pedido.id, chave: pedido.chave,
  });
  return r.aguardando ? { tipo: 'esperando', pedido } : { tipo: 'entrou', cracha: r };
}

/** O anfitrião vê quem está esperando para entrar. */
export async function listaPedidos(slug: string): Promise<PedidoDeEntrada[]> {
  const r = await chamaPorteiro<{ pedidos: PedidoDeEntrada[] }>({ acao: 'pedidos', slug });
  return r.pedidos ?? [];
}

/** O anfitrião aceita ou recusa um pedido de entrada. */
export async function decidePedido(pedidoId: string, aceitar: boolean): Promise<void> {
  await chamaPorteiro({ acao: 'decidir', pedido_id: pedidoId, aceitar });
}

/** Liga ou desliga a gravação da reunião (só equipe logada). */
export async function gravaSala(slug: string, ligar: boolean): Promise<void> {
  await chamaPorteiro({ acao: 'gravar', slug, ligar });
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

export type NovaSala = Pick<Sala, 'titulo' | 'inicio'> &
  Partial<Pick<Sala,
    | 'lead_nome' | 'lead_email' | 'sdr' | 'closer' | 'convidados' | 'acesso'
    | 'instantanea' | 'origem' | 'duracao_min' | 'gravar' | 'observacoes'
    | 'tipo_reuniao' | 'notas_sdr'>>;

export async function criaSala(nova: NovaSala): Promise<Sala> {
  const { data: sessao } = await supabase.auth.getUser();
  const { data, error } = await tabela()
    .insert({ ...nova, criado_por: sessao?.user?.id ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Sala;
}

/**
 * "Começar agora": abre uma reunião na hora, sem lead cadastrado. Ela já nasce
 * com sala de espera — quem chegar pelo link pede para entrar e o anfitrião
 * aceita, como no Meet.
 */
export async function criaReuniaoAgora(
  opcoes: { closer?: string | null; gravar?: boolean } = {},
): Promise<Sala> {
  return criaSala({
    titulo: 'Reunião instantânea',
    inicio: new Date().toISOString(),
    acesso: 'espera',
    instantanea: true,
    closer: opcoes.closer || null,
    gravar: opcoes.gravar === true,
  });
}

/** Uma gravação guardada no armazém `gravacoes`. */
export interface Gravacao {
  id: string;
  sala_id: string;
  arquivo: string;
  status: 'gravando' | 'concluida' | 'falhou';
  inicio: string;
  fim: string | null;
}

/** As gravações de uma reunião — ou de todas, se não disser qual. */
export async function listaGravacoes(salaId?: string): Promise<Gravacao[]> {
  const consulta = (supabase as unknown as {
    from: (nome: string) => ReturnType<typeof supabase.from>;
  }).from('reunioes_gravacoes')
    .select('id, sala_id, arquivo, status, inicio, fim')
    .order('inicio', { ascending: true })
    .limit(500);
  const { data, error } = await (salaId ? consulta.eq('sala_id', salaId) : consulta);
  if (error) throw error;
  return (data ?? []) as unknown as Gravacao[];
}

/** Link de 1 hora para assistir: o armazém é fechado, ninguém acha o vídeo por fora. */
export async function linkDaGravacao(arquivo: string): Promise<string> {
  const { data, error } = await supabase.storage.from('gravacoes').createSignedUrl(arquivo, 3600);
  if (error || !data?.signedUrl) throw new Error('A gravação ainda está sendo salva. Tente de novo em alguns minutos.');
  return data.signedUrl;
}

/** "a@b.com, c@d.com; e@f.com" → ['a@b.com', 'c@d.com', 'e@f.com'] (só os que parecem e-mail). */
export function separaEmails(texto: string): string[] {
  return Array.from(new Set(
    texto
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
  ));
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
export function linkGoogleAgenda(
  sala: Pick<Sala, 'slug' | 'titulo' | 'inicio' | 'duracao_min' | 'lead_email'> &
    Partial<Pick<Sala, 'convidados' | 'closer'>>,
): string {
  const inicio = new Date(sala.inicio);
  const fim = new Date(inicio.getTime() + sala.duracao_min * 60 * 1000);
  const link = linkDaSala(sala.slug);
  const convidados = [sala.lead_email, ...(sala.convidados ?? [])].filter(Boolean) as string[];
  // Tudo que vai aqui o lead também vê — por isso nada de origem, SDR ou
  // anotação interna. Só o que ajuda ele a entrar.
  const detalhes = [
    sala.closer
      ? `Reunião com ${sala.closer}, da Reproduzindo Talentos.`
      : 'Reunião com a Reproduzindo Talentos.',
    '',
    `Para entrar, acesse: ${link}`,
    'Na entrada, confirme com o e-mail em que você recebeu este convite.',
    '',
    'Não precisa instalar nada. A sala abre 30 minutos antes do horário.',
  ].join('\n');

  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${sala.titulo} — Reproduzindo Talentos`,
    dates: `${dataGoogle(inicio)}/${dataGoogle(fim)}`,
    details: detalhes,
    location: link,
    add: convidados.join(','),
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
