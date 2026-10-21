import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalParticipant, useParticipants } from '@livekit/components-react';
import { Track, type Participant } from 'livekit-client';
import type { FaceLandmarker } from '@mediapipe/tasks-vision';
import { quemGrava } from '@/lib/coach';
import {
  inicioDaQueda, leRosto, porMinuto, resume, resumoParaCoach, salvaEngajamento, sinaisDoLead, situacaoAgora,
  tendencia, ultimas, type Amostra, type Resumo, type Sinal,
} from '@/lib/engajamento';

/**
 * Fase 4 — o medidor de engajamento (só a equipe vê).
 *
 * O MediaPipe (do Google) roda aqui no navegador, de graça: 4 vezes por
 * segundo olha o vídeo de cada pessoa de fora que leu o aviso do rosto e
 * anota se ela está olhando, sorrindo, tensa e se acenou. Nada de imagem
 * sai do computador. Quem grava (o mesmo anfitrião do Coach) guarda no banco
 * a porcentagem de cada minuto, que entra no relatório do fim.
 */

// Mesma versão do pacote instalado (package.json) — os dois precisam bater.
const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const MODELO =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const OLHA_MS = 250; // 4 por segundo: o aceno dura menos de 1 s
const REDESENHA_A_CADA = 4; // a tela só atualiza 1 vez por segundo
const GUARDA_MS = 60_000;

const metadados = (p: Participant) => {
  try {
    return JSON.parse(p.metadata || '{}') as { papel?: string; consentiu_rosto?: boolean };
  } catch {
    return {};
  }
};
const deFora = (p: Participant) => {
  const papel = metadados(p).papel;
  return !p.isAgent && (papel === 'lead' || papel === 'convidado');
};

export interface PessoaEngajamento {
  identidade: string;
  nome: string;
  situacao: ReturnType<typeof situacaoAgora>;
  resumo: Resumo;
  /** Pontos de atenção ganhos/perdidos contra 3 min atrás (null = cedo demais). */
  tendencia: number | null;
  sinais: Sinal[];
  /** Atenção minuto a minuto desde o início — a curva embaixo do vídeo. */
  curva: Array<{ minuto: number; atencao: number }>;
  /** Minuto em que a queda atual começou (null = não está em queda). */
  quedaDesde: number | null;
}

export interface Engajamento {
  pessoas: PessoaEngajamento[];
  /** Gente de fora que entrou sem ver o aviso do rosto (não é analisada). */
  semPermissao: number;
  carregando: boolean;
  falhou: boolean;
  /** Frase do último minuto para o Coach. */
  paraCoach: () => string;
}

async function abreDetector(): Promise<FaceLandmarker> {
  const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
  const arquivos = await FilesetResolver.forVisionTasks(WASM);
  const opcoes = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: MODELO, delegate },
    runningMode: 'IMAGE' as const,
    numFaces: 1,
    outputFaceBlendshapes: true,
  });
  try {
    return await FaceLandmarker.createFromOptions(arquivos, opcoes('GPU'));
  } catch {
    // Computador sem placa de vídeo compatível: vai pelo processador.
    return FaceLandmarker.createFromOptions(arquivos, opcoes('CPU'));
  }
}

