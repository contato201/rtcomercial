import { supabase } from '@/integrations/supabase/client';
import { duracaoMin, situacao, type Sala } from './salas';

/**
 * Arquivo de reuniões: tudo o que já aconteceu, num lugar só — gravação,
 * transcrição, relatório do Coach e engajamento.
 *
 * As contas por reunião (quantas falas, quantas gravações, nota) vêm prontas
 * do banco, na visão `reunioes_arquivo`. Aqui ficam os filtros, os números do
 * topo do painel e o texto da transcrição para baixar.
 */

export interface ResumoReuniao {
  sala_id: string;
  falas: number;
  gravacoes: number;
  segundos_gravados: number;
  atencao_media: number | null;
  nota: number | null;
  tem_relatorio: boolean;
}

export type ItemArquivo = Sala & { resumo: ResumoReuniao };

export type Periodo = '7' | '30' | '90' | 'tudo';
export type SoMostrar = 'todas' | 'gravadas' | 'transcritas' | 'com_relatorio';

export interface Filtros {
  busca: string;
  closer: string; // '' = todos
  periodo: Periodo;
  so: SoMostrar;
}

export const FILTROS_PADRAO: Filtros = { busca: '', closer: '', periodo: '30', so: 'todas' };

const vazio = (salaId: string): ResumoReuniao => ({
  sala_id: salaId, falas: 0, gravacoes: 0, segundos_gravados: 0, atencao_media: null, nota: null, tem_relatorio: false,
});

/** Junta as reuniões com o resumo e deixa só as que já aconteceram (ou têm algo guardado). */
export function montaArquivo(salas: Sala[], resumos: ResumoReuniao[], agora = Date.now()): ItemArquivo[] {
  const porSala = new Map(resumos.map((r) => [r.sala_id, r]));
  return salas
    .map((s) => ({ ...s, resumo: porSala.get(s.id) ?? vazio(s.id) }))
    .filter((s) => {
      const temAlgo = s.resumo.falas > 0 || s.resumo.gravacoes > 0 || s.resumo.tem_relatorio;
      return situacao(s, agora) === 'encerrada' || temAlgo;
    })
    .sort((a, b) => b.inicio.localeCompare(a.inicio));
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filtraArquivo(itens: ItemArquivo[], f: Filtros, agora = Date.now()): ItemArquivo[] {
  const busca = semAcento(f.busca.trim());
  const desde = f.periodo === 'tudo' ? 0 : agora - Number(f.periodo) * 24 * 60 * 60 * 1000;
  return itens.filter((s) => {
    if (new Date(s.inicio).getTime() < desde) return false;
    if (f.closer && s.closer !== f.closer) return false;
    if (f.so === 'gravadas' && s.resumo.gravacoes === 0) return false;
    if (f.so === 'transcritas' && s.resumo.falas === 0) return false;
    if (f.so === 'com_relatorio' && !s.resumo.tem_relatorio) return false;
    if (busca) {
      const onde = semAcento([s.lead_nome, s.lead_email, s.titulo, s.closer, s.sdr, s.origem].filter(Boolean).join(' '));
      if (!onde.includes(busca)) return false;
    }
    return true;
  });
}

export interface Numeros {
  reunioes: number;
  gravadas: number;
  horasGravadas: number; // com 1 casa
  transcritas: number;
  notaMedia: number | null; // com 1 casa
  comparecimento: number | null; // % das agendadas com lead em que o lead entrou
  atencaoMedia: number | null;
  minutosMedios: number | null;
}

export function numerosDoArquivo(itens: ItemArquivo[]): Numeros {
  const media = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
  const umaCasa = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);

  const comLead = itens.filter((s) => !s.instantanea && s.lead_email);
  const notas = itens.map((s) => s.resumo.nota).filter((n): n is number => n !== null);
  const atencoes = itens.map((s) => s.resumo.atencao_media).filter((n): n is number => n !== null);
  const duracoes = itens.map(duracaoMin).filter((n): n is number => n !== null);
  const segundos = itens.reduce((t, s) => t + s.resumo.segundos_gravados, 0);

  return {
    reunioes: itens.length,
    gravadas: itens.filter((s) => s.resumo.gravacoes > 0).length,
    horasGravadas: Math.round((segundos / 3600) * 10) / 10,
    transcritas: itens.filter((s) => s.resumo.falas > 0).length,
    notaMedia: umaCasa(media(notas)),
    comparecimento: comLead.length
      ? Math.round((comLead.filter((s) => s.lead_entrou).length / comLead.length) * 100)
      : null,
    atencaoMedia: atencoes.length ? Math.round(media(atencoes)!) : null,
    minutosMedios: duracoes.length ? Math.round(media(duracoes)!) : null,
  };
}

