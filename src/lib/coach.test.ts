import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import {
  aplicaResposta, dinheiroParado, estadoInicial, falaDoCloserPct, numeroDoTexto, quemGrava, resumoParaCoach,
  type RespostaCoach, type Trecho,
} from './coach';

const resposta = (extra: Partial<RespostaCoach> = {}): RespostaCoach => ({
  bloco_atual: 'Descoberta',
  ficha: [],
  dica: { nivel: 'nenhuma', texto: '', motivo: '' },
  pendencias_novas: [],
  citacoes_fortes: [],
  spin_novas: { situacao: 0, problema: 0, implicacao: 0, necessidade: 0 },
  termometro: 50,
  ...extra,
});
const dica = (nivel: 'critico' | 'atencao' | 'sugestao', texto: string) =>
  resposta({ dica: { nivel, texto, motivo: 'teste' } });

describe('roteiro', () => {
  it('aceita só um bloco que existe no roteiro da reunião', () => {
    const e = aplicaResposta(estadoInicial(), resposta({ bloco_atual: 'Descoberta' }), 5, 1);
    expect(e.bloco).toBe('Descoberta');
    // "Investimento" é da reunião 2, não da 1: mantém o anterior.
    expect(aplicaResposta(e, resposta({ bloco_atual: 'Investimento' }), 6, 1).bloco).toBe('Descoberta');
  });
});

describe('ficha', () => {
  it('guarda o valor, de onde veio e o minuto', () => {
    const e = aplicaResposta(estadoInicial(), resposta({ ficha: [{ campo: 'ticket', valor: 'R$ 800', fonte: 'cliente' }] }), 12, 1);
    expect(e.ficha.ticket).toEqual({ valor: 'R$ 800', fonte: 'cliente', minuto: 12 });
  });

  it('valor vazio não apaga o que já se sabia (não inventar, não esquecer)', () => {
    let e = aplicaResposta(estadoInicial(), resposta({ ficha: [{ campo: 'alunos', valor: '102', fonte: 'cliente' }] }), 10, 1);
    e = aplicaResposta(e, resposta({ ficha: [{ campo: 'alunos', valor: '  ', fonte: 'cliente' }] }), 11, 1);
    expect(e.ficha.alunos.valor).toBe('102');
  });

  it('ignora campo que não existe na ficha', () => {
    const e = aplicaResposta(estadoInicial(), resposta({ ficha: [{ campo: 'cor_favorita', valor: 'azul', fonte: 'cliente' }] }), 3, 1);
    expect(e.ficha).toEqual({});
  });
});

describe('dicas (seção 5 do processo)', () => {
  it('"nenhuma" não vira cartão', () => {
    expect(aplicaResposta(estadoInicial(), resposta(), 4, 1).dicas).toHaveLength(0);
  });

  it('no máximo uma dica por minuto', () => {
    let e = aplicaResposta(estadoInicial(), dica('atencao', 'Pergunte a mensalidade média.'), 10, 1);
    e = aplicaResposta(e, dica('sugestao', 'Use a frase dela depois.'), 10, 1);
    expect(e.dicas).toHaveLength(1);
  });

  it('alerta vermelho fura a fila', () => {
    let e = aplicaResposta(estadoInicial(), dica('atencao', 'Pergunte a mensalidade média.'), 10, 1);
    e = aplicaResposta(e, dica('critico', 'Conta certa: R$ 12 a 18 mil.'), 10, 1);
    expect(e.dicas.map((d) => d.nivel)).toEqual(['critico', 'atencao']);
  });

  it('não repete a mesma dica em menos de 5 minutos', () => {
    let e = aplicaResposta(estadoInicial(), dica('atencao', 'Você fala há 5 min. Faça uma pergunta.'), 10, 1);
    e = aplicaResposta(e, dica('atencao', 'você fala há 5 min. faça uma pergunta.'), 13, 1);
    expect(e.dicas).toHaveLength(1);
    e = aplicaResposta(e, dica('atencao', 'Você fala há 5 min. Faça uma pergunta.'), 16, 1);
    expect(e.dicas).toHaveLength(2);
  });
});

describe('pendências, citações, SPIN e termômetro', () => {
  it('pendências não repetem', () => {
    let e = aplicaResposta(estadoInicial(), resposta({ pendencias_novas: ['Enviar preço do Meta'] }), 5, 1);
    e = aplicaResposta(e, resposta({ pendencias_novas: ['enviar preço do meta', 'Mandar case de creche'] }), 6, 1);
    expect(e.pendencias).toEqual(['Enviar preço do Meta', 'Mandar case de creche']);
  });

  it('o placar do SPIN soma, e número estranho não estraga a conta', () => {
    let e = aplicaResposta(estadoInicial(), resposta({ spin_novas: { situacao: 3, problema: 1, implicacao: 0, necessidade: 0 } }), 5, 1);
    e = aplicaResposta(e, resposta({ spin_novas: { situacao: 1, problema: -2, implicacao: 1.6, necessidade: 0 } }), 6, 1);
    expect(e.spin).toEqual({ situacao: 4, problema: 1, implicacao: 2, necessidade: 0 });
  });

  it('termômetro fica entre 0 e 100', () => {
    expect(aplicaResposta(estadoInicial(), resposta({ termometro: 140 }), 1, 1).termometro).toBe(100);
    expect(aplicaResposta(estadoInicial(), resposta({ termometro: -3 }), 1, 1).termometro).toBe(0);
  });
});

