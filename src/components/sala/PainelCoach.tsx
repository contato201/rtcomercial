import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalParticipant, useParticipants, useRoomContext } from '@livekit/components-react';
import type { Participant } from 'livekit-client';
import { AlertTriangle, CheckCircle2, Circle, Lightbulb, Sparkles } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  CAMPOS_FICHA, ROTEIRO, aplicaResposta, buscaCoach, dinheiroParado, estadoInicial, falaDoCloserPct, pedeDica,
  quemGrava, salvaEstado, salvaTrechos,
  type Dica, type EstadoCoach, type TipoReuniao, type Trecho,
} from '@/lib/coach';

/**
 * O Coach IA na lateral da sala. Só a equipe vê.
 *
 * Quem grava (um anfitrião só — ver `quemGrava`): recebe a transcrição do
 * assistente invisível, guarda no banco a cada 10 s e pede uma dica ao Coach
 * a cada 45 s, se houve fala nova. Os outros da equipe (observador, segundo
 * anfitrião) só leem o estado do banco a cada 5 s — mesma tela, sem custo extra.
 *
 * "Coach ao vivo" começa ligado em toda reunião; quem grava pode desligar na
 * chave do cartão (pedido do Allan). Desligado, as dicas param, mas a fala
 * continua sendo guardada — o relatório do fim sai igual. Ao religar, o que
 * foi dito no meio vai junto na próxima pergunta, para a ficha não perder nada.
 */

const TOPICO = 'rt-transcricao';
const GUARDA_MS = 10_000;
const PERGUNTA_MS = 45_000;
const LE_MS = 5_000;

const papelDe = (p: Participant) => {
  try {
    return (JSON.parse(p.metadata || '{}') as { papel?: string }).papel ?? null;
  } catch {
    return null;
  }
};

export function PainelCoach({
  salaId, tipo, engajamento, aoMudarBloco,
}: {
  salaId: string;
  tipo: TipoReuniao;
  /** Frase do engajamento do último minuto (Fase 4), mandada junto com a fala. */
  engajamento?: () => string;
  /** Avisa a sala quando o Coach muda a etapa do roteiro (faixa embaixo do vídeo). */
  aoMudarBloco?: (bloco: string | null) => void;
}) {
  const sala = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participantes = useParticipants();

  const anfitrioes = participantes.filter((p) => papelDe(p) === 'anfitriao').map((p) => p.identity);
  const gravo = quemGrava(anfitrioes) === localParticipant.identity;

  const [estado, setEstado] = useState<EstadoCoach>(estadoInicial);
  const [falas, setFalas] = useState(0);
  const inicio = useRef(Date.now());

  // ── Quem grava: ouve o transcritor, guarda e pergunta ao Coach ──────────
  const trechos = useRef<Trecho[]>([]);
  const naoGuardados = useRef<Trecho[]>([]);
  const jaPerguntados = useRef(0);
  const estadoAtual = useRef(estado);
  estadoAtual.current = estado;
  const engajamentoAtual = useRef(engajamento);
  engajamentoAtual.current = engajamento;
  const [aoVivo, setAoVivo] = useState(true);
  const aoVivoAtual = useRef(aoVivo);
  aoVivoAtual.current = aoVivo;
  // Para o closer ver que o Coach está trabalhando, mesmo quando não há dica.
  const [analisando, setAnalisando] = useState(false);
  const [ultimaAnalise, setUltimaAnalise] = useState<number | null>(null);

  useEffect(() => {
    // Todo anfitrião recebe o texto (o transcritor manda para todos eles),
    // então todo anfitrião precisa do receptor — mesmo quem não grava.
    sala.registerTextStreamHandler(TOPICO, async (leitor) => {
      try {
        const trecho = JSON.parse(await leitor.readAll()) as Trecho;
        if (!trecho?.id || !trecho.texto) return;
        trechos.current.push(trecho);
        naoGuardados.current.push(trecho);
        setFalas(trechos.current.length);
      } catch {
        // trecho estragado: ignora, a reunião segue
      }
    });
    return () => sala.unregisterTextStreamHandler(TOPICO);
  }, [sala]);

  useEffect(() => {
    if (!gravo) return;

    const guarda = async () => {
      const lote = naoGuardados.current.splice(0);
      if (lote.length === 0) return;
      try {
        await salvaTrechos(salaId, lote);
      } catch {
        naoGuardados.current.unshift(...lote); // tenta de novo na próxima volta
      }
    };

    const pergunta = async () => {
      if (!aoVivoAtual.current) return; // pausado: guarda a fala, não pergunta
      const novos = trechos.current.slice(jaPerguntados.current);
      if (novos.length === 0) return;
      jaPerguntados.current = trechos.current.length;
      const minuto = Math.floor((Date.now() - inicio.current) / 60_000);
      setAnalisando(true);
      const resposta = await pedeDica({
        salaId,
        minuto,
        falaCloserPct: falaDoCloserPct(trechos.current),
        estado: estadoAtual.current,
        novos,
        engajamento: engajamentoAtual.current?.() || undefined,
      }).catch(() => null);
      setAnalisando(false);
      if (!resposta) return;
      setUltimaAnalise(Date.now());
      const proximo = aplicaResposta(estadoAtual.current, resposta, minuto, tipo);
      setEstado(proximo);
      void salvaEstado(salaId, proximo).catch(() => undefined);
    };

    const t1 = setInterval(guarda, GUARDA_MS);
    const t2 = setInterval(pergunta, PERGUNTA_MS);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
      void guarda(); // o que sobrou antes de sair
    };
  }, [gravo, salaId, tipo]);

  useEffect(() => {
    aoMudarBloco?.(estado.bloco);
  }, [estado.bloco, aoMudarBloco]);

  // ── Quem só acompanha: lê do banco ─────────────────────────────────────
  useEffect(() => {
    if (gravo) return;
    let vivo = true;
    const le = () =>
      buscaCoach(salaId)
        .then((r) => vivo && r?.estado && setEstado(r.estado))
        .catch(() => undefined);
    void le();
    const t = setInterval(le, LE_MS);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [gravo, salaId]);

  return (
    <TelaDoCoach
      estado={estado} tipo={tipo} falas={falas} gravo={gravo}
      aoVivo={aoVivo} mudaAoVivo={setAoVivo}
      analisando={analisando} ultimaAnalise={ultimaAnalise}
    />
  );
}