export function useEngajamento({ ativo, salaId }: { ativo: boolean; salaId: string | null }): Engajamento {
  const participantes = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const [carregando, setCarregando] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const [, setTique] = useState(0);

  const deForaNaSala = participantes.filter(deFora);
  const alvos = deForaNaSala.filter((p) => metadados(p).consentiu_rosto === true);
  const semPermissao = deForaNaSala.length - alvos.length;
  const temAlvo = alvos.length > 0;

  const alvosAtuais = useRef(alvos);
  alvosAtuais.current = alvos;
  const amostras = useRef(new Map<string, { nome: string; lista: Amostra[] }>());
  const inicio = useRef(Date.now());

  const anfitrioes = participantes.filter((p) => metadados(p).papel === 'anfitriao').map((p) => p.identity);
  const gravo = quemGrava(anfitrioes) === localParticipant.identity;

  // O detector só é carregado (uns 4 MB) quando aparece alguém para analisar.
  useEffect(() => {
    if (!ativo || !temAlvo) return;
    let vivo = true;
    let detector: FaceLandmarker | null = null;
    const videos = new Map<string, HTMLVideoElement>();

    setCarregando(true);
    abreDetector()
      .then((d) => {
        if (!vivo) return d.close();
        detector = d;
      })
      .catch(() => vivo && setFalhou(true))
      .finally(() => vivo && setCarregando(false));

    let voltas = 0;
    const olha = () => {
      if (!detector) return;
      for (const p of alvosAtuais.current) {
        const pub = p.getTrackPublication(Track.Source.Camera);
        const trilha = pub?.track?.mediaStreamTrack;
        // Câmera desligada: não conta nem a favor nem contra.
        if (!pub || pub.isMuted || !trilha || trilha.readyState !== 'live') continue;

        let video = videos.get(p.identity);
        const atual = (video?.srcObject as MediaStream | null)?.getVideoTracks()[0];
        if (!video || atual !== trilha) {
          video = document.createElement('video');
          video.muted = true;
          video.playsInline = true;
          video.srcObject = new MediaStream([trilha]);
          void video.play().catch(() => undefined);
          videos.set(p.identity, video);
        }
        if (video.readyState < 2 || video.videoWidth === 0) continue;

        try {
          const r = detector.detect(video);
          const leitura = leRosto(r.faceLandmarks[0], r.faceBlendshapes[0]?.categories);
          const registro = amostras.current.get(p.identity) ?? { nome: p.name || 'Convidado', lista: [] };
          registro.lista.push({ em: Date.now(), ...leitura });
          amostras.current.set(p.identity, registro);
        } catch {
          // um quadro ruim não para a reunião
        }
      }
      if (++voltas % REDESENHA_A_CADA === 0) setTique((t) => t + 1);
    };

    const t = setInterval(olha, OLHA_MS);
    return () => {
      vivo = false;
      clearInterval(t);
      detector?.close();
      videos.forEach((v) => (v.srcObject = null));
    };
  }, [ativo, temAlvo]);

  // Quem grava guarda os minutos no banco (os dois últimos — os anteriores já foram).
  useEffect(() => {
    if (!ativo || !gravo || !salaId) return;
    const guarda = (tudo = false) => {
      const minutoAtual = Math.floor((Date.now() - inicio.current) / 60_000);
      const linhas = [...amostras.current.values()].flatMap(({ nome, lista }) =>
        porMinuto(salaId, nome, lista, inicio.current).filter((l) => tudo || l.minuto >= minutoAtual - 1),
      );
      void salvaEngajamento(linhas).catch(() => undefined);
    };
    const t = setInterval(() => guarda(), GUARDA_MS);
    return () => {
      clearInterval(t);
      guarda(true); // o que sobrou antes de sair
    };
  }, [ativo, gravo, salaId]);

  const agora = Date.now();
  const pessoas = alvos.map((p) => {
    const lista = amostras.current.get(p.identity)?.lista ?? [];
    const recentes = ultimas(lista, agora);
    const curva = porMinuto('', '', lista, inicio.current).map((l) => ({ minuto: l.minuto, atencao: l.atencao }));
    return {
      identidade: p.identity,
      nome: p.name || 'Convidado',
      situacao: situacaoAgora(recentes),
      resumo: resume(recentes),
      tendencia: tendencia(lista, agora),
      sinais: sinaisDoLead(recentes),
      curva,
      quedaDesde: inicioDaQueda(curva),
    };
  });

  return {
    pessoas,
    semPermissao,
    carregando,
    falhou,
    paraCoach: () =>
      resumoParaCoach(
        [...amostras.current.values()].map(({ nome, lista }) => ({
          nome, recentes: ultimas(lista, Date.now()), tendencia: tendencia(lista, Date.now()),
        })),
      ),
  };
}

// ── A tela ─────────────────────────────────────────────────────────────────

const ROTULO: Record<PessoaEngajamento['situacao'], { texto: string; cor: string }> = {
  atento: { texto: 'Atento', cor: 'text-[var(--c-7FD1A0)]' },
  sorrindo: { texto: 'Sorrindo', cor: 'text-[var(--c-C0B072)]' },
  distraido: { texto: 'Distraído', cor: 'text-[var(--c-F0A35E)]' },
  sem_rosto: { texto: 'Fora da câmera', cor: 'text-[var(--c-BDB6A8)]' },
  sem_dado: { texto: 'Câmera desligada', cor: 'text-[var(--c-BDB6A8)]' },
};

