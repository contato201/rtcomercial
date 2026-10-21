import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CarouselLayout, DisconnectButton, FocusLayout, FocusLayoutContainer, FocusToggle, GridLayout,
  LayoutContextProvider, LiveKitRoom, ParticipantTile, RoomAudioRenderer,
  TrackToggle, VideoTrack, isTrackReference, useChat, useConnectionState, useCreateLayoutContext,
  useEnsureTrackRef, useIsMuted, useIsRecording, useIsSpeaking, useLocalParticipant,
  useMediaDeviceSelect, useParticipants, usePinnedTracks, useSpeakingParticipants, useTracks,
} from '@livekit/components-react';
import { ConnectionState, RoomEvent, Track, type Participant } from 'livekit-client';
import { Check, Circle, Eye, Link2, MessageSquare, MicOff, Moon, Send, Settings, Square, Sun, UserPlus, X } from 'lucide-react';
import '@livekit/components-styles';
import './tema-sala.css';
import logo from '@/assets/logo-pequena.png';
import { PainelCoach } from './PainelCoach';
import { CanetaLaser } from './CanetaLaser';
import { PainelEngajamento, SeloEngajamento, useEngajamento, type Engajamento } from './Engajamento';
import { ROTEIRO } from '@/lib/coach';
import {
  ALERTA_MONOLOGO_MS, MONOLOGO_INICIAL, avancaMonologo, duracaoMonologo, tempoFalado, textoDoAlerta,
} from '@/lib/monologo';
import {
  ABORDAGENS, decidePedido, gravaSala, linkDaSala, listaPedidos, mudaAbordagem,
  type Abordagem, type Cracha, type PedidoDeEntrada,
} from '@/lib/salas';

/**
 * A sala em si. O vídeo e o áudio são do LiveKit; todo o resto é nosso — e em
 * português. Os componentes prontos do LiveKit (VideoConference, ControlBar,
 * Chat) têm os textos em inglês gravados dentro deles, sem opção de tradução,
 * então a sala é montada com as peças menores, que deixam a gente escrever.
 *
 * Quem é da equipe (anfitrião e observador) vê um painel à esquerda: quem está
 * pedindo para entrar, o tempo de fala de cada um e, nas próximas fases, o
 * Coach IA. Quem é de fora nunca vê esse painel.
 *
 * A sala abre escura (fundo escuro cansa menos a vista numa chamada de vídeo),
 * mas tem o botão sol/lua no topo para a versão clara, pedido do Allan. A cor
 * de cada peça vem de `tema-sala.css`; a escolha fica guardada no navegador.
 */

