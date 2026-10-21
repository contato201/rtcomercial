import { supabase } from '@/integrations/supabase/client';

/**
 * RT Meet — Fase 4: engajamento pelo rosto.
 *
 * O MediaPipe (do Google) roda no navegador do anfitrião, olha o vídeo do lead
 * 4 vezes por segundo e devolve 478 pontos do rosto e umas 50 "expressões"
 * (sorriso, piscada, olhar para o lado, sobrancelha...). Aqui viram respostas
 * simples: tem rosto? olhando para a tela? sorrindo? tenso? — e, olhando a
 * sequência, quantas vezes acenou com a cabeça (sinal de concordância).
 * As 4 leituras por segundo existem por causa do aceno: um aceno dura menos de
 * 1 segundo e sumiria com uma leitura só.
 *
 * Nenhuma imagem é guardada: o banco recebe só a porcentagem por minuto.
 * Só é analisado quem leu o aviso que cita o rosto (`consentiu_rosto`).
 *
 * Os limites abaixo são estimativas — a tela mostra o resultado como sinal,
 * não como verdade.
 */

export interface Ponto { x: number; y: number }
export interface Expressao { categoryName: string; score: number }

export interface LeituraRosto {
  rosto: boolean;
  olhando: boolean;
  sorrindo: boolean;
  /** Sobrancelhas contraídas — tensão, desconfiança. */
  tenso: boolean;
  /** Posição do nariz entre testa e queixo (0 a 1); muda quando a cabeça sobe e desce. */
  inclinacao: number | null;
}

const SEM_ROSTO: LeituraRosto = { rosto: false, olhando: false, sorrindo: false, tenso: false, inclinacao: null };

// Pontos do mapa de rosto do MediaPipe.
const NARIZ = 1;
const TESTA = 10;
const QUEIXO = 152;
const BOCHECHA_ESQ = 234;
const BOCHECHA_DIR = 454;

/** Cabeça virada para o lado além disso = não está olhando a tela. */
export const LIMITE_GIRO = 0.4;
/** Faixa normal do nariz entre testa e queixo; fora dela = cabeça baixa ou para cima. */
export const FAIXA_INCLINACAO: [number, number] = [0.3, 0.72];
/** Expressões acima disso contam. */
export const LIMITE_OLHAR = 0.6;
export const LIMITE_OLHO_FECHADO = 0.55;
export const LIMITE_SORRISO = 0.45;
export const LIMITE_TENSAO = 0.4;

const nota = (expressoes: Expressao[], nome: string) =>
  expressoes.find((e) => e.categoryName === nome)?.score ?? 0;

/** Transforma o que o MediaPipe viu num "olhando / sorrindo". */
export function leRosto(pontos: Ponto[] | undefined, expressoes: Expressao[] = []): LeituraRosto {
  if (!pontos || pontos.length <= BOCHECHA_DIR) return SEM_ROSTO;

  const nariz = pontos[NARIZ];
  const esq = pontos[BOCHECHA_ESQ];
  const dir = pontos[BOCHECHA_DIR];
  const testa = pontos[TESTA];
  const queixo = pontos[QUEIXO];

  // Giro: com a cabeça reta, o nariz fica no meio das duas bochechas.
  const aEsq = Math.abs(nariz.x - esq.x);
  const aDir = Math.abs(dir.x - nariz.x);
  const giro = aEsq + aDir > 0 ? Math.abs(aEsq - aDir) / (aEsq + aDir) : 1;

  // Inclinação: onde o nariz fica entre a testa e o queixo.
  const altura = queixo.y - testa.y;
  const inclinacao = altura > 0 ? (nariz.y - testa.y) / altura : 0;

  const olhoFechado = (nota(expressoes, 'eyeBlinkLeft') + nota(expressoes, 'eyeBlinkRight')) / 2;
  const olharDesviado = Math.max(
    nota(expressoes, 'eyeLookOutLeft'),
    nota(expressoes, 'eyeLookOutRight'),
    nota(expressoes, 'eyeLookInLeft'),
    nota(expressoes, 'eyeLookInRight'),
    // olhar para baixo = celular, outra tela
    (nota(expressoes, 'eyeLookDownLeft') + nota(expressoes, 'eyeLookDownRight')) / 2,
  );
  const sorriso = (nota(expressoes, 'mouthSmileLeft') + nota(expressoes, 'mouthSmileRight')) / 2;

  const olhando =
    giro < LIMITE_GIRO &&
    inclinacao >= FAIXA_INCLINACAO[0] &&
    inclinacao <= FAIXA_INCLINACAO[1] &&
    olhoFechado < LIMITE_OLHO_FECHADO &&
    olharDesviado < LIMITE_OLHAR;

  const tensao = (nota(expressoes, 'browDownLeft') + nota(expressoes, 'browDownRight')) / 2;

  return {
    rosto: true,
    olhando,
    sorrindo: sorriso >= LIMITE_SORRISO,
    tenso: tensao >= LIMITE_TENSAO,
    inclinacao: altura > 0 ? inclinacao : null,
  };
}

