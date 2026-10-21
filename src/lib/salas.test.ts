import { describe, expect, it, vi } from 'vitest';

// salas.ts importa o cliente do Supabase; aqui não tem banco nem rede: o
// porteiro é falso e responde o que cada teste mandar.
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));

import {
  consultaPedido, duracaoMin, entraNaSala, estaEsquecida, linkGoogleAgenda, pedeCracha, separaEmails,
  situacao, type Sala,
} from './salas';

/** O porteiro recusando, do jeito que o Supabase entrega: erro com a resposta em `context`. */
const recusa = (status: number, corpo: object) => ({
  data: null,
  error: { name: 'FunctionsHttpError', context: new Response(JSON.stringify(corpo), { status }) },
});

describe('quando o porteiro recusa a entrada', () => {
  it('e-mail errado: diz que o e-mail não é o do convite (não "tente de novo")', async () => {
    invoke.mockResolvedValueOnce(recusa(403, { ok: false, erro: 'email_nao_confere' }));
    await expect(pedeCracha({ slug: 'cfd653tc8e', email: 'outro@gmail.com' }))
      .rejects.toThrow('não é o do convite');
  });

  it('cedo demais: diz a hora em que a sala abre', async () => {
    invoke.mockResolvedValueOnce(recusa(403, {
      ok: false, erro: 'fora_do_horario', inicio: '2026-10-21T17:30:00Z',
    }));
    const hora = new Date('2026-10-21T17:00:00Z')
      .toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    await expect(pedeCracha({ slug: 'x', email: 'a@b.com' })).rejects.toThrow(`abre às ${hora}`);
  });

  it('sala que não existe mais', async () => {
    invoke.mockResolvedValueOnce(recusa(404, { ok: false, erro: 'sala_nao_encontrada' }));
    await expect(pedeCracha({ slug: 'x' })).rejects.toThrow('não existe mais');
  });

  it('só cai no recado genérico quando não dá para saber o motivo', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new Error('rede caiu') });
    await expect(pedeCracha({ slug: 'x' })).rejects.toThrow('Tente de novo');
  });
});

const H = 60 * 60 * 1000;
const agora = new Date('2026-10-21T20:00:00Z').getTime();

const base: Sala = {
  id: '1',
  slug: 'abcde23456',
  titulo: 'Reunião de diagnóstico',
  lead_nome: 'Mariana Alves',
  lead_email: 'mariana@empresa.com.br',
  sdr: 'Nicoly',
  closer: 'Carlos',
  convidados: [],
  acesso: 'espera',
  instantanea: false,
  consentimento_em: null,
  abordagem: null,
  tipo_reuniao: 1,
  notas_sdr: null,
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
  });

  it('convida também os outros convidados, e diz com quem é a reunião', () => {
    const u = new URL(linkGoogleAgenda({ ...sala, convidados: ['socio@empresa.com.br'] }));
    expect(u.searchParams.get('add')).toBe('mariana@empresa.com.br,socio@empresa.com.br');
    expect(u.searchParams.get('details')).toContain('Reunião com Carlos');
  });

  it('nada interno vai no convite: nem origem, nem SDR', () => {
    const detalhes = p.get('details') ?? '';
    expect(detalhes).not.toContain('Tráfego Pago');
    expect(detalhes).not.toContain('Nicoly');
  });

  it('título com o nome da RT', () => {
    expect(p.get('text')).toBe('Reunião de diagnóstico — Reproduzindo Talentos');
  });
});

describe('separaEmails', () => {
  it('aceita vírgula, ponto e vírgula ou espaço, e ignora o que não é e-mail', () => {
    expect(separaEmails('A@b.com, c@d.com.br; lixo  e@f.com')).toEqual(['a@b.com', 'c@d.com.br', 'e@f.com']);
  });
  it('não repete', () => {
    expect(separaEmails('a@b.com a@b.com')).toEqual(['a@b.com']);
  });
});

describe('sala de espera', () => {
  it('quem não foi convidado vira um pedido, com a chave para acompanhar', async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true, aguardando: true, pedido: { id: 'p1', chave: 'k1' } }, error: null });
    const r = await entraNaSala({ slug: 'x', nome: 'Sócio', email: 'socio@x.com' });
    expect(r).toEqual({ tipo: 'esperando', pedido: { id: 'p1', chave: 'k1' } });
  });

  it('enquanto o anfitrião não decide, continua esperando', async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true, aguardando: true }, error: null });
    const r = await consultaPedido({ id: 'p1', chave: 'k1' });
    expect(r.tipo).toBe('esperando');
  });

  it('aceito: recebe o crachá e entra', async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true, token: 't', url: 'wss://x', papel: 'convidado', sala: {} }, error: null });
    const r = await consultaPedido({ id: 'p1', chave: 'k1' });
    expect(r.tipo).toBe('entrou');
  });

  it('recusado: diz que o anfitrião não aceitou', async () => {
    invoke.mockResolvedValueOnce(recusa(403, { ok: false, erro: 'pedido_recusado' }));
    await expect(consultaPedido({ id: 'p1', chave: 'k1' })).rejects.toThrow('não aceitou');
  });

  it('o consentimento da LGPD vai junto para o porteiro', async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true, token: 't', url: 'u', papel: 'lead', sala: {} }, error: null });
    await entraNaSala({ slug: 'x', email: 'a@b.com', consentiu: true });
    expect(invoke).toHaveBeenLastCalledWith('sala-token', { body: expect.objectContaining({ consentiu: true }) });
  });
});
