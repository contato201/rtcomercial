import { supabase } from '@/integrations/supabase/client';

/**
 * RT Meet — Coach IA, do lado do site.
 *
 * Quem pensa é a função `coach` no Supabase (com o Claude e o processo
 * comercial da RT). Aqui fica o resto: o formato do estado, como juntar cada
 * resposta nova ao que já se sabe, e as regras de comportamento da seção 5 do
 * processo — no máximo uma dica por minuto, o alerta vermelho fura a fila, não
 * repetir a mesma dica em 5 minutos.
 */

export type TipoReuniao = 1 | 2;
export type NivelDica = 'critico' | 'atencao' | 'sugestao';
export type FonteDado = 'cliente' | 'closer' | 'estimativa';

/** Blocos do roteiro — tabelas 3.2 e 4.1 do processo. Mesmos nomes da função. */
export const ROTEIRO: Record<TipoReuniao, string[]> = {
  1: ['Abertura', 'Motivo', 'Descoberta', 'Funil atual', 'Auditoria ao vivo', 'Dinheiro parado', 'RT + método', 'Próximo passo'],
  2: ['Recapitulação', 'Ecossistema', 'Primeira ação', 'Projeção', 'Responsabilidades', 'Entregáveis', 'Investimento', 'Condição e fechamento', 'Próximos passos'],
};

/** Ficha da seção 3.3. Prioridade 1 = sem isso não existe proposta. */
export const CAMPOS_FICHA: Array<{ chave: string; rotulo: string; prioridade: 1 | 2 }> = [
  { chave: 'alunos', rotulo: 'Alunos hoje', prioridade: 1 },
  { chave: 'capacidade', rotulo: 'Capacidade / vagas ociosas', prioridade: 1 },
  { chave: 'ticket', rotulo: 'Ticket (mensalidade)', prioridade: 1 },
  { chave: 'faturamento', rotulo: 'Faturamento mensal', prioridade: 1 },
  { chave: 'meta', rotulo: 'Meta de matrículas', prioridade: 1 },
  { chave: 'decisor', rotulo: 'Quem decide', prioridade: 1 },
  { chave: 'verba', rotulo: 'Verba de mídia', prioridade: 1 },
  { chave: 'captacao_atual', rotulo: 'Como capta hoje', prioridade: 2 },
  { chave: 'agencia_anterior', rotulo: 'Agência anterior', prioridade: 2 },
  { chave: 'funil', rotulo: 'Funil atual', prioridade: 2 },
  { chave: 'atendimento_leads', rotulo: 'Quem atende os leads', prioridade: 2 },
  { chave: 'evasao', rotulo: 'Evasão', prioridade: 2 },
  { chave: 'permanencia', rotulo: 'Permanência média', prioridade: 2 },
  { chave: 'sazonalidade', rotulo: 'Sazonalidade', prioridade: 2 },
  { chave: 'gatilho_urgencia', rotulo: 'Gatilho de urgência', prioridade: 2 },
];

export interface Dica {
  nivel: NivelDica;
  texto: string;
  motivo: string;
  minuto: number;
}

export interface ValorFicha {
  valor: string;
  fonte: FonteDado;
  minuto: number;
}

export interface Spin {
  situacao: number;
  problema: number;
  implicacao: number;
  necessidade: number;
}

/** Tudo que o Coach sabe da reunião até agora. Vai para o banco a cada dica. */
export interface EstadoCoach {
  bloco: string | null;
  ficha: Record<string, ValorFicha>;
  /** Mais nova primeiro. */
  dicas: Dica[];
  pendencias: string[];
  citacoes: string[];
  spin: Spin;
  termometro: number | null;
}

export const estadoInicial = (): EstadoCoach => ({
  bloco: null,
  ficha: {},
  dicas: [],
  pendencias: [],
  citacoes: [],
  spin: { situacao: 0, problema: 0, implicacao: 0, necessidade: 0 },
  termometro: null,
});

/** O que a função `coach` devolve a cada chamada ao vivo. */
export interface RespostaCoach {
  bloco_atual: string;
  ficha: Array<{ campo: string; valor: string; fonte: FonteDado }>;
  dica: { nivel: NivelDica | 'nenhuma'; texto: string; motivo: string };
  pendencias_novas: string[];
  citacoes_fortes: string[];
  spin_novas: Spin;
  termometro: number;
}

