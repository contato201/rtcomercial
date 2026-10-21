/**
 * Caneta laser na tela compartilhada (como a do Google Meet).
 *
 * Quem liga a caneta arrasta o mouse em cima da tela compartilhada e o risco
 * aparece para todo mundo, sumindo sozinho em menos de 2 segundos. Os pontos
 * viajam pelo canal de dados do LiveKit (sem servidor nosso, sem custo) em
 * coordenadas de 0 a 1 em relação à IMAGEM compartilhada — assim o risco cai
 * no mesmo lugar em telas de tamanhos diferentes, mesmo com as faixas pretas
 * que aparecem quando a proporção da tela não bate com a da janela.
 */

export const TOPICO_CANETA = 'rt-caneta';
/** Quanto tempo o risco fica na tela até sumir. */
export const VIDA_DO_RISCO_MS = 1800;
const MAX_PONTOS_POR_MENSAGEM = 120;

export interface Caixa { x: number; y: number; w: number; h: number }

/**
 * Onde a imagem realmente aparece dentro do elemento de vídeo (que usa
 * "contain": a imagem inteira, com faixas pretas sobrando de um lado).
 */
export function areaDaImagem(elemento: { w: number; h: number }, video: { w: number; h: number }): Caixa {
  if (!video.w || !video.h || !elemento.w || !elemento.h) return { x: 0, y: 0, w: elemento.w, h: elemento.h };
  const escala = Math.min(elemento.w / video.w, elemento.h / video.h);
  const w = video.w * escala;
  const h = video.h * escala;
  return { x: (elemento.w - w) / 2, y: (elemento.h - h) / 2, w, h };
}

/** Ponto na tela (pixels) → ponto na imagem (0 a 1). Fora da imagem = null. */
export function paraImagem(px: number, py: number, area: Caixa): [number, number] | null {
  const x = (px - area.x) / area.w;
  const y = (py - area.y) / area.h;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return [x, y];
}

/** Ponto na imagem (0 a 1) → pixels nesta tela. */
export const daImagem = ([x, y]: [number, number], area: Caixa): [number, number] => [
  area.x + x * area.w,
  area.y + y * area.h,
];

/** 1 = acabou de ser desenhado; 0 = sumiu. */
export const opacidade = (idadeMs: number, vida = VIDA_DO_RISCO_MS) =>
  Math.max(0, Math.min(1, 1 - idadeMs / vida));

/** Cada pessoa risca com uma cor (dá para saber quem está apontando). */
export const CORES_DA_CANETA = ['#FF3B30', '#FFCC00', '#34C759', '#0A84FF', '#FF2D92', '#AF52DE'];
export const corDaPessoa = (identidade: string) =>
  CORES_DA_CANETA[[...identidade].reduce((t, c) => t + c.charCodeAt(0), 0) % CORES_DA_CANETA.length];

/** Um pedaço de risco mandado pela rede. `traco` junta pedaços do mesmo arrasto. */
export interface PedacoDeRisco {
  traco: string;
  cor: string;
  pontos: Array<[number, number]>;
}

export const codifica = (p: PedacoDeRisco) =>
  new TextEncoder().encode(JSON.stringify({ t: p.traco, c: p.cor, p: p.pontos.slice(0, MAX_PONTOS_POR_MENSAGEM) }));

/** Lê o que chegou pela rede, descartando qualquer coisa fora do formato. */
export function decodifica(bytes: Uint8Array): PedacoDeRisco | null {
  try {
    const m = JSON.parse(new TextDecoder().decode(bytes)) as { t?: unknown; c?: unknown; p?: unknown };
    if (typeof m.t !== 'string' || m.t.length > 64) return null;
    if (typeof m.c !== 'string' || !CORES_DA_CANETA.includes(m.c)) return null;
    if (!Array.isArray(m.p)) return null;
    const pontos = m.p
      .slice(0, MAX_PONTOS_POR_MENSAGEM)
      .filter((q): q is [number, number] =>
        Array.isArray(q) && q.length === 2 && q.every((n) => typeof n === 'number' && n >= 0 && n <= 1));
    return pontos.length ? { traco: m.t, cor: m.c, pontos } : null;
  } catch {
    return null;
  }
}
