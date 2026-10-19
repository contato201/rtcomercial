import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CarouselLayout, DisconnectButton, FocusLayout, FocusLayoutContainer, GridLayout,
  LayoutContextProvider, LiveKitRoom, MediaDeviceMenu, ParticipantTile, RoomAudioRenderer,
  TrackToggle, isTrackReference, useChat, useConnectionState, useCreateLayoutContext,
  useIsRecording, useLocalParticipant, useParticipants, usePinnedTracks,
  useSpeakingParticipants, useTracks,
} from '@livekit/components-react';
import { ConnectionState, RoomEvent, Track, type Participant } from 'livekit-client';
import { Check, Circle, Eye, Link2, MessageSquare, Send, Square, UserPlus, X } from 'lucide-react';
import '@livekit/components-styles';
import logo from '@/assets/logo-pequena.png';
import { PainelCoach } from './PainelCoach';
import {
  decidePedido, gravaSala, linkDaSala, listaPedidos, type Cracha, type PedidoDeEntrada,
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
 * A sala é sempre escura, independente do tema do dashboard: fundo claro atrás
 * de uma chamada de vídeo cansa a vista e rouba atenção do rosto.
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

export const SalaAoVivo = ({ cracha, aoSair }: { cracha: Cracha; aoSair: () => void }) => {
  const [segundos, setSegundos] = useState(0);
  const [copiado, setCopiado] = useState(false);
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
    <div className="flex h-screen flex-col bg-[#0A0A0A] text-[#F2EFE7]">
      {observador && (
        <div className="flex flex-wrap items-center justify-center gap-2 border-b border-[#1F2A33] bg-[#101418] px-6 py-2.5 text-center">
          <Eye className="h-4 w-4 text-[#6FA3C0]" />
          <span className="text-xs font-semibold text-[#9FC4D8]">Modo observador</span>
          <span className="text-xs text-[#7F93A0]">— você não é visto nem ouvido pelo lead</span>
        </div>
      )}

      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#242424] px-6 py-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <img
            src={logo}
            alt="Reproduzindo Talentos"
            className="h-10 w-10 shrink-0 rounded-[10px] border border-[#2E2E2E]"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{cracha.sala.titulo}</p>
            <p className="truncate text-[11px] text-[#8F8A80]">{subtitulo}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {equipe && (
            <button
              type="button"
              onClick={convidar}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-[#3A3524] bg-[#1C1A14] px-3.5 text-xs font-semibold text-[#C0B072] transition-colors hover:bg-[#25221A]"
            >
              {copiado ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
              {copiado ? 'Link copiado' : 'Convidar'}
            </button>
          )}
          <span className="rounded-full border border-[#2E2E2E] bg-[#171717] px-3 py-1.5 text-xs font-semibold tabular-nums text-[#D7D2C6]">
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
          ['--lk-bg' as string]: '#0A0A0A',
          ['--lk-bg2' as string]: '#121212',
          ['--lk-bg3' as string]: '#171717',
          ['--lk-bg4' as string]: '#1E1E1E',
          ['--lk-fg' as string]: '#F2EFE7',
          ['--lk-fg2' as string]: '#B5AE9E',
          ['--lk-border-color' as string]: '#242424',
          ['--lk-accent-bg' as string]: '#C0B072',
          ['--lk-accent-fg' as string]: '#0D0D0D',
          ['--lk-danger' as string]: '#E5484D',
          ['--lk-control-bg' as string]: '#171717',
          ['--lk-control-hover-bg' as string]: '#242424',
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

  return (
    <LayoutContextProvider value={layout}>
      <div className="flex h-full flex-col">
        <div className="flex min-h-0 flex-1 gap-3 p-3">
          {equipe && (
            <PainelEquipe
              ocultarEu={observador}
              salaId={cracha.sala.id}
              tipo={cracha.sala.tipo_reuniao ?? 1}
            />
          )}

          <div className="relative min-h-0 min-w-0 flex-1">
            <Palco ocultarEu={observador} />
            {/* Todo mundo vê quando está gravando — o lead inclusive. */}
            {gravacao.gravando && (
              <div className="pointer-events-none absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-[#E5484D] px-3 py-1 text-xs font-semibold text-white shadow-lg">
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                Gravando
              </div>
            )}
            {gravacao.erro && (
              <div className="absolute bottom-3 left-3 z-20 max-w-[320px] rounded-xl border border-[#5A2A2A] bg-[#1F1414] px-3 py-2 text-xs text-[#F2B8B8]">
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
      <div className="flex h-full items-center justify-center rounded-2xl border border-[#242424] bg-[#121212] text-sm text-[#8F8A80]">
        Ninguém na sala ainda.
      </div>
    );
  }

  return foco ? (
    <div className="lk-focus-layout-wrapper" style={{ height: '100%' }}>
      <FocusLayoutContainer>
        <CarouselLayout tracks={resto}>
          <ParticipantTile />
        </CarouselLayout>
        <FocusLayout trackRef={foco} />
      </FocusLayoutContainer>
    </div>
  ) : (
    <div className="lk-grid-layout-wrapper" style={{ height: '100%' }}>
      <GridLayout tracks={trilhas}>
        <ParticipantTile />
      </GridLayout>
    </div>
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

  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5 border-t border-[#242424] px-4 py-3">
      {!observador && (
        <>
          <div className="lk-button-group">
            <TrackToggle source={Track.Source.Microphone}>Microfone</TrackToggle>
            <div className="lk-button-group-menu">
              <MediaDeviceMenu kind="audioinput" />
            </div>
          </div>
          <div className="lk-button-group">
            <TrackToggle source={Track.Source.Camera}>Câmera</TrackToggle>
            <div className="lk-button-group-menu">
              <MediaDeviceMenu kind="videoinput" />
            </div>
          </div>
          <TrackToggle
            source={Track.Source.ScreenShare}
            captureOptions={{ audio: true, selfBrowserSurface: 'include' }}
          >
            {isScreenShareEnabled ? 'Parar de compartilhar' : 'Compartilhar tela'}
          </TrackToggle>
        </>
      )}

      <button type="button" className="lk-button" aria-pressed={chatAberto} onClick={alternarChat}>
        <MessageSquare className="h-4 w-4" />
        Chat
        {naoLidas > 0 && (
          <span className="ml-1 rounded-full bg-[#C0B072] px-1.5 text-[11px] font-bold text-[#0D0D0D]">
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
          style={gravacao.gravando ? { color: '#FF8A8E' } : undefined}
        >
          {gravacao.gravando
            ? <Square className="h-4 w-4 fill-current" />
            : <Circle className="h-4 w-4 fill-[#E5484D] text-[#E5484D]" />}
          {gravacao.mudando ? 'Aguarde…' : gravacao.gravando ? 'Parar gravação' : 'Gravar'}
        </button>
      )}

      <DisconnectButton>Sair</DisconnectButton>
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
    <aside className="flex w-[300px] shrink-0 flex-col rounded-2xl border border-[#242424] bg-[#121212]">
      <div className="flex items-center justify-between border-b border-[#242424] px-4 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-[1.6px] text-[#8F8A80]">Chat</span>
        <button type="button" onClick={fechar} aria-label="Fechar o chat" className="rounded-md p-1 text-[#8F8A80] hover:text-[#F2EFE7]">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {mensagens.length === 0 ? (
          <p className="pt-8 text-center text-sm text-[#78736B]">Nenhuma mensagem ainda.</p>
        ) : (
          mensagens.map((m) => (
            <div key={m.id ?? `${m.timestamp}-${m.message}`}>
              <p className="text-[11px] font-semibold text-[#C0B072]">
                {m.from?.isLocal ? 'Você' : m.from?.name || 'Participante'}
                <span className="ml-2 font-normal text-[#6F6A62]">
                  {new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </p>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#E8E4DA]">{m.message}</p>
            </div>
          ))
        )}
        <div ref={fim} />
      </div>

      {podeEscrever ? (
        <form onSubmit={mandar} className="flex gap-2 border-t border-[#242424] p-3">
          <label htmlFor="msg-chat" className="sr-only">Mensagem</label>
          <input
            id="msg-chat"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escreva uma mensagem"
            className="min-h-[40px] min-w-0 flex-1 rounded-lg border border-[#2E2E2E] bg-[#171717] px-3 text-sm text-[#E8E4DA] placeholder:text-[#6F6A62] focus:border-[#C0B072] focus:outline-none"
          />
          <button
            type="submit"
            disabled={enviando || !texto.trim()}
            aria-label="Enviar mensagem"
            className="flex min-h-[40px] w-10 items-center justify-center rounded-lg bg-[#C0B072] text-[#0D0D0D] disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <p className="border-t border-[#242424] p-3 text-center text-xs text-[#78736B]">
          Observador só lê o chat.
        </p>
      )}
    </aside>
  );
}

/** O painel da equipe, à esquerda. O lead nunca vê. */
function PainelEquipe({ ocultarEu, salaId, tipo }: { ocultarEu: boolean; salaId: string | null; tipo: 1 | 2 }) {
  return (
    <aside className="hidden w-[320px] shrink-0 flex-col gap-3 overflow-y-auto pr-1 lg:flex">
      {/* Coach primeiro: é o que o closer olha durante a conversa. */}
      {salaId && <PainelCoach salaId={salaId} tipo={tipo} />}
      <TempoDeFala ocultarEu={ocultarEu} />
    </aside>
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
    <div className="rounded-2xl border border-[#4A3A14] bg-[#1E1708] p-4 shadow-2xl shadow-black/60">
      <div className="mb-3 flex items-center gap-2">
        <UserPlus className="h-4 w-4 animate-pulse text-[#E8A838]" />
        <span className="text-[11px] font-bold uppercase tracking-[1.6px] text-[#E8A838]">
          Pedindo para entrar · {pedidos.length}
        </span>
      </div>
      <ul className="space-y-3">
        {pedidos.map((p) => (
          <li key={p.id}>
            <p className="text-sm font-semibold text-[#F0E3C6]">{p.nome}</p>
            <p className="mb-2 truncate text-xs text-[#B5A27A]">{p.email}</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={decidindo === p.id}
                onClick={() => decidir(p.id, true)}
                className="min-h-[36px] flex-1 rounded-lg bg-[#C0B072] text-xs font-semibold text-[#0D0D0D] disabled:opacity-50"
              >
                Aceitar
              </button>
              <button
                type="button"
                disabled={decidindo === p.id}
                onClick={() => decidir(p.id, false)}
                className="min-h-[36px] flex-1 rounded-lg border border-[#4A3A14] text-xs font-semibold text-[#E8D6AE] disabled:opacity-50"
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
function TempoDeFala({ ocultarEu }: { ocultarEu: boolean }) {
  const falando = useSpeakingParticipants();
  const participantes = useParticipants();
  const [segundos, setSegundos] = useState<Record<string, number>>({});
  const falandoAgora = useRef(falando);
  falandoAgora.current = falando;

  useEffect(() => {
    const t = setInterval(() => {
      const ids = falandoAgora.current.filter(ehGente).map((p) => p.identity);
      if (ids.length === 0) return;
      setSegundos((s) => {
        const novo = { ...s };
        ids.forEach((id) => (novo[id] = (novo[id] ?? 0) + 1));
        return novo;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const pessoas = useMemo(
    () => participantes.filter((p) => ehGente(p) && !(ocultarEu && p.isLocal)),
    [participantes, ocultarEu],
  );
  const total = pessoas.reduce((soma, p) => soma + (segundos[p.identity] ?? 0), 0);
  const quemDomina = total >= 60
    ? pessoas.find((p) => (segundos[p.identity] ?? 0) / total > 0.65)
    : undefined;

  return (
    <div className="rounded-2xl border border-[#242424] bg-[#121212] p-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[1.6px] text-[#8F8A80]">Tempo de fala</p>
      {total === 0 ? (
        <p className="text-xs text-[#78736B]">Começa a contar quando alguém falar.</p>
      ) : (
        <ul className="space-y-2.5">
          {pessoas.map((p) => {
            const s = segundos[p.identity] ?? 0;
            const pct = Math.round((s / total) * 100);
            return (
              <li key={p.identity}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="truncate text-[#E8E4DA]">{p.isLocal ? 'Você' : p.name || 'Participante'}</span>
                  <span className="tabular-nums text-[#B5AE9E]">
                    {relogio(s)} · <strong className="text-[#F2EFE7]">{pct}%</strong>
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#242424]">
                  <div className="h-1.5 rounded-full bg-[#C0B072]" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {quemDomina && (
        <p className="mt-3 rounded-lg border border-[#4A3A14] bg-[#1E1708] px-3 py-2 text-xs leading-relaxed text-[#F0E3C6]">
          {quemDomina.isLocal ? 'Você está' : `${quemDomina.name || 'Alguém'} está`} com mais de 65% da fala.
          {quemDomina.isLocal ? ' Faça uma pergunta e devolva a palavra.' : ''}
        </p>
      )}
    </div>
  );
}