const relogio = (segundos: number) => {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  const dois = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${dois(h)}:${dois(m)}:${dois(s)}` : `${dois(m)}:${dois(s)}`;
};

/** O assistente invisível (fases seguintes) é participante, mas não aparece na tela. */
const ehGente = (p: Participant) => !p.isAgent;
const papelDe = (p: Participant) => {
  try {
    return (JSON.parse(p.metadata || '{}') as { papel?: string }).papel ?? null;
  } catch {
    return null;
  }
};
const ehCliente = (p: Participant) => ehGente(p) && (papelDe(p) === 'lead' || papelDe(p) === 'convidado');
const ehCloser = (p: Participant) => papelDe(p) === 'anfitriao';

/**
 * Quem fala e por quanto tempo, contado de segundo em segundo: o tempo de fala
 * de cada um e o monólogo do closer (ver `src/lib/monologo.ts`).
 */
function useFalaDaSala() {
  const falando = useSpeakingParticipants();
  const falandoAgora = useRef(falando);
  falandoAgora.current = falando;
  const [segundos, setSegundos] = useState<Record<string, number>>({});
  const [monologo, setMonologo] = useState(MONOLOGO_INICIAL);

  useEffect(() => {
    const t = setInterval(() => {
      const agora = falandoAgora.current.filter(ehGente);
      setMonologo((e) => avancaMonologo(e, Date.now(), agora.some(ehCloser), agora.some(ehCliente)));
      if (agora.length === 0) return;
      setSegundos((s) => {
        const novo = { ...s };
        agora.forEach((p) => (novo[p.identity] = (novo[p.identity] ?? 0) + 1));
        return novo;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  return { segundos, monologoMs: duracaoMonologo(monologo) };
}

const CHAVE_TEMA = 'rt-sala-tema';
/** Claro ou escuro, lembrado neste navegador para a próxima reunião. */
function useTemaDaSala() {
  const [tema, setTema] = useState<'escuro' | 'claro'>(() => {
    try {
      return localStorage.getItem(CHAVE_TEMA) === 'claro' ? 'claro' : 'escuro';
    } catch {
      return 'escuro';
    }
  });
  const alterna = () =>
    setTema((t) => {
      const novo = t === 'claro' ? 'escuro' : 'claro';
      try {
        localStorage.setItem(CHAVE_TEMA, novo);
      } catch {
        // navegador sem armazenamento: vale só para esta reunião
      }
      return novo;
    });
  return { tema, alterna };
}

export const SalaAoVivo = ({ cracha, aoSair }: { cracha: Cracha; aoSair: () => void }) => {
  const [segundos, setSegundos] = useState(0);
  const [copiado, setCopiado] = useState(false);
  const { tema, alterna } = useTemaDaSala();
  const observador = cracha.papel === 'observador';
  const equipe = cracha.papel === 'anfitriao' || observador;

  useEffect(() => {
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  async function convidar() {
    try {
      await navigator.clipboard.writeText(linkDaSala(cracha.sala.slug));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      window.prompt('Copie o link da reunião:', linkDaSala(cracha.sala.slug));
    }
  }

  // O que aparece embaixo do título: a equipe vê tudo, o lead só com quem fala.
  const subtitulo = equipe
    ? [
        cracha.sala.lead_nome ?? 'Reunião instantânea',
        cracha.sala.closer && `Closer ${cracha.sala.closer}`,
        cracha.sala.sdr && `SDR ${cracha.sala.sdr}`,
      ].filter(Boolean).join(' · ')
    : cracha.sala.com
      ? `com ${cracha.sala.com} · Reproduzindo Talentos`
      : 'Reproduzindo Talentos';

  return (
    <div
      className="sala-tema flex h-screen flex-col bg-[var(--c-0A0A0A)] text-[var(--c-F2EFE7)]"
      data-tema={tema}
    >
      {observador && (
        <div className="flex flex-wrap items-center justify-center gap-2 border-b border-[var(--c-1F2A33)] bg-[var(--c-101418)] px-6 py-2.5 text-center">
          <Eye className="h-4 w-4 text-[var(--c-6FA3C0)]" />
          <span className="text-xs font-semibold text-[var(--c-9FC4D8)]">Modo observador</span>
          <span className="text-xs text-[var(--c-7F93A0)]">— você não é visto nem ouvido pelo lead</span>
        </div>
      )}

      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--c-242424)] px-6 py-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <img
            src={logo}
            alt="Reproduzindo Talentos"
            className="h-10 w-10 shrink-0 rounded-[10px] border border-[var(--c-2E2E2E)]"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{cracha.sala.titulo}</p>
            <p className="truncate text-[11px] text-[var(--c-8F8A80)]">{subtitulo}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {equipe && (
            <button
              type="button"
              onClick={convidar}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-[var(--c-3A3524)] bg-[var(--c-1C1A14)] px-3.5 text-xs font-semibold text-[var(--c-C0B072)] transition-colors hover:bg-[var(--c-25221A)]"
            >
              {copiado ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
              {copiado ? 'Link copiado' : 'Convidar'}
            </button>
          )}
          <button
            type="button"
            onClick={alterna}
            aria-label={tema === 'claro' ? 'Mudar para o tema escuro' : 'Mudar para o tema claro'}
            title={tema === 'claro' ? 'Tema escuro' : 'Tema claro'}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-[var(--c-2E2E2E)] bg-[var(--c-171717)] px-3.5 text-xs font-semibold text-[var(--c-D7D2C6)] transition-colors hover:bg-[var(--c-1E1E1E)]"
          >
            {tema === 'claro' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
            {tema === 'claro' ? 'Escuro' : 'Claro'}
          </button>
          <span className="rounded-full border border-[var(--c-2E2E2E)] bg-[var(--c-171717)] px-3 py-1.5 text-xs font-semibold tabular-nums text-[var(--c-D7D2C6)]">
            {relogio(segundos)}
          </span>
        </div>
      </header>

      {/* As variáveis --lk-* vestem as peças do LiveKit com a cor e a fonte da RT.
          Sem a fonte, o LiveKit usa a do sistema (Roboto/Arial) e a sala fica
          com cara genérica, diferente do dashboard. */}
      <div
        className="min-h-0 flex-1"
        data-lk-theme="default"
        style={{
          ['--lk-font-family' as string]: "'Montserrat', system-ui, sans-serif",
          ['--lk-bg' as string]: 'var(--c-0A0A0A)',
          ['--lk-bg2' as string]: 'var(--c-121212)',
          ['--lk-bg3' as string]: 'var(--c-171717)',
          ['--lk-bg4' as string]: 'var(--c-1E1E1E)',
          ['--lk-fg' as string]: 'var(--c-F2EFE7)',
          ['--lk-fg2' as string]: 'var(--c-B5AE9E)',
          ['--lk-border-color' as string]: 'var(--c-242424)',
          ['--lk-accent-bg' as string]: 'var(--c-C0B072)',
          ['--lk-accent-fg' as string]: 'var(--c-0D0D0D)',
          ['--lk-danger' as string]: 'var(--c-E5484D)',
          ['--lk-control-bg' as string]: 'var(--c-171717)',
          ['--lk-control-hover-bg' as string]: 'var(--c-242424)',
          ['--lk-border-radius' as string]: '12px',
          height: '100%',
        }}
      >
        <LiveKitRoom
          serverUrl={cracha.url}
          token={cracha.token}
          connect
          audio={!observador}
          video={!observador}
          onDisconnected={aoSair}
          style={{ height: '100%' }}
        >
          <Conteudo cracha={cracha} />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>
    </div>
  );
};

/** Tudo que fica dentro da conexão: palco de vídeo, painéis e barra de botões. */
function Conteudo({ cracha }: { cracha: Cracha }) {
  const observador = cracha.papel === 'observador';
  const anfitriao = cracha.papel === 'anfitriao';
  const equipe = anfitriao || observador;

  const layout = useCreateLayoutContext();
  const [chatAberto, setChatAberto] = useState(false);
  const { chatMessages, send, isSending } = useChat();
  const [lidas, setLidas] = useState(0);
  useEffect(() => {
    if (chatAberto) setLidas(chatMessages.length);
  }, [chatAberto, chatMessages.length]);
  const naoLidas = chatAberto ? 0 : Math.max(0, chatMessages.length - lidas);
  const gravacao = useGravacao(cracha);
  // Roda mesmo com o painel escondido (janela estreita): o Coach e o relatório usam.
  const engajamento = useEngajamento({ ativo: equipe, salaId: cracha.sala.id });
  const fala = useFalaDaSala();
  const [bloco, setBloco] = useState<string | null>(null);
  const tipo = cracha.sala.tipo_reuniao ?? 1;

  // O cliente principal (o primeiro analisado) é quem aparece em destaque.
  const cliente = engajamento.pessoas[0] ?? null;
  const alerta = fala.monologoMs >= ALERTA_MONOLOGO_MS
    ? textoDoAlerta(fala.monologoMs, cliente && cliente.resumo.amostras > 0
      ? { nome: cliente.nome, atencao: cliente.resumo.atencao, acenou: cliente.sinais.some((x) => x.texto.startsWith('Acenou')) }
      : null)
    : null;

  // O que vai junto com a fala para o Coach: rosto do cliente + monólogo.
  const monologoAtual = useRef(fala.monologoMs);
  monologoAtual.current = fala.monologoMs;
  const contextoParaCoach = () => [
    engajamento.paraCoach(),
    monologoAtual.current >= 60_000 ? `Closer falando sozinho há ${tempoFalado(monologoAtual.current)}` : '',
  ].filter(Boolean).join('; ');

  return (
    <LayoutContextProvider value={layout}>
      <div className="flex h-full flex-col">
        <div className="flex min-h-0 flex-1 gap-3 p-3">
          {equipe && (
            <PainelEquipe
              ocultarEu={observador}
              salaId={cracha.sala.id}
              tipo={tipo}
              engajamento={engajamento}
              contextoParaCoach={contextoParaCoach}
              segundos={fala.segundos}
              alerta={alerta}
              aoMudarBloco={setBloco}
              abordagem={cracha.sala.abordagem ?? null}
              podeMudar={anfitriao}
            />
          )}

          <div className="relative min-h-0 min-w-0 flex-1">
            <Palco ocultarEu={observador} />
            {/* Todo mundo vê quando está gravando — o lead inclusive. */}
            {gravacao.gravando && (
              <div className="pointer-events-none absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-[var(--c-E5484D)] px-3 py-1 text-xs font-semibold text-white shadow-lg">
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                Gravando
              </div>
            )}
            {gravacao.erro && (
              <div className="absolute bottom-3 left-3 z-20 max-w-[320px] rounded-xl border border-[var(--c-5A2A2A)] bg-[var(--c-1F1414)] px-3 py-2 text-xs text-[var(--c-F2B8B8)]">
                {gravacao.erro}
              </div>
            )}
            {/* Fica por cima do vídeo, e não no painel, para aparecer em qualquer
                tamanho de tela — o painel some em janela estreita. */}
            {anfitriao && (
              <div className="absolute right-3 top-3 z-20 w-[280px] max-w-[calc(100%-1.5rem)]">
                <PedidosDeEntrada slug={cracha.sala.slug} />
              </div>
            )}
            {/* Só a equipe: o número grande da atenção do cliente, em cima do vídeo. */}
            {equipe && cliente && (
              <div className="pointer-events-none absolute bottom-3 right-3 z-20">
                <SeloEngajamento pessoa={cliente} />
              </div>
            )}
            {/* Janela estreita (painel escondido): o alerta aparece em cima do vídeo. */}
            {equipe && alerta && (
              <div className="absolute left-1/2 top-3 z-30 w-[420px] max-w-[calc(100%-1.5rem)] -translate-x-1/2 lg:hidden">
                <AlertaMonologo texto={alerta} />
              </div>
            )}
          </div>

          {chatAberto && (
            <PainelChat
              mensagens={chatMessages}
              enviar={send}
              enviando={isSending}
              podeEscrever={!observador}
              fechar={() => setChatAberto(false)}
            />
          )}
        </div>

        {equipe && (
          <FaixaDaReuniao
            cliente={cliente}
            segundos={fala.segundos}
            bloco={bloco}
            roteiro={ROTEIRO[tipo]}
          />
        )}

        <BarraDeBotoes
          observador={observador}
          gravacao={anfitriao ? gravacao : null}
          naoLidas={naoLidas}
          chatAberto={chatAberto}
          alternarChat={() => setChatAberto((v) => !v)}
        />
      </div>
    </LayoutContextProvider>
  );
}

/**
 * Os vídeos. Normalmente uma grade; quando alguém compartilha a tela (ou
 * alguém fixa um vídeo), ela vai para o centro e os rostos ficam numa faixa.
 */
function Palco({ ocultarEu }: { ocultarEu: boolean }) {
  const todos = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false },
  );
  // Observador não aparece nem para ele mesmo: ele não tem câmera ligada.
  const trilhas = todos.filter((t) => ehGente(t.participant) && !(ocultarEu && t.participant.isLocal));

  const fixado = usePinnedTracks()?.[0];
  const tela = trilhas.filter(isTrackReference).find((t) => t.publication.source === Track.Source.ScreenShare);
  const foco = fixado ?? tela;
  const resto = foco
    ? trilhas.filter((t) => !(t.participant.identity === foco.participant.identity && t.source === foco.source))
    : trilhas;

  if (trilhas.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-[var(--c-242424)] bg-[var(--c-121212)] text-sm text-[var(--c-8F8A80)]">
        Ninguém na sala ainda.
      </div>
    );
  }

  return foco ? (
    <div className="lk-focus-layout-wrapper" style={{ height: '100%' }}>
      <FocusLayoutContainer>
        <CarouselLayout tracks={resto}>
          <Ladrilho />
        </CarouselLayout>
        {/* Na tela compartilhada, a caneta laser fica por cima (todos veem o risco). */}
        <div className="relative h-full min-h-0 min-w-0">
          <FocusLayout trackRef={foco} style={{ height: '100%' }} />
          {foco.source === Track.Source.ScreenShare && <CanetaLaser podeRiscar={!ocultarEu} />}
        </div>
      </FocusLayoutContainer>
    </div>
  ) : (
    <div className="lk-grid-layout-wrapper" style={{ height: '100%' }}>
      <GridLayout tracks={trilhas}>
        <Ladrilho />
      </GridLayout>
    </div>
  );
}

// ── O quadro de cada pessoa ────────────────────────────────────────────────

const CORES_DO_AVATAR = ['#8A6A1F', '#1F7A55', '#245C8F', '#6E3A8F', '#8F2F45', '#2F6E7A', '#7A4A2A'];
const corDoNome = (nome: string) =>
  CORES_DO_AVATAR[[...nome].reduce((t, c) => t + c.charCodeAt(0), 0) % CORES_DO_AVATAR.length];
const inicial = (nome: string) => (nome.trim()[0] ?? '?').toUpperCase();

/**
 * O quadro de cada pessoa (feedback da 1ª reunião): com a câmera desligada
 * aparece um círculo colorido com a inicial do nome, em vez do bonequinho
 * branco do LiveKit; o nome fica numa etiqueta escura, legível em cima de
 * qualquer vídeo; quem está falando ganha uma borda dourada.
 */
function Ladrilho() {
  const ref = useEnsureTrackRef();
  const pessoa = ref.participant;
  const nome = pessoa.name || 'Participante';
  const ehCamera = ref.source === Track.Source.Camera;
  const videoDesligado = useIsMuted(ref);
  const micDesligado = useIsMuted({ participant: pessoa, source: Track.Source.Microphone });
  const falando = useIsSpeaking(pessoa);
  const temVideo = isTrackReference(ref) && !videoDesligado;

  return (
    <ParticipantTile
      trackRef={ref}
      className={`h-full !rounded-xl transition-shadow ${falando && ehCamera ? 'shadow-[0_0_0_3px_var(--c-C0B072)]' : ''}`}
    >
      {temVideo ? (
        <VideoTrack trackRef={ref} />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[var(--c-1E1E1E)]">
          <span
            className="flex aspect-square h-[42%] max-h-[140px] min-h-[48px] items-center justify-center rounded-full text-[clamp(1.5rem,4vh,3.5rem)] font-bold text-white"
            style={{ backgroundColor: corDoNome(nome) }}
            aria-hidden
          >
            {inicial(nome)}
          </span>
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-md bg-black/75 px-2.5 py-1 text-sm font-semibold text-white">
        {ehCamera && micDesligado && <MicOff className="h-3.5 w-3.5 shrink-0 text-[#FF8A8E]" aria-label="Microfone desligado" />}
        <span className="truncate">
          {nome}{pessoa.isLocal ? ' (você)' : ''}{!ehCamera ? ' · tela' : ''}
        </span>
      </div>
      <FocusToggle className="!absolute right-2 top-2 opacity-70 hover:opacity-100" />
    </ParticipantTile>
  );
}

/** Barra de baixo, em português. O observador só tem chat e sair. */
function BarraDeBotoes({
  observador, gravacao, naoLidas, chatAberto, alternarChat,
}: {
  observador: boolean;
  gravacao: ReturnType<typeof useGravacao> | null;
  naoLidas: number;
  chatAberto: boolean;
  alternarChat: () => void;
}) {
  const { isScreenShareEnabled } = useLocalParticipant();
  const [aparelhosAbertos, setAparelhosAbertos] = useState(false);

  return (
    <div className="relative flex flex-wrap items-center justify-center gap-2.5 border-t border-[var(--c-242424)] px-4 py-3">
      {aparelhosAbertos && (
        <PainelDeAparelhos observador={observador} fechar={() => setAparelhosAbertos(false)} />
      )}
      {!observador && (
        <>
          <TrackToggle source={Track.Source.Microphone}>Microfone</TrackToggle>
          <TrackToggle source={Track.Source.Camera}>Câmera</TrackToggle>
          <TrackToggle
            source={Track.Source.ScreenShare}
            captureOptions={{ audio: true, selfBrowserSurface: 'include' }}
          >
            {isScreenShareEnabled ? 'Parar de compartilhar' : 'Compartilhar tela'}
          </TrackToggle>
        </>
      )}

      <button
        type="button"
        className="lk-button"
        aria-pressed={aparelhosAbertos}
        onClick={() => setAparelhosAbertos((v) => !v)}
      >
        <Settings className="h-4 w-4" />
        Áudio e vídeo
      </button>

      <button type="button" className="lk-button" aria-pressed={chatAberto} onClick={alternarChat}>
        <MessageSquare className="h-4 w-4" />
        Chat
        {naoLidas > 0 && (
          <span className="ml-1 rounded-full bg-[var(--c-C0B072)] px-1.5 text-[11px] font-bold text-[var(--c-0D0D0D)]">
            {naoLidas}
          </span>
        )}
      </button>

      {gravacao && (
        <button
          type="button"
          className="lk-button"
          disabled={gravacao.mudando}
          onClick={gravacao.alternar}
          style={gravacao.gravando ? { color: 'var(--c-FF8A8E)' } : undefined}
        >
          {gravacao.gravando
            ? <Square className="h-4 w-4 fill-current" />
            : <Circle className="h-4 w-4 fill-[var(--c-E5484D)] text-[var(--c-E5484D)]" />}
          {gravacao.mudando ? 'Aguarde…' : gravacao.gravando ? 'Parar gravação' : 'Gravar'}
        </button>
      )}

      <DisconnectButton>Sair</DisconnectButton>
    </div>
  );
}

/**
 * Trocar microfone, câmera e alto-falante no meio da reunião (feedback da 1ª
 * reunião: o menu pequeno do LiveKit não era achado). Lista simples, grande,
 * em português. A troca vale na hora, sem sair da sala.
 */
function PainelDeAparelhos({ observador, fechar }: { observador: boolean; fechar: () => void }) {
  return (
    <div
      role="dialog"
      aria-label="Áudio e vídeo"
      className="absolute bottom-full left-1/2 z-40 mb-2 w-[360px] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border border-[var(--c-333333)] bg-[var(--c-121212)] p-4 shadow-2xl"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-base font-semibold text-[var(--c-F2EFE7)]">Áudio e vídeo</p>
        <button type="button" onClick={fechar} aria-label="Fechar" className="text-[var(--c-A9A294)] hover:text-[var(--c-F2EFE7)]">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="space-y-3">
        {!observador && <SeletorDeAparelho tipo="audioinput" rotulo="Microfone" />}
        {!observador && <SeletorDeAparelho tipo="videoinput" rotulo="Câmera" />}
        <SeletorDeAparelho tipo="audiooutput" rotulo="Alto-falante / fone" />
      </div>
    </div>
  );
}

function SeletorDeAparelho({ tipo, rotulo }: { tipo: MediaDeviceKind; rotulo: string }) {
  const [erro, setErro] = useState('');
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({
    kind: tipo,
    onError: () => setErro('Não consegui trocar. Veja se o navegador tem permissão.'),
  });
  // Alto-falante não dá para escolher em alguns navegadores (Safari, Firefox).
  if (tipo === 'audiooutput' && devices.length === 0) return null;
  const id = `aparelho-${tipo}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[13px] font-semibold text-[var(--c-BDB6A8)]">{rotulo}</label>
      <select
        id={id}
        value={activeDeviceId}
        onChange={(e) => {
          setErro('');
          void setActiveMediaDevice(e.target.value);
        }}
        className="w-full rounded-lg border border-[var(--c-333333)] bg-[var(--c-171717)] px-3 py-2.5 text-sm text-[var(--c-F2EFE7)]"
      >
        {devices.length === 0 && <option value="">Nenhum encontrado</option>}
        {devices.map((d, i) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `${rotulo} ${i + 1}`}
          </option>
        ))}
      </select>
      {erro && <p className="mt-1 text-[13px] text-[var(--c-F5A3A3)]">{erro}</p>}
    </div>
  );
}

