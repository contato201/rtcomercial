import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import {
  FILTROS_PADRAO, agrupaFalas, closersDoArquivo, filtraArquivo, montaArquivo, numerosDoArquivo,
  tempoDaFala, transcricaoComoTexto, type Fala, type ResumoReuniao,
} from './arquivo';
import type { Sala } from './salas';

const AGORA = new Date('2026-10-20T12:00:00Z').getTime();
const diasAtras = (d: number) => new Date(AGORA - d * 86_400_000).toISOString();

const sala = (extra: Partial<Sala> = {}): Sala => ({
  id: 's1', slug: 'abc', titulo: 'Reunião de diagnóstico', lead_nome: 'Mariana Alves',
  lead_email: 'mariana@escola.com.br', sdr: 'Rafael', closer: 'Allan', convidados: [], acesso: 'espera',
  instantanea: false, consentimento_em: null, tipo_reuniao: 1, notas_sdr: null, origem: 'Instagram',
  inicio: diasAtras(2), duracao_min: 60, status: 'encerrada', gravar: false,
  entrou_em: diasAtras(2), encerrada_em: new Date(new Date(diasAtras(2)).getTime() + 40 * 60_000).toISOString(),
  lead_entrou: true, observacoes: null, created_at: diasAtras(3), ...extra,
});
const resumo = (salaId: string, extra: Partial<ResumoReuniao> = {}): ResumoReuniao => ({
  sala_id: salaId, falas: 0, gravacoes: 0, segundos_gravados: 0, atencao_media: null, nota: null,
  tem_relatorio: false, ...extra,
});

describe('montaArquivo', () => {
  it('só entra o que já aconteceu ou tem algo guardado, mais recente primeiro', () => {
    const itens = montaArquivo([
      sala({ id: 'a', inicio: diasAtras(5) }),
      sala({ id: 'b', inicio: diasAtras(1) }),
      sala({ id: 'futura', status: 'agendada', inicio: new Date(AGORA + 86_400_000).toISOString() }),
      sala({ id: 'cancelada', status: 'cancelada' }),
      sala({ id: 'ao-vivo-com-fala', status: 'ao_vivo', inicio: diasAtras(0) }),
    ], [resumo('ao-vivo-com-fala', { falas: 3 })], AGORA);
    expect(itens.map((s) => s.id)).toEqual(['ao-vivo-com-fala', 'b', 'a']);
    expect(itens[1].resumo.falas).toBe(0); // sem resumo = zeros
  });
});

describe('filtraArquivo', () => {
  const itens = montaArquivo([
    sala({ id: 'gravada', closer: 'Allan', inicio: diasAtras(3) }),
    sala({ id: 'antiga', closer: 'Rafael', lead_nome: 'Colégio São João', inicio: diasAtras(60) }),
    sala({ id: 'relatorio', closer: 'Rafael', inicio: diasAtras(10) }),
  ], [
    resumo('gravada', { gravacoes: 1, falas: 10 }),
    resumo('relatorio', { tem_relatorio: true, falas: 5 }),
  ], AGORA);

  it('período', () => {
    expect(filtraArquivo(itens, FILTROS_PADRAO, AGORA).map((s) => s.id)).toEqual(['gravada', 'relatorio']);
    expect(filtraArquivo(itens, { ...FILTROS_PADRAO, periodo: 'tudo' }, AGORA)).toHaveLength(3);
  });

  it('closer e tipo', () => {
    const tudo = { ...FILTROS_PADRAO, periodo: 'tudo' as const };
    expect(filtraArquivo(itens, { ...tudo, closer: 'Rafael' }, AGORA).map((s) => s.id)).toEqual(['relatorio', 'antiga']);
    expect(filtraArquivo(itens, { ...tudo, so: 'gravadas' }, AGORA).map((s) => s.id)).toEqual(['gravada']);
    expect(filtraArquivo(itens, { ...tudo, so: 'transcritas' }, AGORA)).toHaveLength(2);
    expect(filtraArquivo(itens, { ...tudo, so: 'com_relatorio' }, AGORA).map((s) => s.id)).toEqual(['relatorio']);
  });

  it('busca sem ligar para acento nem maiúscula', () => {
    const tudo = { ...FILTROS_PADRAO, periodo: 'tudo' as const };
    expect(filtraArquivo(itens, { ...tudo, busca: 'sao joao' }, AGORA).map((s) => s.id)).toEqual(['antiga']);
  });

  it('lista de closers', () => {
    expect(closersDoArquivo(itens)).toEqual(['Allan', 'Rafael']);
  });
});

describe('numerosDoArquivo', () => {
  it('conta o topo do painel', () => {
    const itens = montaArquivo([
      sala({ id: 'a', lead_entrou: true }),
      sala({ id: 'b', lead_entrou: false }),
      sala({ id: 'c', instantanea: true, lead_email: null, lead_entrou: false }),
    ], [
      resumo('a', { gravacoes: 1, segundos_gravados: 5400, falas: 20, nota: 8, atencao_media: 70 }),
      resumo('b', { nota: 5, atencao_media: 50 }),
    ], AGORA);
    expect(numerosDoArquivo(itens)).toEqual({
      reunioes: 3, gravadas: 1, horasGravadas: 1.5, transcritas: 1, notaMedia: 6.5,
      comparecimento: 50, atencaoMedia: 60, minutosMedios: 40,
    });
  });

  it('sem dado não inventa número', () => {
    const n = numerosDoArquivo([]);
    expect(n.notaMedia).toBeNull();
    expect(n.comparecimento).toBeNull();
    expect(n.atencaoMedia).toBeNull();
  });
});

describe('transcrição', () => {
  const falas: Fala[] = [
    { id: '1', quem: 'Allan', papel: 'anfitriao', texto: 'Bom dia!', falado_em: '2026-10-20T12:00:00Z' },
    { id: '2', quem: 'Allan', papel: 'anfitriao', texto: 'Tudo bem?', falado_em: '2026-10-20T12:00:04Z' },
    { id: '3', quem: 'Mariana', papel: 'lead', texto: 'Tudo ótimo.', falado_em: '2026-10-20T12:03:25Z' },
  ];

  it('tempo desde a primeira fala', () => {
    expect(tempoDaFala('2026-10-20T12:03:25Z', '2026-10-20T12:00:00Z')).toBe('03:25');
    expect(tempoDaFala('2026-10-20T13:05:09Z', '2026-10-20T12:00:00Z')).toBe('1:05:09');
  });

  it('junta falas seguidas da mesma pessoa', () => {
    const g = agrupaFalas(falas);
    expect(g).toHaveLength(2);
    expect(g[0].textos).toEqual(['Bom dia!', 'Tudo bem?']);
  });

  it('texto para baixar', () => {
    expect(transcricaoComoTexto('Reunião', 'seg, 20 de out', falas)).toBe(
      'Reunião\nseg, 20 de out\n\n[00:00] Allan (RT): Bom dia! Tudo bem?\n\n[03:25] Mariana: Tudo ótimo.\n',
    );
    expect(transcricaoComoTexto('R', 'q', [])).toContain('(sem transcrição)');
  });
});