// ── Contas por pessoa ──────────────────────────────────────────────────────

/** Uma leitura (4 por segundo). Câmera desligada não entra na conta. */
export interface Amostra extends LeituraRosto {
  em: number; // Date.now()
}

export interface Resumo {
  atencao: number; // % das leituras olhando para a tela
  sorriso: number; // % das leituras sorrindo
  semRosto: number; // % das leituras sem rosto na câmera
  tensao: number; // % das leituras com sobrancelha contraída
  amostras: number;
}

export function resume(amostras: Amostra[]): Resumo {
  const n = amostras.length;
  if (n === 0) return { atencao: 0, sorriso: 0, semRosto: 0, tensao: 0, amostras: 0 };
  const pct = (k: number) => Math.round((k / n) * 100);
  return {
    atencao: pct(amostras.filter((a) => a.olhando).length),
    sorriso: pct(amostras.filter((a) => a.sorrindo).length),
    semRosto: pct(amostras.filter((a) => !a.rosto).length),
    tensao: pct(amostras.filter((a) => a.tenso).length),
    amostras: n,
  };
}

/** As leituras do último `ms` (padrão: 1 minuto) — é o que o medidor mostra. */
export const ultimas = (amostras: Amostra[], agora: number, ms = 60_000) =>
  amostras.filter((a) => a.em > agora - ms);

/** Rótulo do momento, olhando as últimas leituras. */
export function situacaoAgora(recentes: Amostra[]): 'atento' | 'distraido' | 'sem_rosto' | 'sorrindo' | 'sem_dado' {
  if (recentes.length === 0) return 'sem_dado';
  const r = resume(recentes);
  if (r.semRosto >= 60) return 'sem_rosto';
  if (r.atencao < 50) return 'distraido';
  if (r.sorriso >= 30) return 'sorrindo';
  return 'atento';
}

// ── Aceno, tendência e sinais com nome ─────────────────────────────────────

/** Quanto a cabeça precisa descer e voltar para contar como aceno. */
export const AMPLITUDE_ACENO = 0.035;
const JANELA_ACENO_MS = 1200;
const INTERVALO_ACENO_MS = 700;

/**
 * Conta acenos de cabeça ("sim"): a inclinação sobe e volta dos dois lados de
 * um ponto, dentro de pouco mais de 1 segundo. Um aceno longo conta uma vez só.
 */
export function contaAcenos(amostras: Amostra[]): number {
  const serie = amostras.filter((a) => a.inclinacao !== null).sort((a, b) => a.em - b.em);
  let acenos = 0;
  let ultimo = -Infinity;
  for (let i = 0; i < serie.length; i++) {
    const p = serie[i];
    if (p.em - ultimo < INTERVALO_ACENO_MS) continue;
    let antes = Infinity;
    let depois = Infinity;
    for (let j = i - 1; j >= 0 && p.em - serie[j].em <= JANELA_ACENO_MS; j--) antes = Math.min(antes, serie[j].inclinacao!);
    for (let j = i + 1; j < serie.length && serie[j].em - p.em <= JANELA_ACENO_MS; j++) depois = Math.min(depois, serie[j].inclinacao!);
    const subiu = p.inclinacao! - antes;
    const voltou = p.inclinacao! - depois;
    if (subiu >= AMPLITUDE_ACENO && voltou >= AMPLITUDE_ACENO) {
      acenos++;
      ultimo = p.em;
    }
  }
  return acenos;
}

/**
 * Quanto a atenção mudou: último minuto contra o minuto de 3 min atrás.
 * "−27" = caiu 27 pontos. null = ainda não dá para comparar.
 */
