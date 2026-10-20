import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalParticipant, useParticipants } from '@livekit/components-react';
import { Track, type Participant } from 'livekit-client';
import type { FaceLandmarker } from '@mediapipe/tasks-vision';
import { quemGrava } from '@/lib/coach';
import {
  leRosto, porMinuto, resume, resumoParaCoach, salvaEngajamento, situacaoAgora, ultimas,
  type Amostra, type Resumo,
} from '@/lib/engajamento';

/**
 * Fase 4 — o medidor de engajamento (só a equipe vê).
 *
 * O MediaPipe (do Google) roda aqui no navegador, de graça: uma vez por
 * segundo olha o vídeo de cada pessoa de fora que leu o aviso do rosto e
 * anota se ela está olhando para a tela e se está sorrindo. Nada de imagem
 * sai do computador. Quem grava (o mesmo anfitrião do Coach) guarda no banco
 * a porcentagem de cada minuto, que entra no relatório do fim.
 */

// Mesma versão do pacote instalado (package.json) — os dois precisam bater.
const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const MODELO =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const OLHA_MS = 1_000;
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
      setTique((t) => t + 1);
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
    const recentes = ultimas(amostras.current.get(p.identity)?.lista ?? [], agora);
    return { identidade: p.identity, nome: p.name || 'Convidado', situacao: situacaoAgora(recentes), resumo: resume(recentes) };
  });

  return {
    pessoas,
    semPermissao,
    carregando,
    falhou,
    paraCoach: () =>
      resumoParaCoach(
        [...amostras.current.values()].map(({ nome, lista }) => ({ nome, recentes: ultimas(lista, Date.now()) })),
      ),
  };
}

// ── A tela ─────────────────────────────────────────────────────────────────

const ROTULO: Record<PessoaEngajamento['situacao'], { texto: string; cor: string }> = {
  atento: { texto: 'Atento', cor: 'text-[#7FD1A0]' },
  sorrindo: { texto: 'Sorrindo', cor: 'text-[#C0B072]' },
  distraido: { texto: 'Distraído', cor: 'text-[#F0A35E]' },
  sem_rosto: { texto: 'Fora da câmera', cor: 'text-[#8F8A80]' },
  sem_dado: { texto: 'Câmera desligada', cor: 'text-[#8F8A80]' },
};

export function PainelEngajamento({ engajamento }: { engajamento: Engajamento }) {
  const { pessoas, semPermissao, carregando, falhou } = engajamento;
  const distraido = useMemo(() => pessoas.find((p) => p.situacao === 'distraido'), [pessoas]);

  return (
    <div className="rounded-2xl border border-[#242424] bg-[#121212] p-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[1.6px] text-[#8F8A80]">Engajamento</p>

      {falhou ? (
        <p className="text-xs text-[#78736B]">Este computador não conseguiu rodar a análise do rosto.</p>
      ) : pessoas.length === 0 ? (
        <p className="text-xs text-[#78736B]">
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
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-[#E8E4DA]">{p.nome}</span>
                  <span className={`shrink-0 font-semibold ${rotulo.cor}`}>
                    {carregando ? 'Preparando…' : rotulo.texto}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#242424]">
                  <div
                    className={`h-1.5 rounded-full ${p.resumo.atencao < 50 ? 'bg-[#F0A35E]' : 'bg-[#7FD1A0]'}`}
                    style={{ width: `${temDado ? p.resumo.atencao : 0}%` }}
                  />
                </div>
                {temDado && (
                  <p className="mt-1 text-[11px] tabular-nums text-[#8F8A80]">
                    Atenção {p.resumo.atencao}% · sorriu {p.resumo.sorriso}% · último minuto
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {distraido && (
        <p className="mt-3 rounded-lg border border-[#4A3A14] bg-[#1E1708] px-3 py-2 text-xs leading-relaxed text-[#F0E3C6]">
          {distraido.nome} está olhando pouco para a tela. Faça uma pergunta direta para trazer de volta.
        </p>
      )}
      {semPermissao > 0 && pessoas.length > 0 && (
        <p className="mt-2 text-[11px] text-[#78736B]">
          {semPermissao} pessoa{semPermissao > 1 ? 's' : ''} sem o aviso do rosto (não analisada{semPermissao > 1 ? 's' : ''}).
        </p>
      )}
    </div>
  );
}