/** Um trecho da conversa, como o transcritor manda. */
export interface Trecho {
  id: string;
  identidade: string;
  quem: string;
  papel: string | null;
  texto: string;
  /** Milissegundos desde 1970. */
  falado_em: number;
}

const INTERVALO_MINIMO_MIN = 1;   // seção 5.1: no máximo 1 dica a cada 60–90 s
const SEM_REPETIR_MIN = 5;        // seção 8: não repetir a mesma dica em menos de 5 min
const MAX_DICAS = 30;
const MAX_LISTA = 20;

const mesmoTexto = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const semRepetidos = (atuais: string[], novos: string[]) => {
  const lista = [...atuais];
  for (const n of novos.map((x) => x.trim()).filter(Boolean)) {
    if (!lista.some((x) => mesmoTexto(x, n))) lista.push(n);
  }
  return lista.slice(-MAX_LISTA);
};
const inteiro = (n: unknown) => Math.max(0, Math.round(Number(n) || 0));

/**
 * Junta uma resposta nova do Coach ao estado. Pura, sem efeito colateral —
 * é o coração das regras de comportamento, e é testada à parte.
 */
export function aplicaResposta(
  estado: EstadoCoach,
  resposta: RespostaCoach,
  minuto: number,
  tipo: TipoReuniao,
): EstadoCoach {
  const novo: EstadoCoach = {
    ...estado,
    ficha: { ...estado.ficha },
    spin: { ...estado.spin },
  };

  // Bloco: só aceita um nome que exista no roteiro desta reunião.
  if (ROTEIRO[tipo].includes(resposta.bloco_atual)) novo.bloco = resposta.bloco_atual;

  // Ficha: o que foi dito agora substitui o anterior. Valor vazio não apaga nada.
  const chaves = new Set(CAMPOS_FICHA.map((c) => c.chave));
  for (const item of resposta.ficha ?? []) {
    if (!chaves.has(item.campo) || !item.valor?.trim()) continue;
    novo.ficha[item.campo] = { valor: item.valor.trim(), fonte: item.fonte, minuto };
  }

  // Dica: as regras da seção 5.
  const d = resposta.dica;
  if (d && d.nivel !== 'nenhuma' && d.texto?.trim()) {
    const ultima = estado.dicas[0];
    const cedoDemais = ultima && d.nivel !== 'critico' && minuto - ultima.minuto < INTERVALO_MINIMO_MIN;
    const repetida = estado.dicas.some(
      (x) => mesmoTexto(x.texto, d.texto) && minuto - x.minuto < SEM_REPETIR_MIN,
    );
    if (!cedoDemais && !repetida) {
      novo.dicas = [
        { nivel: d.nivel, texto: d.texto.trim(), motivo: d.motivo ?? '', minuto },
        ...estado.dicas,
      ].slice(0, MAX_DICAS);
    }
  }

  novo.pendencias = semRepetidos(estado.pendencias, resposta.pendencias_novas ?? []);
  novo.citacoes = semRepetidos(estado.citacoes, resposta.citacoes_fortes ?? []);

  const s = resposta.spin_novas;
  if (s) {
    novo.spin = {
      situacao: estado.spin.situacao + inteiro(s.situacao),
      problema: estado.spin.problema + inteiro(s.problema),
      implicacao: estado.spin.implicacao + inteiro(s.implicacao),
      necessidade: estado.spin.necessidade + inteiro(s.necessidade),
    };
  }

  if (Number.isFinite(resposta.termometro)) {
    novo.termometro = Math.max(0, Math.min(100, Math.round(resposta.termometro)));
  }
  return novo;
}

/** O que mandar para o Claude junto com o trecho novo: curto, sem o histórico inteiro. */
export function resumoParaCoach(estado: EstadoCoach) {
  return {
    bloco: estado.bloco,
    ficha: Object.fromEntries(Object.entries(estado.ficha).map(([k, v]) => [k, `${v.valor} (${v.fonte})`])),
    faltando_prioridade_1: CAMPOS_FICHA.filter((c) => c.prioridade === 1 && !estado.ficha[c.chave]).map((c) => c.chave),
    dicas_recentes: estado.dicas.slice(0, 5).map((d) => `min ${d.minuto}: ${d.texto}`),
    pendencias: estado.pendencias,
    spin: estado.spin,
  };
}

