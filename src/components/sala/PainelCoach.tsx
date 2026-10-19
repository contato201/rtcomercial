import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalParticipant, useParticipants, useRoomContext } from '@livekit/components-react';
import type { Participant } from 'livekit-client';
import { AlertTriangle, CheckCircle2, Circle, Lightbulb, Sparkles } from 'lucide-react';
import {
  CAMPOS_FICHA, ROTEIRO, aplicaResposta, buscaCoach, estadoInicial, falaDoCloserPct, pedeDica,
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

export function PainelCoach({ salaId, tipo }: { salaId: string; tipo: TipoReuniao }) {
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
      const novos = trechos.current.slice(jaPerguntados.current);
      if (novos.length === 0) return;
      jaPerguntados.current = trechos.current.length;
      const minuto = Math.floor((Date.now() - inicio.current) / 60_000);
      const resposta = await pedeDica({
        salaId,
        minuto,
        falaCloserPct: falaDoCloserPct(trechos.current),
        estado: estadoAtual.current,
        novos,
      }).catch(() => null);
      if (!resposta) return;
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

  return <TelaDoCoach estado={estado} tipo={tipo} falas={falas} gravo={gravo} />;
}

// ── A tela ─────────────────────────────────────────────────────────────────

const COR_DICA: Record<Dica['nivel'], { caixa: string; texto: string; rotulo: string }> = {
  critico: { caixa: 'border-[#5A2020] bg-[#2A1212]', texto: 'text-[#F5A3A3]', rotulo: 'Crítico' },
  atencao: { caixa: 'border-[#4A3A14] bg-[#1E1708]', texto: 'text-[#F0D58C]', rotulo: 'Atenção' },
  sugestao: { caixa: 'border-[#1F3A2A] bg-[#0F1A14]', texto: 'text-[#9FD8B5]', rotulo: 'Sugestão' },
};

function TelaDoCoach({ estado, tipo, falas, gravo }: { estado: EstadoCoach; tipo: TipoReuniao; falas: number; gravo: boolean }) {
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

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-[#242424] bg-[#121212] p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[1.6px] text-[#C0B072]">
            <Sparkles className="h-4 w-4" />
            Coach IA
          </span>
          <span className="text-[10px] text-[#78736B]">
            {gravo ? (falas > 0 ? `${falas} falas` : 'aguardando a 1ª fala') : 'acompanhando'}
          </span>
        </div>

        {ultima ? (
          <div className={`rounded-xl border p-3 ${COR_DICA[ultima.nivel].caixa}`}>
            <p className={`mb-1 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[1.4px] ${COR_DICA[ultima.nivel].texto}`}>
              {ultima.nivel === 'critico' ? <AlertTriangle className="h-3 w-3" /> : <Lightbulb className="h-3 w-3" />}
              {COR_DICA[ultima.nivel].rotulo} · min {ultima.minuto}
            </p>
            <p className="text-sm font-medium leading-snug text-[#F2EFE7]">{ultima.texto}</p>
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-[#78736B]">
            As dicas aparecem aqui conforme a conversa anda — no máximo uma por minuto.
          </p>
        )}

        {anteriores.length > 0 && (
          <ul className="mt-2 space-y-1">
            {anteriores.slice(0, 3).map((d) => (
              <li key={`${d.minuto}-${d.texto}`} className="text-[11px] leading-snug text-[#8F8A80]">
                <span className="text-[#5F5A52]">min {d.minuto} · </span>{d.texto}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-[#242424] bg-[#121212] p-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[1.6px] text-[#8F8A80]">
          Roteiro · reunião {tipo}
        </p>
        <ol className="space-y-1">
          {roteiro.map((bloco, i) => (
            <li
              key={bloco}
              className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs ${
                i === atual ? 'border border-[#3A3524] bg-[#1C1A14] font-semibold text-[#F2EFE7]' : i < atual ? 'text-[#6F6A62]' : 'text-[#9B9488]'
              }`}
            >
              {i < atual ? <CheckCircle2 className="h-3.5 w-3.5 text-[#3E9E6A]" /> : <Circle className={`h-3.5 w-3.5 ${i === atual ? 'text-[#C0B072]' : 'text-[#3A3A3A]'}`} />}
              {bloco}
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-2xl border border-[#242424] bg-[#121212] p-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[1.6px] text-[#8F8A80]">Ficha · prioridade 1</p>
        <ul className="space-y-1.5">
          {p1.map((c) => {
            const v = estado.ficha[c.chave];
            return (
              <li key={c.chave} className="flex items-start justify-between gap-2 text-xs">
                <span className="text-[#9B9488]">{c.rotulo}</span>
                {v ? (
                  <span className="max-w-[55%] text-right font-medium text-[#9FD8B5]">
                    {v.valor}
                    {v.fonte !== 'cliente' && <span className="ml-1 text-[10px] font-normal text-[#E8A838]">({v.fonte === 'estimativa' ? 'estimativa' : 'closer'}, confirmar)</span>}
                  </span>
                ) : (
                  <span className="text-[#E8A838]">falta</span>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[10px] text-[#6F6A62]">Prioridade 2: {p2Preenchidos.length} de {p2.length} preenchidos</p>
      </div>

      <div className="rounded-2xl border border-[#242424] bg-[#121212] p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[1.6px] text-[#8F8A80]">SPIN</p>
          {estado.termometro !== null && (
            <span className="text-[10px] text-[#9B9488]">qualificação <strong className="text-[#F2EFE7]">{estado.termometro}</strong>/100</span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-1.5 text-center">
          {(['situacao', 'problema', 'implicacao', 'necessidade'] as const).map((k) => (
            <div key={k} className={`rounded-lg border px-1 py-1.5 ${k === spinMenor ? 'border-[#4A3A14] bg-[#1E1708]' : 'border-[#242424] bg-[#171717]'}`}>
              <p className="text-base font-bold tabular-nums text-[#F2EFE7]">{estado.spin[k]}</p>
              <p className="text-[9px] uppercase tracking-wide text-[#8F8A80]">{k === 'situacao' ? 'Situação' : k === 'problema' ? 'Problema' : k === 'implicacao' ? 'Implicação' : 'Necess.'}</p>
            </div>
          ))}
        </div>
      </div>

      {estado.pendencias.length > 0 && (
        <div className="rounded-2xl border border-[#242424] bg-[#121212] p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[1.6px] text-[#8F8A80]">Pendências</p>
          <ul className="space-y-1">
            {estado.pendencias.map((p) => (
              <li key={p} className="text-xs leading-snug text-[#E8E4DA]">• {p}</li>
            ))}
          </ul>
        </div>
      )}

      {estado.citacoes.length > 0 && (
        <div className="rounded-2xl border border-[#242424] bg-[#121212] p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[1.6px] text-[#8F8A80]">Frases do cliente</p>
          <ul className="space-y-1.5">
            {estado.citacoes.slice(-4).map((c) => (
              <li key={c} className="text-xs italic leading-snug text-[#D9CBA4]">“{c}”</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