export function tendencia(amostras: Amostra[], agora: number): number | null {
  const agoraR = resume(ultimas(amostras, agora));
  const antes = amostras.filter((a) => a.em > agora - 240_000 && a.em <= agora - 180_000);
  if (agoraR.amostras < 20 || antes.length < 20) return null;
  return agoraR.atencao - resume(antes).atencao;
}

export interface Sinal { texto: string; bom: boolean }

/** O que o rosto do lead mostrou no último minuto, em palavras. */
export function sinaisDoLead(recentes: Amostra[]): Sinal[] {
  if (recentes.length < 8) return [];
  const r = resume(recentes);
  if (r.semRosto >= 60) return [{ texto: 'Fora da câmera', bom: false }];
  const span = recentes[recentes.length - 1].em - recentes[0].em;
  const acenos = contaAcenos(recentes);
  const sinais: Sinal[] = [];
  if (r.atencao < 50) sinais.push({ texto: 'Olhar desviando da tela', bom: false });
  if (r.tensao >= 30) sinais.push({ texto: 'Sobrancelhas contraídas (tensão)', bom: false });
  if (acenos > 0) sinais.push({ texto: `Acenou ${acenos}x (concordância)`, bom: true });
  else if (span >= 45_000) sinais.push({ texto: 'Nenhum aceno no último minuto', bom: false });
  if (r.sorriso >= 20) sinais.push({ texto: 'Sorriu', bom: true });
  else if (span >= 45_000 && r.tensao < 10 && acenos === 0) sinais.push({ texto: 'Expressão neutra sustentada', bom: false });
  return sinais;
}

/**
 * Minuto em que a queda atual começou: o último minuto com atenção boa (≥ 60%)
 * antes de a curva ficar abaixo de 50%. null = não está em queda.
 */
export function inicioDaQueda(curva: Array<{ minuto: number; atencao: number }>): number | null {
  if (curva.length < 2 || curva[curva.length - 1].atencao >= 50) return null;
  for (let i = curva.length - 2; i >= 0; i--) {
    if (curva[i].atencao >= 60) return curva[i + 1].minuto;
  }
  return null;
}

/** Linha do banco: uma pessoa, um minuto da reunião. */
export interface LinhaEngajamento {
  sala_id: string;
  quem: string;
  minuto: number;
  atencao: number;
  sorriso: number;
  amostras: number;
}

/** Junta as leituras por minuto da reunião (contado de `inicio`). */
export function porMinuto(salaId: string, quem: string, amostras: Amostra[], inicio: number): LinhaEngajamento[] {
  const grupos = new Map<number, Amostra[]>();
  for (const a of amostras) {
    const m = Math.max(0, Math.floor((a.em - inicio) / 60_000));
    const g = grupos.get(m) ?? [];
    g.push(a);
    grupos.set(m, g);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => a - b)
    .map(([minuto, g]) => {
      const r = resume(g);
      return { sala_id: salaId, quem, minuto, atencao: r.atencao, sorriso: r.sorriso, amostras: r.amostras };
    });
}

/**
 * Frase curta para o Coach:
 * "Mariana: atenção 45% (caiu 27 pts em 3 min), sorriu 10%, sinais: tensão, nenhum aceno".
 */
export function resumoParaCoach(pessoas: { nome: string; recentes: Amostra[]; tendencia?: number | null }[]): string {
  return pessoas
    .filter((p) => p.recentes.length > 0)
    .map((p) => {
      const r = resume(p.recentes);
      if (r.semRosto >= 60) return `${p.nome}: fora da câmera`;
      const t = p.tendencia;
      const mudou = t === null || t === undefined || Math.abs(t) < 10
        ? ''
        : t < 0 ? ` (caiu ${-t} pts em 3 min)` : ` (subiu ${t} pts em 3 min)`;
      const sinais = sinaisDoLead(p.recentes).map((s) => s.texto.toLowerCase());
      return `${p.nome}: atenção ${r.atencao}%${mudou}, sorriu ${r.sorriso}%` +
        (sinais.length ? `, sinais: ${sinais.join(', ')}` : '');
    })
    .join('; ');
}

// ── Banco ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabela = () => (supabase as any).from('reunioes_engajamento');

/** Guarda (ou atualiza) os minutos. Mandar o mesmo minuto de novo só atualiza. */
export async function salvaEngajamento(linhas: LinhaEngajamento[]): Promise<void> {
  if (linhas.length === 0) return;
  const { error } = await tabela().upsert(linhas, { onConflict: 'sala_id,quem,minuto' });
  if (error) throw error;
}
