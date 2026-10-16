import { useEffect, useState } from 'react';
import { LiveKitRoom, RoomAudioRenderer, VideoConference } from '@livekit/components-react';
import { Eye } from 'lucide-react';
import '@livekit/components-styles';
import type { Cracha } from '@/lib/salas';

/**
 * A sala em si. O vídeo e o áudio são do LiveKit; a moldura (cabeçalho com o
 * nome da reunião, o relógio, o aviso de gravação e a tarja do observador) é
 * nossa — é o que faz a sala ser da RT e não de terceiro.
 *
 * A sala é sempre escura, independente do tema do dashboard: fundo claro
 * atrás de uma chamada de vídeo cansa a vista e rouba atenção do rosto.
 */

const relogio = (segundos: number) => {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  const dois = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${dois(h)}:${dois(m)}:${dois(s)}` : `${dois(m)}:${dois(s)}`;
};

export const SalaAoVivo = ({ cracha, aoSair }: { cracha: Cracha; aoSair: () => void }) => {
  const [segundos, setSegundos] = useState(0);
  const observador = cracha.papel === 'observador';

  useEffect(() => {
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

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
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-[#2E2E2E] bg-[#171717] text-xs font-bold text-[#C0B072]">
            RT
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{cracha.sala.titulo}</p>
            <p className="truncate text-[11px] text-[#8F8A80]">
              {cracha.sala.lead_nome} · SDR {cracha.sala.sdr}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="rounded-full border border-[#2E2E2E] bg-[#171717] px-3 py-1.5 text-xs font-semibold tabular-nums text-[#D7D2C6]">
            {relogio(segundos)}
          </span>
        </div>
      </header>

      {/* As variáveis --lk-* vestem os controles do LiveKit com a cor da RT. */}
      <div
        className="min-h-0 flex-1"
        data-lk-theme="default"
        style={{
          ['--lk-bg' as string]: '#0A0A0A',
          ['--lk-bg2' as string]: '#121212',
          ['--lk-bg3' as string]: '#171717',
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
          <VideoConference />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>
    </div>
  );
};