/**
 * A gravação da sala. Quem diz se está gravando é o próprio LiveKit
 * (`useIsRecording`), então o selo aparece igual para todo mundo. Se a reunião
 * foi marcada com "Gravar automaticamente", o anfitrião liga sozinho assim que
 * conecta — uma vez só, para não religar depois que alguém parou de propósito.
 */
function useGravacao(cracha: Cracha) {
  const gravando = useIsRecording();
  const conexao = useConnectionState();
  const [mudando, setMudando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const jaLigouSozinho = useRef(false);
  const anfitriao = cracha.papel === 'anfitriao';

  async function muda(ligar: boolean) {
    setMudando(true);
    setErro(null);
    try {
      await gravaSala(cracha.sala.slug, ligar);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui mudar a gravação.');
      setTimeout(() => setErro(null), 8000);
    } finally {
      // O selo só muda quando o LiveKit confirma; segura o botão uns segundos.
      setTimeout(() => setMudando(false), 3000);
    }
  }

  useEffect(() => {
    if (!anfitriao || !cracha.sala.gravar || jaLigouSozinho.current) return;
    if (conexao !== ConnectionState.Connected || gravando) return;
    jaLigouSozinho.current = true;
    void muda(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anfitriao, cracha.sala.gravar, conexao, gravando]);

  return { gravando, mudando, erro: anfitriao ? erro : null, alternar: () => muda(!gravando) };
}

/** Chat da reunião. Some quando fecha; as mensagens continuam guardadas. */
function PainelChat({
  mensagens, enviar, enviando, podeEscrever, fechar,
}: {
  mensagens: ReturnType<typeof useChat>['chatMessages'];
  enviar: (texto: string) => Promise<unknown>;
  enviando: boolean;
  podeEscrever: boolean;
  fechar: () => void;
}) {
  const [texto, setTexto] = useState('');
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' });
  }, [mensagens.length]);

  async function mandar(ev: React.FormEvent) {
    ev.preventDefault();
    const t = texto.trim();
    if (!t) return;
    setTexto('');
    await enviar(t);
  }

  return (
    <aside className="flex w-[300px] shrink-0 flex-col rounded-2xl border border-[var(--c-242424)] bg-[var(--c-121212)]">
      <div className="flex items-center justify-between border-b border-[var(--c-242424)] px-4 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-[1.6px] text-[var(--c-8F8A80)]">Chat</span>
        <button type="button" onClick={fechar} aria-label="Fechar o chat" className="rounded-md p-1 text-[var(--c-8F8A80)] hover:text-[var(--c-F2EFE7)]">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {mensagens.length === 0 ? (
          <p className="pt-8 text-center text-sm text-[var(--c-78736B)]">Nenhuma mensagem ainda.</p>
        ) : (
          mensagens.map((m) => (
            <div key={m.id ?? `${m.timestamp}-${m.message}`}>
              <p className="text-[11px] font-semibold text-[var(--c-C0B072)]">
                {m.from?.isLocal ? 'Você' : m.from?.name || 'Participante'}
                <span className="ml-2 font-normal text-[var(--c-6F6A62)]">
                  {new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </p>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--c-E8E4DA)]">{m.message}</p>
            </div>
          ))
        )}
        <div ref={fim} />
      </div>

      {podeEscrever ? (
        <form onSubmit={mandar} className="flex gap-2 border-t border-[var(--c-242424)] p-3">
          <label htmlFor="msg-chat" className="sr-only">Mensagem</label>
          <input
            id="msg-chat"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escreva uma mensagem"
            className="min-h-[40px] min-w-0 flex-1 rounded-lg border border-[var(--c-2E2E2E)] bg-[var(--c-171717)] px-3 text-sm text-[var(--c-E8E4DA)] placeholder:text-[var(--c-6F6A62)] focus:border-[var(--c-C0B072)] focus:outline-none"
          />
          <button
            type="submit"
            disabled={enviando || !texto.trim()}
            aria-label="Enviar mensagem"
            className="flex min-h-[40px] w-10 items-center justify-center rounded-lg bg-[var(--c-C0B072)] text-[var(--c-0D0D0D)] disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <p className="border-t border-[var(--c-242424)] p-3 text-center text-xs text-[var(--c-78736B)]">
          Observador só lê o chat.
        </p>
      )}
    </aside>
  );
}

