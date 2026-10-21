import { useEffect, useRef, useState } from 'react';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { PenLine } from 'lucide-react';
import {
  TOPICO_CANETA, VIDA_DO_RISCO_MS, areaDaImagem, codifica, corDaPessoa, daImagem, decodifica, opacidade,
  paraImagem, type Caixa,
} from '@/lib/caneta';

/**
 * Caneta laser em cima da tela compartilhada (pedido do Allan: "a canetinha do
 * Google Meet, o laserzinho que vai desaparecendo sozinho").
 *
 * Fica por cima do vídeo da tela compartilhada. Com a caneta ligada, arrastar
 * o mouse risca; o risco aparece para todos e some em menos de 2 segundos.
 * Desligada, a camada não atrapalha os cliques. Esc desliga.
 */

const ENVIA_A_CADA_MS = 40;

interface Ponto { x: number; y: number; t: number }

export function CanetaLaser({ podeRiscar }: { podeRiscar: boolean }) {
  const sala = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const camada = useRef<HTMLDivElement>(null);
  const tela = useRef<HTMLCanvasElement>(null);
  const [ligada, setLigada] = useState(false);

  // Riscos vivos de todo mundo: traço → cor + pontos com a hora em que chegaram.
  const riscos = useRef(new Map<string, { cor: string; pontos: Ponto[] }>());
  const desenhando = useRef(false);

  const area = (): Caixa | null => {
    const div = camada.current;
    const video = div?.parentElement?.querySelector('video');
    if (!div || !video) return null;
    const r = div.getBoundingClientRect();
    return areaDaImagem({ w: r.width, h: r.height }, { w: video.videoWidth, h: video.videoHeight });
  };

  const guarda = (traco: string, cor: string, pontos: Array<[number, number]>) => {
    const agora = performance.now();
    const r = riscos.current.get(traco) ?? { cor, pontos: [] };
    pontos.forEach(([x, y]) => r.pontos.push({ x, y, t: agora }));
    riscos.current.set(traco, r);
    desenhando.current = true;
  };

  // Recebe os riscos dos outros.
  useEffect(() => {
    const recebe = (dados: Uint8Array, _p?: unknown, _k?: unknown, topico?: string) => {
      if (topico !== TOPICO_CANETA) return;
      const pedaco = decodifica(dados);
      if (pedaco) guarda(pedaco.traco, pedaco.cor, pedaco.pontos);
    };
    sala.on(RoomEvent.DataReceived, recebe);
    return () => {
      sala.off(RoomEvent.DataReceived, recebe);
    };
  }, [sala]);

  // Desenha enquanto houver risco vivo; para sozinho quando tudo sumiu.
  useEffect(() => {
    let quadro = 0;
    const pinta = () => {
      quadro = requestAnimationFrame(pinta);
      const c = tela.current;
      const div = camada.current;
      if (!c || !div) return;
      const r = div.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (c.width !== Math.round(r.width * dpr) || c.height !== Math.round(r.height * dpr)) {
        c.width = Math.round(r.width * dpr);
        c.height = Math.round(r.height * dpr);
      }
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, r.width, r.height);
      if (!desenhando.current) return;

      const a = area();
      const agora = performance.now();
      let vivo = false;
      riscos.current.forEach((risco, traco) => {
        risco.pontos = risco.pontos.filter((p) => agora - p.t < VIDA_DO_RISCO_MS);
        if (risco.pontos.length === 0) {
          riscos.current.delete(traco);
          return;
        }
        vivo = true;
        if (!a) return;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = risco.cor;
        ctx.shadowColor = risco.cor;
        ctx.shadowBlur = 10;
        ctx.lineWidth = 5;
        for (let i = 1; i < risco.pontos.length; i++) {
          const p0 = risco.pontos[i - 1];
          const p1 = risco.pontos[i];
          ctx.globalAlpha = opacidade(agora - p1.t);
          const [x0, y0] = daImagem([p0.x, p0.y], a);
          const [x1, y1] = daImagem([p1.x, p1.y], a);
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }
        if (risco.pontos.length === 1) {
          const [x, y] = daImagem([risco.pontos[0].x, risco.pontos[0].y], a);
          ctx.globalAlpha = opacidade(agora - risco.pontos[0].t);
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fillStyle = risco.cor;
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
      desenhando.current = vivo;
    };
    quadro = requestAnimationFrame(pinta);
    return () => cancelAnimationFrame(quadro);
  }, []);

  // Esc desliga a caneta.
  useEffect(() => {
    if (!ligada) return;
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setLigada(false);
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [ligada]);

  // ── Riscar ───────────────────────────────────────────────────────────────
  const cor = corDaPessoa(localParticipant.identity);
  const tracoAtual = useRef<string | null>(null);
  const fila = useRef<Array<[number, number]>>([]);
  const ultimoEnvio = useRef(0);

  const envia = () => {
    if (!tracoAtual.current || fila.current.length === 0) return;
    const pedaco = { traco: tracoAtual.current, cor, pontos: fila.current.splice(0) };
    void localParticipant.publishData(codifica(pedaco), { reliable: false, topic: TOPICO_CANETA }).catch(() => undefined);
    ultimoEnvio.current = performance.now();
  };

  const ponto = (e: React.PointerEvent) => {
    const a = area();
    const div = camada.current;
    if (!a || !div || !tracoAtual.current) return;
    const r = div.getBoundingClientRect();
    const p = paraImagem(e.clientX - r.left, e.clientY - r.top, a);
    if (!p) return;
    guarda(tracoAtual.current, cor, [p]);
    fila.current.push(p);
    if (performance.now() - ultimoEnvio.current >= ENVIA_A_CADA_MS) envia();
  };

  return (
    <div ref={camada} className="pointer-events-none absolute inset-0 z-10">
      <canvas ref={tela} className="absolute inset-0 h-full w-full" />
      {ligada && (
        <div
          className="pointer-events-auto absolute inset-0 cursor-crosshair touch-none"
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            tracoAtual.current = `${localParticipant.identity}-${Date.now()}`;
            ponto(e);
          }}
          onPointerMove={(e) => tracoAtual.current && ponto(e)}
          onPointerUp={() => {
            envia();
            tracoAtual.current = null;
          }}
          onPointerCancel={() => {
            envia();
            tracoAtual.current = null;
          }}
        />
      )}
      {podeRiscar && (
        <button
          type="button"
          onClick={() => setLigada((v) => !v)}
          aria-pressed={ligada}
          title={ligada ? 'Desligar a caneta (Esc)' : 'Caneta laser: arraste para marcar a tela'}
          className={`pointer-events-auto absolute left-1/2 top-3 z-20 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold shadow-lg transition-colors ${
            ligada ? 'bg-[#FF3B30] text-white' : 'bg-black/75 text-white hover:bg-black/90'
          }`}
        >
          <PenLine className="h-4 w-4" />
          {ligada ? 'Caneta ligada — Esc desliga' : 'Caneta'}
          <span className="h-2.5 w-2.5 rounded-full border border-white/70" style={{ backgroundColor: cor }} />
        </button>
      )}
    </div>
  );
}
