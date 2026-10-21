import { describe, expect, it } from 'vitest';
import {
  ALERTA_MONOLOGO_MS, MONOLOGO_INICIAL, avancaMonologo, duracaoMonologo, tempoFalado, textoDoAlerta,
  type EstadoMonologo,
} from './monologo';

/** Roda segundo a segundo: "C" = closer fala, "L" = cliente fala, "." = silêncio. */
function roda(roteiro: string, inicio = MONOLOGO_INICIAL): EstadoMonologo {
  let e = inicio;
  [...roteiro].forEach((c, i) => {
    e = avancaMonologo(e, i * 1000, c === 'C', c === 'L');
  });
  return e;
}

describe('monólogo', () => {
  it('conta o tempo que o closer fala sozinho', () => {
    expect(duracaoMonologo(roda('CCCCCC'))).toBe(5000);
  });

  it('respirar entre frases não zera', () => {
    expect(duracaoMonologo(roda('CCC...CCC'))).toBe(8000);
  });

  it('o cliente falar zera', () => {
    expect(duracaoMonologo(roda('CCCCCLCC'))).toBe(1000);
  });

  it('ficar calado um tempo (devolveu a palavra) zera', () => {
    expect(duracaoMonologo(roda('CCC' + '.'.repeat(10)))).toBe(0);
  });

  it('o alerta sai em 2 minutos', () => {
    expect(ALERTA_MONOLOGO_MS).toBe(120_000);
    expect(duracaoMonologo(roda('C'.repeat(121)))).toBeGreaterThanOrEqual(ALERTA_MONOLOGO_MS);
  });
});

describe('texto do alerta', () => {
  it('tempo em palavras', () => {
    expect(tempoFalado(45_000)).toBe('45 segundos');
    expect(tempoFalado(60_000)).toBe('1 minuto');
    expect(tempoFalado(150_000)).toBe('2 minutos e meio');
  });

  it('junta o que o rosto do cliente mostra', () => {
    expect(textoDoAlerta(240_000, { nome: 'Mariana', atencao: 31, acenou: false })).toBe(
      'Você está falando há 4 minutos seguidos. A atenção de Mariana caiu para 31% e não houve nenhum sinal de concordância.',
    );
    expect(textoDoAlerta(120_000, { nome: 'Mariana', atencao: 80, acenou: true })).toBe(
      'Você está falando há 2 minutos seguidos. Mariana ainda está atento — mas devolva a palavra.',
    );
    expect(textoDoAlerta(120_000)).toBe('Você está falando há 2 minutos seguidos. Faça uma pergunta e devolva a palavra.');
  });
});
