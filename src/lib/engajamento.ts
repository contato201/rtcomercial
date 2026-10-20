import { supabase } from '@/integrations/supabase/client';

/**
 * RT Meet — Fase 4: engajamento pelo rosto.
 *
 * O MediaPipe (do Google) roda no navegador do anfitrião, olha o vídeo do lead
 * uma vez por segundo e devolve 478 pontos do rosto e umas 50 "expressões"
 * (sorriso, piscada, olhar para o lado...). Aqui viram três respostas simples:
 * tem rosto? está olhando para a tela? está sorrindo?
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
}

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

const nota = (expressoes: Expressao[], nome: string) =>
  expressoes.find((e) => e.categoryName === nome)?.score ?? 0;

/** Transforma o que o MediaPipe viu num "olhando / sorrindo". */
export function leRosto(pontos: Ponto[] | undefined, expressoes: Expressao[] = []): LeituraRosto {
  if (!pontos || pontos.length <= BOCHECHA_DIR) return { rosto: false, olhando: false, sorrindo: false };

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

  return { rosto: true, olhando, sorrindo: sorriso >= LIMITE_SORRISO };
}

// ── Contas por pessoa ──────────────────────────────────────────────────────

/** Uma leitura por segundo. Câmera desligada não entra na conta. */
export interface Amostra extends LeituraRosto {
  em: number; // Date.now()
}

export interface Resumo {
  atencao: number; // % das leituras olhando para a tela
  sorriso: number; // % das leituras sorrindo
  semRosto: number; // % das leituras sem rosto na câmera
  amostras: number;
}

export function resume(amostras: Amostra[]): Resumo {
  const n = amostras.length;
  if (n === 0) return { atencao: 0, sorriso: 0, semRosto: 0, amostras: 0 };
  const pct = (k: number) => Math.round((k / n) * 100);
  return {
    atencao: pct(amostras.filter((a) => a.olhando).length),
    sorriso: pct(amostras.filter((a) => a.sorrindo).length),
    semRosto: pct(amostras.filter((a) => !a.rosto).length),
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

/** Frase curta para o Coach: "Mariana: atenção 45%, sorriu 10% (último minuto)". */
export function resumoParaCoach(pessoas: { nome: string; recentes: Amostra[] }[]): string {
  return pessoas
    .filter((p) => p.recentes.length > 0)
    .map((p) => {
      const r = resume(p.recentes);
      if (r.semRosto >= 60) return `${p.nome}: fora da câmera`;
      return `${p.nome}: atenção ${r.atencao}%, sorriu ${r.sorriso}%`;
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
