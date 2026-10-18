import { describe, expect, it, vi } from 'vitest';

// salas.ts importa o cliente do Supabase; aqui só testamos as contas, sem banco.
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { duracaoMin, estaEsquecida, linkGoogleAgenda, situacao, type Sala } from './salas';

const H = 60 * 60 * 1000;
const agora = new Date('2026-10-21T20:00:00Z').getTime();

const base: Sala = {
  id: '1',
  slug: 'abcde23456',
  titulo: 'Reunião de diagnóstico',
  lead_nome: 'Mariana Alves',
  lead_email: 'mariana@empresa.com.br',
  sdr: 'Carlos',
  origem: 'Tráfego Pago',
  inicio: new Date(agora).toISOString(),
  duracao_min: 60,
  status: 'agendada',
  gravar: true,
  entrou_em: null,
  encerrada_em: null,
  lead_entrou: false,
  observacoes: null,
  created_at: new Date(agora).toISOString(),
};

describe('situacao', () => {
  it('agendada no futuro continua agendada', () => {
    expect(situacao({ ...base, inicio: new Date(agora + 2 * H).toISOString() }, agora)).toBe('agendada');
  });

  it('agendada que passou da janela sem ninguém entrar não aconteceu', () => {
    expect(situacao({ ...base, inicio: new Date(agora - 5 * H).toISOString() }, agora)).toBe('nao_aconteceu');
  });

  it('dentro da janela ainda dá tempo: segue agendada', () => {
    expect(situacao({ ...base, inicio: new Date(agora - 3 * H).toISOString() }, agora)).toBe('agendada');
  });

  it('encerrada e cancelada não mudam com o tempo', () => {
    const antiga = new Date(agora - 48 * H).toISOString();
    expect(situacao({ ...base, inicio: antiga, status: 'encerrada' }, agora)).toBe('encerrada');
    expect(situacao({ ...base, inicio: antiga, status: 'cancelada' }, agora)).toBe('cancelada');
  });
});

describe('estaEsquecida', () => {
  it('ao vivo muito além do previsto (fim + 1 h) é esquecida', () => {
    const entrou = new Date(agora - 2.5 * H).toISOString(); // 60 min previstos + 1 h de folga = 2 h
    expect(estaEsquecida({ ...base, status: 'ao_vivo', entrou_em: entrou }, agora)).toBe(true);
  });

  it('reunião que só se estendeu um pouco não é fechada', () => {
    const entrou = new Date(agora - 1.5 * H).toISOString();
    expect(estaEsquecida({ ...base, status: 'ao_vivo', entrou_em: entrou }, agora)).toBe(false);
  });

  it('só vale para reunião ao vivo', () => {
    const entrou = new Date(agora - 10 * H).toISOString();
    expect(estaEsquecida({ ...base, status: 'encerrada', entrou_em: entrou }, agora)).toBe(false);
  });
});

describe('duracaoMin', () => {
  it('conta do primeiro a entrar até o fim', () => {
    expect(duracaoMin({
      ...base,
      entrou_em: '2026-10-21T17:00:00Z',
      encerrada_em: '2026-10-21T17:42:20Z',
    })).toBe(42);
  });

  it('sem hora de fim (sala esquecida) não inventa número', () => {
    expect(duracaoMin({ ...base, entrou_em: '2026-10-21T17:00:00Z', encerrada_em: null })).toBeNull();
  });
});

describe('linkGoogleAgenda', () => {
  const sala = { ...base, inicio: '2026-10-21T17:30:00.000Z', duracao_min: 45 };
  const url = new URL(linkGoogleAgenda(sala));
  const p = url.searchParams;

  it('abre o Google Agenda no modo de criar evento', () => {
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(p.get('action')).toBe('TEMPLATE');
  });

  it('usa o horário em UTC (Z), que o Google converte para o fuso de cada um', () => {
    expect(p.get('dates')).toBe('20261021T173000Z/20261021T181500Z');
  });

  it('põe o lead como convidado e o link da nossa sala', () => {
    expect(p.get('add')).toBe('mariana@empresa.com.br');
    expect(p.get('location')).toContain('/sala/abcde23456');
    expect(p.get('details')).toContain('/sala/abcde23456');
    expect(p.get('details')).toContain('mariana@empresa.com.br');
  });

  it('título com o nome da RT', () => {
    expect(p.get('text')).toBe('Reunião de diagnóstico — Reproduzindo Talentos');
  });
});
