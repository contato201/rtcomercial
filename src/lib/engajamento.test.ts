import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import {
  contaAcenos, inicioDaQueda, leRosto, porMinuto, resume, resumoParaCoach, sinaisDoLead, situacaoAgora,
  tendencia, ultimas, type Amostra, type Expressao, type Ponto,
} from './engajamento';

/** Monta um rosto de mentira: só os 5 pontos que a conta usa importam. */
function rosto(opts: { narizX?: number; narizY?: number } = {}): Ponto[] {
  const pontos: Ponto[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  pontos[1] = { x: opts.narizX ?? 0.5, y: opts.narizY ?? 0.5 }; // nariz
  pontos[10] = { x: 0.5, y: 0.2 }; // testa
  pontos[152] = { x: 0.5, y: 0.8 }; // queixo
  pontos[234] = { x: 0.3, y: 0.5 }; // bochecha esquerda
  pontos[454] = { x: 0.7, y: 0.5 }; // bochecha direita
  return pontos;
}
const exp = (nomes: Record<string, number>): Expressao[] =>
  Object.entries(nomes).map(([categoryName, score]) => ({ categoryName, score }));

const amostra = (em: number, a: Partial<Amostra> = {}): Amostra => ({
  em, rosto: true, olhando: true, sorrindo: false, tenso: false, inclinacao: 0.5, ...a,
});

describe('leRosto', () => {
  it('sem rosto na câmera', () => {
    const nada = { rosto: false, olhando: false, sorrindo: false, tenso: false, inclinacao: null };
    expect(leRosto(undefined)).toEqual(nada);
    expect(leRosto([])).toEqual(nada);
  });

  it('de frente e de olhos abertos = olhando', () => {
    expect(leRosto(rosto())).toEqual({
      rosto: true, olhando: true, sorrindo: false, tenso: false, inclinacao: expect.closeTo(0.5, 5),
    });
  });

  it('cabeça virada para o lado = não está olhando', () => {
    expect(leRosto(rosto({ narizX: 0.66 })).olhando).toBe(false);
  });

  it('cabeça baixa (celular) = não está olhando', () => {
    expect(leRosto(rosto({ narizY: 0.7 })).olhando).toBe(false);
  });

  it('olhos fechados ou olhar desviado = não está olhando', () => {
    expect(leRosto(rosto(), exp({ eyeBlinkLeft: 0.9, eyeBlinkRight: 0.9 })).olhando).toBe(false);
    expect(leRosto(rosto(), exp({ eyeLookOutLeft: 0.8 })).olhando).toBe(false);
    expect(leRosto(rosto(), exp({ eyeLookDownLeft: 0.7, eyeLookDownRight: 0.7 })).olhando).toBe(false);
  });

  it('sobrancelha contraída = tensão', () => {
    expect(leRosto(rosto(), exp({ browDownLeft: 0.6, browDownRight: 0.5 })).tenso).toBe(true);
    expect(leRosto(rosto(), exp({ browDownLeft: 0.1 })).tenso).toBe(false);
  });

  it('sorriso', () => {
    expect(leRosto(rosto(), exp({ mouthSmileLeft: 0.7, mouthSmileRight: 0.6 })).sorrindo).toBe(true);
    expect(leRosto(rosto(), exp({ mouthSmileLeft: 0.2, mouthSmileRight: 0.1 })).sorrindo).toBe(false);
  });
});

describe('contas', () => {
  it('resume em porcentagem', () => {
    const r = resume([
      amostra(1), amostra(2), amostra(3, { olhando: false }), amostra(4, { sorrindo: true }),
    ]);
    expect(r).toEqual({ atencao: 75, sorriso: 25, semRosto: 0, tensao: 0, amostras: 4 });
    expect(resume([])).toEqual({ atencao: 0, sorriso: 0, semRosto: 0, tensao: 0, amostras: 0 });
  });

  it('últimas só pega o último minuto', () => {
    expect(ultimas([amostra(0), amostra(50_000), amostra(100_000)], 100_000)).toHaveLength(2);
  });

  it('situação do momento', () => {
    expect(situacaoAgora([])).toBe('sem_dado');
    expect(situacaoAgora([amostra(1, { rosto: false, olhando: false })])).toBe('sem_rosto');
    expect(situacaoAgora([amostra(1, { olhando: false }), amostra(2, { olhando: false }), amostra(3)])).toBe('distraido');
    expect(situacaoAgora([amostra(1, { sorrindo: true }), amostra(2)])).toBe('sorrindo');
    expect(situacaoAgora([amostra(1), amostra(2)])).toBe('atento');
  });

  it('junta por minuto da reunião', () => {
    const linhas = porMinuto('s1', 'Mariana', [
      amostra(1_000), amostra(30_000, { olhando: false }), amostra(61_000, { sorrindo: true }),
    ], 0);
    expect(linhas).toEqual([
      { sala_id: 's1', quem: 'Mariana', minuto: 0, atencao: 50, sorriso: 0, amostras: 2 },
      { sala_id: 's1', quem: 'Mariana', minuto: 1, atencao: 100, sorriso: 100, amostras: 1 },
    ]);
  });

  it('frase para o Coach', () => {
    expect(resumoParaCoach([
      { nome: 'Mariana', recentes: [amostra(1), amostra(2, { olhando: false })], tendencia: -27 },
      { nome: 'Pedro', recentes: [amostra(1, { rosto: false, olhando: false })] },
      { nome: 'Ana', recentes: [] },
    ])).toBe('Mariana: atenção 50% (caiu 27 pts em 3 min), sorriu 0%; Pedro: fora da câmera');
  });
});

/** Série de 4 leituras por segundo com a inclinação que a função devolver. */
const serie = (segundos: number, inc: (t: number) => number, extra: Partial<Amostra> = {}) =>
  Array.from({ length: segundos * 4 }, (_, i) => amostra(i * 250, { inclinacao: inc(i * 250), ...extra }));

describe('aceno, tendência e sinais', () => {
  it('cabeça parada não é aceno', () => {
    expect(contaAcenos(serie(10, () => 0.5))).toBe(0);
  });

  it('conta dois acenos (desce e volta) separados', () => {
    const inc = (t: number) => (Math.abs(t - 2000) <= 250 || Math.abs(t - 6000) <= 250 ? 0.56 : 0.5);
    expect(contaAcenos(serie(10, inc))).toBe(2);
  });

  it('abaixar a cabeça e ficar assim (olhar o celular) não é aceno', () => {
    expect(contaAcenos(serie(10, (t) => (t > 3000 ? 0.6 : 0.5)))).toBe(0);
  });

  it('tendência compara o último minuto com 3 min atrás', () => {
    const agora = 300_000;
    const antes = Array.from({ length: 30 }, (_, i) => amostra(70_000 + i * 1000));
    const depois = Array.from({ length: 30 }, (_, i) => amostra(250_000 + i * 1000, { olhando: i < 9 }));
    expect(tendencia([...antes, ...depois], agora)).toBe(-70);
    expect(tendencia(depois, agora)).toBeNull();
  });

  it('sinais com nome', () => {
    const neutro = serie(60, () => 0.5);
    expect(sinaisDoLead(neutro).map((s) => s.texto)).toEqual(['Nenhum aceno no último minuto', 'Expressão neutra sustentada']);
    const tenso = serie(60, () => 0.5, { tenso: true, olhando: false });
    expect(sinaisDoLead(tenso).map((s) => s.texto)).toEqual([
      'Olhar desviando da tela', 'Sobrancelhas contraídas (tensão)', 'Nenhum aceno no último minuto',
    ]);
    const bom = serie(60, (t) => (Math.abs(t - 5000) <= 250 ? 0.56 : 0.5), { sorrindo: true });
    expect(sinaisDoLead(bom)).toEqual([{ texto: 'Acenou 1x (concordância)', bom: true }, { texto: 'Sorriu', bom: true }]);
    expect(sinaisDoLead([amostra(1)])).toEqual([]);
  });

  it('início da queda', () => {
    expect(inicioDaQueda([{ minuto: 0, atencao: 80 }, { minuto: 1, atencao: 70 }, { minuto: 2, atencao: 45 }, { minuto: 3, atencao: 31 }])).toBe(2);
    expect(inicioDaQueda([{ minuto: 0, atencao: 80 }, { minuto: 1, atencao: 75 }])).toBeNull();
  });
});