export function PainelEngajamento({ engajamento }: { engajamento: Engajamento }) {
  const { pessoas, semPermissao, carregando, falhou } = engajamento;
  const distraido = useMemo(() => pessoas.find((p) => p.situacao === 'distraido'), [pessoas]);

  return (
    <div className="rounded-2xl border border-[var(--c-333333)] bg-[var(--c-121212)] p-4">
      <p className="mb-3 text-[13px] font-semibold uppercase tracking-[1.6px] text-[var(--c-BDB6A8)]">Engajamento</p>

      {falhou ? (
        <p className="text-sm text-[var(--c-A9A294)]">Este computador não conseguiu rodar a análise do rosto.</p>
      ) : pessoas.length === 0 ? (
        <p className="text-sm text-[var(--c-A9A294)]">
          {semPermissao > 0
            ? 'Quem entrou não viu o aviso de análise do rosto, então não é analisado.'
            : 'Começa quando o cliente entrar com a câmera ligada.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {pessoas.map((p) => {
            const rotulo = ROTULO[p.situacao];
            const temDado = p.resumo.amostras > 0 && p.situacao !== 'sem_rosto';
            return (
              <li key={p.identidade}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-[var(--c-E8E4DA)]">{p.nome}</span>
                  <span className={`shrink-0 font-semibold ${rotulo.cor}`}>
                    {carregando ? 'Preparando…' : rotulo.texto}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[var(--c-242424)]">
                  <div
                    className={`h-1.5 rounded-full ${p.resumo.atencao < 50 ? 'bg-[var(--c-F0A35E)]' : 'bg-[var(--c-7FD1A0)]'}`}
                    style={{ width: `${temDado ? p.resumo.atencao : 0}%` }}
                  />
                </div>
                {temDado && (
                  <p className="mt-1 text-[13px] tabular-nums text-[var(--c-BDB6A8)]">
                    Atenção {p.resumo.atencao}% · sorriu {p.resumo.sorriso}% · último minuto
                    {textoTendencia(p.tendencia) && <span className={corTendencia(p.tendencia)}> · {textoTendencia(p.tendencia)}</span>}
                  </p>
                )}
                {p.sinais.length > 0 && <ListaDeSinais sinais={p.sinais} />}
              </li>
            );
          })}
        </ul>
      )}

      {distraido && (
        <p className="mt-3 rounded-lg border border-[var(--c-4A3A14)] bg-[var(--c-1E1708)] px-3 py-2 text-sm leading-relaxed text-[var(--c-F0E3C6)]">
          {distraido.nome} está olhando pouco para a tela. Faça uma pergunta direta para trazer de volta.
        </p>
      )}
      {semPermissao > 0 && pessoas.length > 0 && (
        <p className="mt-2 text-[13px] text-[var(--c-A9A294)]">
          {semPermissao} pessoa{semPermissao > 1 ? 's' : ''} sem o aviso do rosto (não analisada{semPermissao > 1 ? 's' : ''}).
        </p>
      )}
    </div>
  );
}

// ── Peças usadas também em cima do vídeo ───────────────────────────────────

/** "↓ 27 pts em 3 min" (só quando mudou de verdade). */
export function textoTendencia(t: number | null): string | null {
  if (t === null || Math.abs(t) < 10) return null;
  return `${t < 0 ? '↓' : '↑'} ${Math.abs(t)} pts em 3 min`;
}
const corTendencia = (t: number | null) =>
  t !== null && t < 0 ? 'font-semibold text-[var(--c-F0A35E)]' : 'font-semibold text-[var(--c-7FD1A0)]';

function ListaDeSinais({ sinais }: { sinais: Sinal[] }) {
  return (
    <ul className="mt-2 space-y-1">
      {sinais.map((s) => (
        <li key={s.texto} className="flex items-center gap-2 text-[13px] text-[var(--c-E8E4DA)]">
          <span className={`h-2 w-2 shrink-0 rounded-full ${s.bom ? 'bg-[var(--c-7FD1A0)]' : 'bg-[var(--c-F0A35E)]'}`} />
          {s.texto}
        </li>
      ))}
    </ul>
  );
}

/**
 * O número grande em cima do vídeo, como no "Abracadabra Meet": a atenção do
 * cliente agora, para onde está indo e os sinais do rosto. Só a equipe vê.
 */
export function SeloEngajamento({ pessoa }: { pessoa: PessoaEngajamento }) {
  const r = pessoa.resumo;
  if (r.amostras === 0) return null;
  if (pessoa.situacao === 'sem_rosto') {
    return (
      <div className="rounded-xl border border-[var(--c-333333)] bg-[var(--c-121212)] px-4 py-3 text-sm font-semibold text-[var(--c-BDB6A8)] shadow-lg">
        {pessoa.nome}: fora da câmera
      </div>
    );
  }
  const baixo = r.atencao < 50;
  return (
    <div className={`w-[260px] rounded-xl border-2 bg-[var(--c-121212)] px-4 py-3 shadow-xl ${baixo ? 'border-[var(--c-F0A35E)]' : 'border-[var(--c-7FD1A0)]'}`}>
      <p className="text-[11px] font-bold uppercase tracking-[1.4px] text-[var(--c-BDB6A8)]">
        Engajamento · {pessoa.nome}
      </p>
      <div className="flex items-baseline gap-2">
        <span className={`text-4xl font-black tabular-nums ${baixo ? 'text-[var(--c-F0A35E)]' : 'text-[var(--c-7FD1A0)]'}`}>
          {r.atencao}%
        </span>
        {textoTendencia(pessoa.tendencia) && (
          <span className={`text-sm ${corTendencia(pessoa.tendencia)}`}>{textoTendencia(pessoa.tendencia)}</span>
        )}
      </div>
      {pessoa.sinais.length > 0 && <ListaDeSinais sinais={pessoa.sinais} />}
    </div>
  );
}