/** Quanto do que foi falado saiu da boca do closer, em %, pelo tamanho do texto. */
export function falaDoCloserPct(trechos: Trecho[]): number {
  let closer = 0;
  let total = 0;
  for (const t of trechos) {
    total += t.texto.length;
    if (t.papel === 'anfitriao') closer += t.texto.length;
  }
  return total === 0 ? 0 : Math.round((closer / total) * 100);
}

/**
 * Se dois da equipe entrarem como anfitrião, só um deles conversa com o Coach
 * e grava no banco — senão a conta do Claude e a transcrição dobram. Todos
 * escolhem do mesmo jeito: a menor identidade entre os anfitriões presentes.
 */
export function quemGrava(identidadesAnfitrioes: string[]): string | null {
  return [...identidadesAnfitrioes].sort()[0] ?? null;
}

// ── Conversa com o servidor ────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabela = (nome: string) => (supabase as any).from(nome);

/** Pede ao Coach o que mostrar agora. null = nada novo (ou o Coach falhou — a reunião segue). */
export async function pedeDica(opts: {
  salaId: string;
  minuto: number;
  falaCloserPct: number;
  estado: EstadoCoach;
  novos: Trecho[];
}): Promise<RespostaCoach | null> {
  const { data, error } = await supabase.functions.invoke('coach', {
    body: {
      acao: 'dica',
      sala_id: opts.salaId,
      minuto: opts.minuto,
      fala_closer_pct: opts.falaCloserPct,
      estado: resumoParaCoach(opts.estado),
      novos: opts.novos.map((t) => ({ quem: t.quem, papel: t.papel, texto: t.texto })),
    },
  });
  if (error || !data?.ok || data.nada) return null;
  return data.coach as RespostaCoach;
}

/** Pede o relatório do fim da reunião (PARTE A + PARTE B). Leva uns 30 a 60 segundos. */
export async function geraRelatorio(salaId: string): Promise<{ relatorio: string; nota: number }> {
  const { data, error } = await supabase.functions.invoke('coach', {
    body: { acao: 'relatorio', sala_id: salaId },
  });
  if (error || !data?.ok) {
    const semFala = data?.erro === 'sem_transcricao';
    throw new Error(semFala ? 'Esta reunião não tem transcrição para analisar.' : 'Não consegui gerar o relatório agora.');
  }
  return { relatorio: data.relatorio, nota: data.nota };
}

/** Guarda trechos da conversa. Mandar o mesmo trecho duas vezes não duplica. */
export async function salvaTrechos(salaId: string, trechos: Trecho[]): Promise<void> {
  if (trechos.length === 0) return;
  const { error } = await tabela('reunioes_transcricao').upsert(
    trechos.map((t) => ({
      id: t.id,
      sala_id: salaId,
      quem: t.quem,
      papel: t.papel,
      texto: t.texto,
      falado_em: new Date(t.falado_em).toISOString(),
    })),
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (error) throw error;
}

/** Guarda o estado ao vivo — é daqui que o observador acompanha. */
export async function salvaEstado(salaId: string, estado: EstadoCoach): Promise<void> {
  const { error } = await tabela('reunioes_coach').upsert(
    { sala_id: salaId, estado, updated_at: new Date().toISOString() },
    { onConflict: 'sala_id' },
  );
  if (error) throw error;
}

export interface RegistroCoach {
  estado: EstadoCoach | null;
  relatorio: string | null;
  nota: number | null;
  relatorio_em: string | null;
}

export async function buscaCoach(salaId: string): Promise<RegistroCoach | null> {
  const { data, error } = await tabela('reunioes_coach')
    .select('estado, relatorio, nota, relatorio_em')
    .eq('sala_id', salaId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const estado = data.estado && Object.keys(data.estado).length > 0 ? (data.estado as EstadoCoach) : null;
  return { estado, relatorio: data.relatorio, nota: data.nota, relatorio_em: data.relatorio_em };
}