/** Closers que aparecem no arquivo, para o filtro. */
export const closersDoArquivo = (itens: ItemArquivo[]) =>
  [...new Set(itens.map((s) => s.closer).filter((c): c is string => !!c))].sort();

// ── Transcrição ────────────────────────────────────────────────────────────

export interface Fala {
  id: string;
  quem: string;
  papel: string | null;
  texto: string;
  falado_em: string;
}

/** "03:25" — tempo desde a primeira fala da reunião. */
export function tempoDaFala(falaEm: string, primeiraEm: string): string {
  const s = Math.max(0, Math.round((new Date(falaEm).getTime() - new Date(primeiraEm).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const dois = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${dois(m)}:${dois(s % 60)}` : `${dois(m)}:${dois(s % 60)}`;
}

/** Junta falas seguidas da mesma pessoa num parágrafo só — fica muito mais fácil de ler. */
export function agrupaFalas(falas: Fala[]): Array<Fala & { textos: string[] }> {
  const grupos: Array<Fala & { textos: string[] }> = [];
  for (const f of falas) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.quem === f.quem) ultimo.textos.push(f.texto);
    else grupos.push({ ...f, textos: [f.texto] });
  }
  return grupos;
}

/** A transcrição em texto puro, para baixar ou colar onde quiser. */
export function transcricaoComoTexto(titulo: string, quando: string, falas: Fala[]): string {
  if (falas.length === 0) return `${titulo}\n${quando}\n\n(sem transcrição)\n`;
  const primeira = falas[0].falado_em;
  const linhas = agrupaFalas(falas).map(
    (g) => `[${tempoDaFala(g.falado_em, primeira)}] ${g.quem}${g.papel === 'anfitriao' ? ' (RT)' : ''}: ${g.textos.join(' ')}`,
  );
  return `${titulo}\n${quando}\n\n${linhas.join('\n\n')}\n`;
}

// ── Banco ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabela = (nome: string) => (supabase as any).from(nome);

/** Resumos de todas as reuniões. Se a visão ainda não existir, o painel abre vazio em vez de quebrar. */
export async function buscaResumos(): Promise<ResumoReuniao[]> {
  const { data, error } = await tabela('reunioes_arquivo').select('*').limit(1000);
  if (error) return [];
  return (data ?? []) as ResumoReuniao[];
}

export async function buscaTranscricao(salaId: string): Promise<Fala[]> {
  const { data, error } = await tabela('reunioes_transcricao')
    .select('id, quem, papel, texto, falado_em')
    .eq('sala_id', salaId)
    .order('falado_em', { ascending: true })
    .limit(10000);
  if (error) throw error;
  return (data ?? []) as Fala[];
}

export interface MinutoEngajamento {
  quem: string;
  minuto: number;
  atencao: number;
  sorriso: number;
}

export async function buscaEngajamento(salaId: string): Promise<MinutoEngajamento[]> {
  const { data, error } = await tabela('reunioes_engajamento')
    .select('quem, minuto, atencao, sorriso')
    .eq('sala_id', salaId)
    .order('minuto', { ascending: true });
  if (error) throw error;
  return (data ?? []) as MinutoEngajamento[];
}