describe('o que vai para o Claude', () => {
  it('diz o que falta da prioridade 1', () => {
    const e = aplicaResposta(estadoInicial(), resposta({ ficha: [{ campo: 'ticket', valor: 'R$ 800', fonte: 'cliente' }] }), 5, 1);
    const r = resumoParaCoach(e);
    expect(r.faltando_prioridade_1).not.toContain('ticket');
    expect(r.faltando_prioridade_1).toContain('verba');
    expect(r.ficha.ticket).toBe('R$ 800 (cliente)');
  });
});

describe('tempo de fala e quem grava', () => {
  const t = (papel: string, texto: string): Trecho => ({ id: texto, identidade: papel, quem: papel, papel, texto, falado_em: 0 });

  it('calcula a fala do closer pelo tamanho do texto', () => {
    expect(falaDoCloserPct([t('anfitriao', 'x'.repeat(70)), t('lead', 'y'.repeat(30))])).toBe(70);
    expect(falaDoCloserPct([])).toBe(0);
  });

  it('com dois anfitriões, todos escolhem o mesmo para gravar', () => {
    expect(quemGrava(['anfitriao-b2', 'anfitriao-a1'])).toBe('anfitriao-a1');
    expect(quemGrava([])).toBeNull();
  });
});

describe('teleprompter (inspirado no Abracadabra Meet)', () => {
  const orient = (fala: string, extra: Partial<NonNullable<RespostaCoach['orientacao']>> = {}) =>
    resposta({ orientacao: { fala_sugerida: fala, proximo_passo: '', evite_agora: '', risco: '', ...extra } });

  it('guarda a fala pronta, o próximo passo, o que evitar e o risco, com o minuto', () => {
    const e = aplicaResposta(estadoInicial(), orient('Deixa eu parar um segundo. Quanto tempo leva para responder um pai?', {
      proximo_passo: 'Volte para o funil', evite_agora: 'Não fale de preço', risco: 'Mantenedor decide',
    }), 14, 1);
    expect(e.orientacao).toEqual({
      fala: 'Deixa eu parar um segundo. Quanto tempo leva para responder um pai?',
      proximo_passo: 'Volte para o funil', evite: 'Não fale de preço', risco: 'Mantenedor decide', minuto: 14,
    });
  });

  it('resposta toda vazia mantém o teleprompter anterior', () => {
    const e = aplicaResposta(estadoInicial(), orient('Pergunta boa?'), 10, 1);
    expect(aplicaResposta(e, orient('  '), 11, 1).orientacao?.fala).toBe('Pergunta boa?');
  });
});

describe('dinheiro parado', () => {
  const ficha = (campos: Record<string, string>) =>
    Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, { valor: v, fonte: 'cliente' as const, minuto: 1 }]));

  it('lê número do jeito que a gente fala', () => {
    expect(numeroDoTexto('R$ 1.250,00')).toBe(1250);
    expect(numeroDoTexto('320 alunos')).toBe(320);
    expect(numeroDoTexto('uns 1,5 mil')).toBe(1500);
    expect(numeroDoTexto('R$ 850')).toBe(850);
    expect(numeroDoTexto('não sabe')).toBeNull();
  });

  it('capacidade total: desconta os alunos de hoje', () => {
    expect(dinheiroParado(ficha({ alunos: '320', capacidade: 'cabe 400', ticket: 'R$ 850' })))
      .toEqual({ vagas: 80, ticket: 850, anual: 816000 });
  });

  it('vagas ociosas ditas direto: usa o número como está', () => {
    expect(dinheiroParado(ficha({ capacidade: '60 vagas ociosas', ticket: 'R$ 1.000' })))
      .toEqual({ vagas: 60, ticket: 1000, anual: 720000 });
  });

  it('sem ticket ou sem como saber as vagas, não inventa', () => {
    expect(dinheiroParado(ficha({ alunos: '320', capacidade: '400' }))).toBeNull();
    expect(dinheiroParado(ficha({ capacidade: '400', ticket: 'R$ 850' }))).toBeNull();
    expect(dinheiroParado(ficha({ alunos: '420', capacidade: '400', ticket: 'R$ 850' }))).toBeNull();
  });
});