/** O painel da equipe, à esquerda. O lead nunca vê. */
function PainelEquipe({
  ocultarEu, salaId, tipo, engajamento, contextoParaCoach, segundos, alerta, aoMudarBloco, abordagem, podeMudar,
}: {
  ocultarEu: boolean;
  salaId: string | null;
  tipo: 1 | 2;
  engajamento: Engajamento;
  contextoParaCoach: () => string;
  segundos: Record<string, number>;
  alerta: string | null;
  aoMudarBloco: (bloco: string | null) => void;
  abordagem: Abordagem | null;
  podeMudar: boolean;
}) {
  return (
    <aside className="hidden w-[380px] shrink-0 flex-col gap-3 overflow-y-auto pr-1 lg:flex xl:w-[420px]">
      {/* O alerta de monólogo vem antes de tudo: é o que mais importa na hora. */}
      {alerta && <AlertaMonologo texto={alerta} />}
      {salaId && <ContextoDaReuniao salaId={salaId} inicial={abordagem} podeMudar={podeMudar} />}
      {/* Coach primeiro: é o que o closer olha durante a conversa. */}
      {salaId && (
        <PainelCoach salaId={salaId} tipo={tipo} engajamento={contextoParaCoach} aoMudarBloco={aoMudarBloco} />
      )}
      <PainelEngajamento engajamento={engajamento} />
      <TempoDeFala ocultarEu={ocultarEu} segundos={segundos} />
    </aside>
  );
}