// ── A tela ─────────────────────────────────────────────────────────────────

const COR_DICA: Record<Dica['nivel'], { caixa: string; texto: string; rotulo: string }> = {
  critico: { caixa: 'border-[var(--c-5A2020)] bg-[var(--c-2A1212)]', texto: 'text-[var(--c-F5A3A3)]', rotulo: 'Crítico' },
  atencao: { caixa: 'border-[var(--c-4A3A14)] bg-[var(--c-1E1708)]', texto: 'text-[var(--c-F0D58C)]', rotulo: 'Atenção' },
  sugestao: { caixa: 'border-[var(--c-1F3A2A)] bg-[var(--c-0F1A14)]', texto: 'text-[var(--c-9FD8B5)]', rotulo: 'Sugestão' },
};

export function TelaDoCoach({
  estado, tipo, falas, gravo, aoVivo, mudaAoVivo, analisando, ultimaAnalise,
}: {
  estado: EstadoCoach;
  tipo: TipoReuniao;
  falas: number;
  gravo: boolean;
  aoVivo: boolean;
  mudaAoVivo: (ligado: boolean) => void;
  analisando: boolean;
  ultimaAnalise: number | null;
}) {
  // Relógio de 5 em 5 s só para o "há X s" andar sozinho.
  const [, setTique] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTique((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);
  const ha = ultimaAnalise ? Math.max(0, Math.round((Date.now() - ultimaAnalise) / 1000)) : null;
  const haTexto = ha === null ? null : ha < 60 ? `há ${ha} s` : `há ${Math.floor(ha / 60)} min`;
  const roteiro = ROTEIRO[tipo];
  const atual = estado.bloco ? roteiro.indexOf(estado.bloco) : -1;
  const [ultima, ...anteriores] = estado.dicas;
  const p1 = CAMPOS_FICHA.filter((c) => c.prioridade === 1);
  const p2 = CAMPOS_FICHA.filter((c) => c.prioridade === 2);
  const p2Preenchidos = p2.filter((c) => estado.ficha[c.chave]);
  const spinMenor = useMemo(() => {
    const entradas = Object.entries(estado.spin) as Array<[keyof EstadoCoach['spin'], number]>;
    return entradas.reduce((a, b) => (b[1] < a[1] ? b : a))[0];
  }, [estado.spin]);
  const o = estado.orientacao ?? null;
  const parado = useMemo(() => dinheiroParado(estado.ficha), [estado.ficha]);
  const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-[var(--c-333333)] bg-[var(--c-121212)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-[1.6px] text-[var(--c-C0B072)]">
            <Sparkles className="h-4 w-4" />
            Coach IA
          </span>
          <span className="text-xs text-[var(--c-A9A294)]">
            {gravo ? (falas > 0 ? `${falas} falas` : 'aguardando a 1ª fala') : 'acompanhando'}
          </span>
        </div>

        {gravo && (
          <label className="mb-3 flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-[var(--c-333333)] bg-[var(--c-171717)] px-3 py-2">
            <span className="text-sm font-medium text-[var(--c-D7D2C6)]">Dicas ao vivo</span>
            <Switch checked={aoVivo} onCheckedChange={mudaAoVivo} aria-label="Ligar ou desligar as dicas ao vivo" />
          </label>
        )}

        {gravo && !aoVivo ? (
          <p className="text-sm leading-relaxed text-[var(--c-A9A294)]">
            Dicas pausadas. A conversa continua sendo guardada e o relatório chega no fim da reunião.
          </p>
        ) : ultima ? (
          <div className={`rounded-xl border p-3 ${COR_DICA[ultima.nivel].caixa}`}>
            <p className={`mb-1 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[1.4px] ${COR_DICA[ultima.nivel].texto}`}>
              {ultima.nivel === 'critico' ? <AlertTriangle className="h-4 w-4" /> : <Lightbulb className="h-4 w-4" />}
              {COR_DICA[ultima.nivel].rotulo} · min {ultima.minuto}
            </p>
            <p className="text-lg font-semibold leading-snug text-[var(--c-FFFFFF)]">{ultima.texto}</p>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-[var(--c-A9A294)]">
            {gravo && falas === 0
              ? 'Esperando a conversa começar. As dicas aparecem aqui — no máximo uma por minuto.'
              : 'Nenhuma dica agora: a conversa está andando bem. Quando houver algo importante, aparece aqui.'}
          </p>
        )}

        {/* Sinal de vida: mostra que o Coach está ouvindo e analisando. */}
        {gravo && aoVivo && (
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[var(--c-333333)] pt-3 text-[13px] text-[var(--c-BDB6A8)]">
            <span className={`h-2.5 w-2.5 rounded-full ${analisando ? 'animate-pulse bg-[var(--c-C0B072)]' : falas > 0 ? 'bg-[var(--c-3E9E6A)]' : 'bg-[var(--c-5A5A5A)]'}`} />
            {analisando
              ? 'Analisando a conversa…'
              : haTexto
                ? `Última análise ${haTexto}`
                : falas > 0 ? 'Ouvindo — 1ª análise em menos de 1 min' : 'Ouvindo'}
            {estado.bloco && <span className="text-[var(--c-F2EFE7)]">· agora em <strong>{estado.bloco}</strong></span>}
          </div>
        )}

        {anteriores.length > 0 && (
          <ul className="mt-2 space-y-1">
            {anteriores.slice(0, 3).map((d) => (
              <li key={`${d.minuto}-${d.texto}`} className="text-[13px] leading-snug text-[var(--c-BDB6A8)]">
                <span className="text-[var(--c-8A8478)]">min {d.minuto} · </span>{d.texto}
              </li>
            ))}
          </ul>
        )}
      </div>

      {!(gravo && !aoVivo) && (o || parado) && (
        <div className="space-y-2.5 rounded-2xl border border-[var(--c-333333)] bg-[var(--c-121212)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[1.6px] text-[var(--c-BDB6A8)]">
            Teleprompter{o ? ` · min ${o.minuto}` : ''}
          </p>
          {o?.fala && (
            <div className="rounded-xl border border-[var(--c-2C3A6B)] bg-[var(--c-141A2E)] p-3">
              <p className="mb-1 text-xs font-bold uppercase tracking-[1.4px] text-[var(--c-8EA2FF)]">Fale e devolva a palavra</p>
              <p className="text-lg font-semibold leading-snug text-[var(--c-FFFFFF)]">“{o.fala}”</p>
            </div>
          )}
          {o?.proximo_passo && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[1.4px] text-[var(--c-BDB6A8)]">Próximo passo</p>
              <p className="text-base leading-snug text-[var(--c-F2EFE7)]">{o.proximo_passo}</p>
            </div>
          )}
          {o?.evite && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[1.4px] text-[var(--c-E8A838)]">Evite agora</p>
              <p className="text-base leading-snug text-[var(--c-F2EFE7)]">{o.evite}</p>
            </div>
          )}
          {o?.risco && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[1.4px] text-[var(--c-E07A6E)]">Risco</p>
              <p className="text-base leading-snug text-[var(--c-F2EFE7)]">{o.risco}</p>
            </div>
          )}
          {parado && (
            <div className="rounded-xl border border-[var(--c-2F3A2A)] bg-[var(--c-151B12)] p-3">
              <p className="mb-1 text-xs font-bold uppercase tracking-[1.4px] text-[var(--c-9FD8B5)]">Dinheiro parado</p>
              <p className="text-sm leading-snug text-[var(--c-E8E4DA)]">
                {parado.vagas} vagas vazias × {reais(parado.ticket)} × 12 ={' '}
                <strong className="text-base text-[var(--c-F2EFE7)]">{reais(parado.anual)} por ano</strong>
              </p>
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--c-333333)] bg-[var(--c-121212)] p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[1.6px] text-[var(--c-BDB6A8)]">
          Roteiro · reunião {tipo}
        </p>
        <ol className="space-y-1">
          {roteiro.map((bloco, i) => (
            <li
              key={bloco}
              className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm ${
                i === atual ? 'border border-[var(--c-C0B072)] bg-[var(--c-2A2516)] font-bold text-[var(--c-FFFFFF)]' : i < atual ? 'text-[var(--c-9A9488)]' : 'text-[var(--c-C9C2B4)]'
              }`}
            >
              {i < atual ? <CheckCircle2 className="h-4 w-4 text-[var(--c-3E9E6A)]" /> : <Circle className={`h-4 w-4 ${i === atual ? 'text-[var(--c-C0B072)]' : 'text-[var(--c-5A5A5A)]'}`} />}
              {bloco}
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-2xl border border-[var(--c-333333)] bg-[var(--c-121212)] p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[1.6px] text-[var(--c-BDB6A8)]">Ficha · prioridade 1</p>
        <ul className="space-y-1.5">
          {p1.map((c) => {
            const v = estado.ficha[c.chave];
            return (
              <li key={c.chave} className="flex items-start justify-between gap-2 text-sm">
                <span className="text-[var(--c-C9C2B4)]">{c.rotulo}</span>
                {v ? (
                  <span className="max-w-[55%] text-right font-medium text-[var(--c-9FD8B5)]">
                    {v.valor}
                    {v.fonte !== 'cliente' && <span className="ml-1 text-xs font-normal text-[var(--c-E8A838)]">({v.fonte === 'estimativa' ? 'estimativa' : 'closer'}, confirmar)</span>}
                  </span>
                ) : (
                  <span className="text-[var(--c-E8A838)]">falta</span>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-[var(--c-9A9488)]">Prioridade 2: {p2Preenchidos.length} de {p2.length} preenchidos</p>
      </div>

      <div className="rounded-2xl border border-[var(--c-333333)] bg-[var(--c-121212)] p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[1.6px] text-[var(--c-BDB6A8)]">SPIN</p>
          {estado.termometro !== null && (
            <span className="text-xs text-[var(--c-C9C2B4)]">qualificação <strong className="text-[var(--c-F2EFE7)]">{estado.termometro}</strong>/100</span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-1.5 text-center">
          {(['situacao', 'problema', 'implicacao', 'necessidade'] as const).map((k) => (
            <div key={k} className={`rounded-lg border px-1 py-1.5 ${k === spinMenor ? 'border-[var(--c-4A3A14)] bg-[var(--c-1E1708)]' : 'border-[var(--c-333333)] bg-[var(--c-171717)]'}`}>
              <p className="text-lg font-bold tabular-nums text-[var(--c-F2EFE7)]">{estado.spin[k]}</p>
              <p className="text-[11px] uppercase tracking-wide text-[var(--c-BDB6A8)]">{k === 'situacao' ? 'Situação' : k === 'problema' ? 'Problema' : k === 'implicacao' ? 'Implicação' : 'Necess.'}</p>
            </div>
          ))}
        </div>
      </div>

      {estado.pendencias.length > 0 && (
        <div className="rounded-2xl border border-[var(--c-333333)] bg-[var(--c-121212)] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[1.6px] text-[var(--c-BDB6A8)]">Pendências</p>
          <ul className="space-y-1">
            {estado.pendencias.map((p) => (
              <li key={p} className="text-sm leading-snug text-[var(--c-E8E4DA)]">• {p}</li>
            ))}
          </ul>
        </div>
      )}

      {estado.citacoes.length > 0 && (
        <div className="rounded-2xl border border-[var(--c-333333)] bg-[var(--c-121212)] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[1.6px] text-[var(--c-BDB6A8)]">Frases do cliente</p>
          <ul className="space-y-1.5">
            {estado.citacoes.slice(-4).map((c) => (
              <li key={c} className="text-sm italic leading-snug text-[var(--c-D9CBA4)]">“{c}”</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
