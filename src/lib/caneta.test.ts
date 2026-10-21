import { describe, expect, it } from 'vitest';
import {
  CORES_DA_CANETA, areaDaImagem, codifica, corDaPessoa, daImagem, decodifica, opacidade, paraImagem,
} from './caneta';

describe('posição da caneta', () => {
  it('tela 16:9 numa janela mais alta: faixas em cima e embaixo', () => {
    expect(areaDaImagem({ w: 1600, h: 1200 }, { w: 1920, h: 1080 })).toEqual({ x: 0, y: 150, w: 1600, h: 900 });
  });

  it('tela 4:3 numa janela larga: faixas dos lados', () => {
    expect(areaDaImagem({ w: 1600, h: 900 }, { w: 1024, h: 768 })).toEqual({ x: 200, y: 0, w: 1200, h: 900 });
  });

  it('o mesmo ponto cai no mesmo lugar da imagem em telas diferentes', () => {
    const minha = areaDaImagem({ w: 1600, h: 1200 }, { w: 1920, h: 1080 });
    const dele = areaDaImagem({ w: 800, h: 450 }, { w: 1920, h: 1080 });
    const p = paraImagem(800, 600, minha)!; // centro da minha tela
    expect(p).toEqual([0.5, 0.5]);
    expect(daImagem(p, dele)).toEqual([400, 225]); // centro da tela dele
  });

  it('clique na faixa preta não conta', () => {
    const area = areaDaImagem({ w: 1600, h: 1200 }, { w: 1920, h: 1080 });
    expect(paraImagem(800, 50, area)).toBeNull();
  });
});

describe('sumiço e cor', () => {
  it('o risco some sozinho', () => {
    expect(opacidade(0)).toBe(1);
    expect(opacidade(900)).toBe(0.5);
    expect(opacidade(5000)).toBe(0);
  });

  it('cada pessoa tem uma cor fixa', () => {
    expect(corDaPessoa('anfitriao-ab12')).toBe(corDaPessoa('anfitriao-ab12'));
    expect(CORES_DA_CANETA).toContain(corDaPessoa('lead-x'));
  });
});

describe('mensagem pela rede', () => {
  it('ida e volta', () => {
    const pedaco = { traco: 't1', cor: CORES_DA_CANETA[0], pontos: [[0.1, 0.2], [0.3, 0.4]] as Array<[number, number]> };
    expect(decodifica(codifica(pedaco))).toEqual(pedaco);
  });

  it('descarta mensagem estranha', () => {
    const enc = (o: unknown) => new TextEncoder().encode(JSON.stringify(o));
    expect(decodifica(new TextEncoder().encode('lixo'))).toBeNull();
    expect(decodifica(enc({ t: 't', c: '#000000', p: [[0.1, 0.1]] }))).toBeNull(); // cor fora da lista
    expect(decodifica(enc({ t: 't', c: CORES_DA_CANETA[0], p: [[2, 0.1]] }))).toBeNull(); // fora da imagem
  });
});