/**
 * Como o lead chegou (inbound, outbound...). Escolhido no agendamento ou aqui
 * mesmo, durante a reunião — o Coach usa já na próxima dica.
 */
function ContextoDaReuniao({
  salaId, inicial, podeMudar,
}: {
  salaId: string;
  inicial: Abordagem | null;
  podeMudar: boolean;
}) {
  const [abordagem, setAbordagem] = useState<Abordagem | ''>(inicial ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(false);
  const atual = ABORDAGENS.find((a) => a.valor === abordagem);

  async function muda(v: Abordagem) {
    const antes = abordagem;
    setAbordagem(v);
    setSalvando(true);
    setErro(false);
    try {
      await mudaAbordagem(salaId, v);
    } catch {
      setAbordagem(antes);
      setErro(true);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className={`rounded-2xl border-2 p-4 ${abordagem ? 'border-[var(--c-333333)]' : 'border-[var(--c-E8A838)]'} bg-[var(--c-121212)]`}>
      <label htmlFor="abordagem-sala" className="mb-2 block text-[13px] font-semibold uppercase tracking-[1.6px] text-[var(--c-BDB6A8)]">
        Como o lead chegou
      </label>
      {podeMudar ? (
        <select
          id="abordagem-sala"
          value={abordagem}
          disabled={salvando}
          onChange={(e) => void muda(e.target.value as Abordagem)}
          className="w-full rounded-lg border border-[var(--c-333333)] bg-[var(--c-171717)] px-3 py-2.5 text-base font-semibold text-[var(--c-F2EFE7)]"
        >
          <option value="" disabled>Escolha: inbound, outbound…</option>
          {ABORDAGENS.map((a) => <option key={a.valor} value={a.valor}>{a.texto}</option>)}
        </select>
      ) : (
        <p className="text-base font-semibold text-[var(--c-F2EFE7)]">{atual?.texto ?? 'Não informado'}</p>
      )}
      <p className="mt-2 text-sm leading-snug text-[var(--c-C9C2B4)]">
        {erro ? 'Não consegui salvar. Tente de novo.' : atual?.dica ?? 'Escolha para o Coach ajustar as dicas a este tipo de lead.'}
      </p>
    </div>
  );
}

/** "Você está falando há 2 minutos seguidos…" — vermelho, na hora, sem esperar a IA. */
function AlertaMonologo({ texto }: { texto: string }) {
  return (
    <div role="alert" className="rounded-2xl border-2 border-[var(--c-E5484D)] bg-[var(--c-2A1212)] p-4 shadow-lg">
      <p className="mb-1 text-xs font-bold uppercase tracking-[1.4px] text-[var(--c-F5A3A3)]">⚠ Alerta</p>
      <p className="text-base font-semibold leading-snug text-[var(--c-F2EFE7)]">{texto}</p>
    </div>
  );
}

/**
 * Faixa embaixo do vídeo (só a equipe): a curva de engajamento da reunião
 * inteira, o tempo de fala com a faixa ideal e a etapa do método.
 */
function FaixaDaReuniao({
  cliente, segundos, bloco, roteiro,
}: {
  cliente: Engajamento['pessoas'][number] | null;
  segundos: Record<string, number>;
  bloco: string | null;
  roteiro: string[];
}) {
  const participantes = useParticipants();
  const daRT = participantes.filter(ehCloser).reduce((t, p) => t + (segundos[p.identity] ?? 0), 0);
  const deFora = participantes.filter(ehCliente).reduce((t, p) => t + (segundos[p.identity] ?? 0), 0);
  const total = daRT + deFora;
  const pctRT = total > 0 ? Math.round((daRT / total) * 100) : 0;
  const monopoliza = total >= 60 && pctRT > 60;
  const curva = cliente?.curva ?? [];
  const etapa = bloco ? roteiro.indexOf(bloco) : -1;

  return (
    <div className="hidden grid-cols-3 gap-3 px-3 pb-1 md:grid">
      <section className="rounded-xl border border-[var(--c-333333)] bg-[var(--c-121212)] px-4 py-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[1.4px] text-[var(--c-BDB6A8)]">
          Curva de engajamento{curva.length > 0 ? ` · ${curva.length} min` : ''}
        </p>
        {curva.length === 0 ? (
          <p className="text-sm text-[var(--c-A9A294)]">Começa quando o cliente aparecer na câmera.</p>
        ) : (
          <>
            <div className="flex h-10 items-end gap-[3px]" role="img" aria-label="Atenção do cliente minuto a minuto">
              {curva.slice(-30).map((m) => (
                <div
                  key={m.minuto}
                  title={`Minuto ${m.minuto}: ${m.atencao}%`}
                  className={`min-w-[5px] flex-1 rounded-t ${
                    cliente?.quedaDesde !== null && cliente?.quedaDesde !== undefined && m.minuto >= cliente.quedaDesde
                      ? 'bg-[var(--c-F0A35E)]'
                      : 'bg-[var(--c-7FD1A0)]'
                  }`}
                  style={{ height: `${Math.max(6, m.atencao)}%` }}
                />
              ))}
            </div>
            <p className="mt-1 text-[13px] text-[var(--c-BDB6A8)]">
              {cliente?.quedaDesde !== null && cliente?.quedaDesde !== undefined
                ? <span className="font-semibold text-[var(--c-F0A35E)]">Queda desde o minuto {cliente.quedaDesde}</span>
                : 'Sem queda agora'}
            </p>
          </>
        )}
      </section>

      <section className="rounded-xl border border-[var(--c-333333)] bg-[var(--c-121212)] px-4 py-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[1.4px] text-[var(--c-BDB6A8)]">Tempo de fala</p>
        {total === 0 ? (
          <p className="text-sm text-[var(--c-A9A294)]">Começa a contar quando alguém falar.</p>
        ) : (
          <>
            <div className="flex h-5 w-full overflow-hidden rounded-full bg-[var(--c-242424)]">
              <div
                className={`flex items-center justify-start pl-2 text-[11px] font-bold text-[var(--c-0D0D0D)] ${monopoliza ? 'bg-[var(--c-F0A35E)]' : 'bg-[var(--c-C0B072)]'}`}
                style={{ width: `${pctRT}%` }}
              >
                {pctRT >= 15 ? `RT ${pctRT}%` : ''}
              </div>
              <div className="flex flex-1 items-center justify-end pr-2 text-[11px] font-bold text-[var(--c-F2EFE7)]">
                {100 - pctRT >= 15 ? `Cliente ${100 - pctRT}%` : ''}
              </div>
            </div>
            <p className="mt-1 text-[13px] text-[var(--c-BDB6A8)]">
              {monopoliza
                ? <span className="font-semibold text-[var(--c-F0A35E)]">Fora da faixa: você está monopolizando</span>
                : 'Faixa ideal: a RT fala até metade do tempo'}
            </p>
          </>
        )}
      </section>

      <section className="rounded-xl border border-[var(--c-333333)] bg-[var(--c-121212)] px-4 py-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[1.4px] text-[var(--c-BDB6A8)]">Etapa do método</p>
        {etapa < 0 ? (
          <p className="text-sm text-[var(--c-A9A294)]">O Coach marca a etapa assim que a conversa engrenar.</p>
        ) : (
          <>
            <p className="text-lg font-bold text-[var(--c-F2EFE7)]">{bloco}</p>
            <div className="mt-1.5 flex gap-1">
              {roteiro.map((b, i) => (
                <span
                  key={b}
                  title={b}
                  className={`h-1.5 flex-1 rounded-full ${i < etapa ? 'bg-[var(--c-3E9E6A)]' : i === etapa ? 'bg-[var(--c-C0B072)]' : 'bg-[var(--c-242424)]'}`}
                />
              ))}
            </div>
            <p className="mt-1 text-[13px] text-[var(--c-BDB6A8)]">Etapa {etapa + 1} de {roteiro.length}</p>
          </>
        )}
      </section>
    </div>
  );
}

/**
 * Campainha de "alguém quer entrar": dois toques curtos, gerados na hora pelo
 * navegador (sem arquivo de som para baixar). Baixinho, para não assustar o
 * lead que está na chamada ouvindo pelo seu microfone.
 */
let audio: AudioContext | null = null;
function tocaCampainha() {
  try {
    audio ??= new AudioContext();
    void audio.resume();
    const agora = audio.currentTime;
    [880, 1175].forEach((freq, i) => {
      const osc = audio!.createOscillator();
      const volume = audio!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const inicio = agora + i * 0.18;
      volume.gain.setValueAtTime(0, inicio);
      volume.gain.linearRampToValueAtTime(0.12, inicio + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.35);
      osc.connect(volume).connect(audio!.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.4);
    });
  } catch {
    // Sem som (navegador bloqueou): o aviso na tela e a aba piscando continuam.
  }
}

/** Enquanto ninguém decide, a campainha volta a tocar de tempos em tempos. */
const REPETE_CAMPAINHA_MS = 20_000;

/**
 * Quem está na sala de espera. Pergunta ao porteiro a cada 3 segundos — é
 * pouco o bastante para parecer instantâneo e não pesa em nada.
 *
 * Quem está distraído não pode perder o pedido: quando chega alguém novo
 * toca a campainha, ela repete a cada 20 s enquanto houver gente esperando, e
 * a aba do navegador pisca "🔔 Fulano quer entrar" — isso aparece mesmo com o
 * anfitrião em outra aba.
 */
function PedidosDeEntrada({ slug }: { slug: string }) {
  const [pedidos, setPedidos] = useState<PedidoDeEntrada[]>([]);
  const [decidindo, setDecidindo] = useState<string | null>(null);
  const jaAvisados = useRef(new Set<string>());

  useEffect(() => {
    let vivo = true;
    const busca = () =>
      listaPedidos(slug)
        .then((lista) => {
          if (!vivo) return;
          const novos = lista.filter((p) => !jaAvisados.current.has(p.id));
          novos.forEach((p) => jaAvisados.current.add(p.id));
          if (novos.length > 0) tocaCampainha();
          setPedidos(lista);
        })
        .catch(() => undefined);
    void busca();
    const t = setInterval(busca, 3000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [slug]);

  const temGente = pedidos.length > 0;
  const primeiro = pedidos[0]?.nome?.split(' ')[0] ?? '';

  // Lembrete: toca de novo enquanto ainda houver alguém esperando.
  useEffect(() => {
    if (!temGente) return;
    const t = setInterval(tocaCampainha, REPETE_CAMPAINHA_MS);
    return () => clearInterval(t);
  }, [temGente]);

  // Aba piscando, alternando com o nome normal da aba.
  useEffect(() => {
    if (!temGente) return;
    const original = document.title;
    const alerta = pedidos.length > 1
      ? `🔔 ${pedidos.length} pessoas querem entrar`
      : `🔔 ${primeiro || 'Alguém'} quer entrar`;
    let mostrandoAlerta = false;
    const t = setInterval(() => {
      mostrandoAlerta = !mostrandoAlerta;
      document.title = mostrandoAlerta ? alerta : original;
    }, 1000);
    return () => {
      clearInterval(t);
      document.title = original;
    };
  }, [temGente, pedidos.length, primeiro]);

  async function decidir(id: string, aceitar: boolean) {
    setDecidindo(id);
    try {
      await decidePedido(id, aceitar);
      setPedidos((atuais) => atuais.filter((p) => p.id !== id));
    } finally {
      setDecidindo(null);
    }
  }

  if (pedidos.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--c-4A3A14)] bg-[var(--c-1E1708)] p-4 shadow-2xl shadow-black/60">
      <div className="mb-3 flex items-center gap-2">
        <UserPlus className="h-4 w-4 animate-pulse text-[var(--c-E8A838)]" />
        <span className="text-[11px] font-bold uppercase tracking-[1.6px] text-[var(--c-E8A838)]">
          Pedindo para entrar · {pedidos.length}
        </span>
      </div>
      <ul className="space-y-3">
        {pedidos.map((p) => (
          <li key={p.id}>
            <p className="text-sm font-semibold text-[var(--c-F0E3C6)]">{p.nome}</p>
            <p className="mb-2 truncate text-xs text-[var(--c-B5A27A)]">{p.email}</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={decidindo === p.id}
                onClick={() => decidir(p.id, true)}
                className="min-h-[36px] flex-1 rounded-lg bg-[var(--c-C0B072)] text-xs font-semibold text-[var(--c-0D0D0D)] disabled:opacity-50"
              >
                Aceitar
              </button>
              <button
                type="button"
                disabled={decidindo === p.id}
                onClick={() => decidir(p.id, false)}
                className="min-h-[36px] flex-1 rounded-lg border border-[var(--c-4A3A14)] text-xs font-semibold text-[var(--c-E8D6AE)] disabled:opacity-50"
              >
                Recusar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Tempo de fala: a cada segundo, soma 1 para quem está falando agora. O
 * LiveKit já sabe quem está falando (é o mesmo sinal que acende a borda do
 * vídeo), então não precisa de transcrição para isso.
 */
function TempoDeFala({ ocultarEu, segundos }: { ocultarEu: boolean; segundos: Record<string, number> }) {
  const participantes = useParticipants();

  const pessoas = useMemo(
    () => participantes.filter((p) => ehGente(p) && !(ocultarEu && p.isLocal)),
    [participantes, ocultarEu],
  );
  const total = pessoas.reduce((soma, p) => soma + (segundos[p.identity] ?? 0), 0);
  const quemDomina = total >= 60
    ? pessoas.find((p) => (segundos[p.identity] ?? 0) / total > 0.65)
    : undefined;

  return (
    <div className="rounded-2xl border border-[var(--c-333333)] bg-[var(--c-121212)] p-4">
      <p className="mb-3 text-[13px] font-semibold uppercase tracking-[1.6px] text-[var(--c-BDB6A8)]">Tempo de fala</p>
      {total === 0 ? (
        <p className="text-sm text-[var(--c-A9A294)]">Começa a contar quando alguém falar.</p>
      ) : (
        <ul className="space-y-2.5">
          {pessoas.map((p) => {
            const s = segundos[p.identity] ?? 0;
            const pct = Math.round((s / total) * 100);
            return (
              <li key={p.identity}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="truncate text-[var(--c-E8E4DA)]">{p.isLocal ? 'Você' : p.name || 'Participante'}</span>
                  <span className="tabular-nums text-[var(--c-B5AE9E)]">
                    {relogio(s)} · <strong className="text-[var(--c-F2EFE7)]">{pct}%</strong>
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[var(--c-242424)]">
                  <div className="h-1.5 rounded-full bg-[var(--c-C0B072)]" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {quemDomina && (
        <p className="mt-3 rounded-lg border border-[var(--c-4A3A14)] bg-[var(--c-1E1708)] px-3 py-2 text-sm leading-relaxed text-[var(--c-F0E3C6)]">
          {quemDomina.isLocal ? 'Você está' : `${quemDomina.name || 'Alguém'} está`} com mais de 65% da fala.
          {quemDomina.isLocal ? ' Faça uma pergunta e devolva a palavra.' : ''}
        </p>
      )}
    </div>
  );
}
