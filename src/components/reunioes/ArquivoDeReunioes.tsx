import { useEffect, useMemo, useState } from 'react';
import {
  Clock, Eye, FileText, Gauge, Mic, Search, Star, UserCheck, Video,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  FILTROS_PADRAO, buscaResumos, closersDoArquivo, filtraArquivo, montaArquivo, numerosDoArquivo,
  type Filtros, type ItemArquivo, type Periodo, type ResumoReuniao, type SoMostrar,
} from '@/lib/arquivo';
import { duracaoMin, quando, type Sala } from '@/lib/salas';

/**
 * Aba "Arquivo" da tela Reuniões: tudo o que já aconteceu, organizado.
 * Números no topo, filtros, e uma linha por reunião com o que ela tem guardado
 * (vídeo, transcrição, relatório). Clicar abre o detalhe.
 */

const PERIODOS: Array<{ valor: Periodo; texto: string }> = [
  { valor: '7', texto: 'Últimos 7 dias' },
  { valor: '30', texto: 'Últimos 30 dias' },
  { valor: '90', texto: 'Últimos 90 dias' },
  { valor: 'tudo', texto: 'Desde o começo' },
];
const SO: Array<{ valor: SoMostrar; texto: string }> = [
  { valor: 'todas', texto: 'Todas as reuniões' },
  { valor: 'gravadas', texto: 'Só gravadas' },
  { valor: 'transcritas', texto: 'Só com transcrição' },
  { valor: 'com_relatorio', texto: 'Só com relatório' },
];

const corDaNota = (n: number) => (n >= 8 ? 'text-success' : n >= 6 ? 'text-warning' : 'text-destructive');

export function ArquivoDeReunioes({
  salas, versao, abrir,
}: {
  salas: Sala[];
  /** Muda quando a lista é recarregada — busca os resumos de novo. */
  versao: number;
  abrir: (sala: Sala, aba?: string) => void;
}) {
  const [resumos, setResumos] = useState<ResumoReuniao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_PADRAO);

  useEffect(() => {
    setCarregando(true);
    buscaResumos().then(setResumos).finally(() => setCarregando(false));
  }, [versao]);

  const arquivo = useMemo(() => montaArquivo(salas, resumos), [salas, resumos]);
  const lista = useMemo(() => filtraArquivo(arquivo, filtros), [arquivo, filtros]);
  const numeros = useMemo(() => numerosDoArquivo(lista), [lista]);
  const closers = useMemo(() => closersDoArquivo(arquivo), [arquivo]);

  const muda = (parte: Partial<Filtros>) => setFiltros((f) => ({ ...f, ...parte }));

  return (
    <div>
      {/* Números do período escolhido */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Numero icone={Video} rotulo="Reuniões" valor={String(numeros.reunioes)}
          detalhe={numeros.minutosMedios !== null ? `${numeros.minutosMedios} min em média` : undefined} />
        <Numero icone={Mic} rotulo="Gravadas" valor={String(numeros.gravadas)}
          detalhe={`${String(numeros.horasGravadas).replace('.', ',')} h de vídeo · ${numeros.transcritas} transcritas`} />
        <Numero icone={Star} rotulo="Nota média do Coach"
          valor={numeros.notaMedia !== null ? String(numeros.notaMedia).replace('.', ',') : '—'}
          detalhe={numeros.atencaoMedia !== null ? `atenção do cliente ${numeros.atencaoMedia}%` : undefined} />
        <Numero icone={UserCheck} rotulo="Comparecimento"
          valor={numeros.comparecimento !== null ? `${numeros.comparecimento}%` : '—'}
          detalhe="leads que entraram na sala" />
      </div>

      {/* Filtros */}
      <div className="mb-4 grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filtros.busca}
            onChange={(e) => muda({ busca: e.target.value })}
            placeholder="Buscar lead, escola, e-mail…"
            className="pl-9"
            aria-label="Buscar reunião"
          />
        </div>
        <Select value={filtros.periodo} onValueChange={(v) => muda({ periodo: v as Periodo })}>
          <SelectTrigger aria-label="Período"><SelectValue /></SelectTrigger>
          <SelectContent>{PERIODOS.map((p) => <SelectItem key={p.valor} value={p.valor}>{p.texto}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filtros.closer || 'todos'} onValueChange={(v) => muda({ closer: v === 'todos' ? '' : v })}>
          <SelectTrigger aria-label="Closer"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os closers</SelectItem>
            {closers.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtros.so} onValueChange={(v) => muda({ so: v as SoMostrar })}>
          <SelectTrigger aria-label="Mostrar"><SelectValue /></SelectTrigger>
          <SelectContent>{SO.map((s) => <SelectItem key={s.valor} value={s.valor}>{s.texto}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {carregando ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Carregando o arquivo…</p>
      ) : lista.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          {arquivo.length === 0
            ? 'Nenhuma reunião terminou ainda. Quando terminar, ela aparece aqui com vídeo, transcrição e relatório.'
            : 'Nenhuma reunião com esses filtros. Tente outro período.'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {/* Cabeçalho (só em tela larga) */}
          <div className="hidden grid-cols-[1.6fr_1fr_0.7fr_0.6fr_1.2fr] gap-4 border-b border-border px-5 py-3 text-[11px] font-semibold uppercase tracking-[1.4px] text-muted-foreground md:grid">
            <span>Reunião</span><span>Equipe</span><span>Duração</span><span>Nota</span><span>Guardado</span>
          </div>
          <ul className="divide-y divide-border">
            {lista.map((s) => <Linha key={s.id} item={s} abrir={abrir} />)}
          </ul>
        </div>
      )}
      {lista.length > 0 && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {lista.length} reuniã{lista.length > 1 ? 'ões' : 'o'} · clique numa linha para ver tudo
        </p>
      )}
    </div>
  );
}

function Numero({
  icone: Icone, rotulo, valor, detalhe,
}: {
  icone: React.ComponentType<{ className?: string }>;
  rotulo: string;
  valor: string;
  detalhe?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icone className="h-3.5 w-3.5" />
        {rotulo}
      </div>
      <p className="text-2xl font-bold tabular-nums text-foreground">{valor}</p>
      {detalhe && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{detalhe}</p>}
    </div>
  );
}

function Linha({ item: s, abrir }: { item: ItemArquivo; abrir: (sala: Sala, aba?: string) => void }) {
  const minutos = duracaoMin(s);
  const r = s.resumo;
  const selo = (ativo: boolean, Icone: React.ComponentType<{ className?: string }>, texto: string, aba: string) => (
    <button
      type="button"
      disabled={!ativo}
      onClick={(e) => {
        e.stopPropagation();
        abrir(s, aba);
      }}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
        ativo
          ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/20'
          : 'cursor-default border-border text-muted-foreground/50'
      }`}
    >
      <Icone className="h-3 w-3" />
      {texto}
    </button>
  );

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={() => abrir(s)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), abrir(s))}
        className="grid cursor-pointer gap-2 px-5 py-4 transition-colors hover:bg-muted/40 md:grid-cols-[1.6fr_1fr_0.7fr_0.6fr_1.2fr] md:items-center md:gap-4"
      >
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{s.lead_nome ?? s.titulo}</p>
          <p className="truncate text-xs text-muted-foreground">
            {quando(s.inicio)}
            {s.lead_email && !s.lead_entrou && !s.instantanea && <span className="text-warning"> · lead não entrou</span>}
          </p>
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {[s.closer, s.sdr && `SDR ${s.sdr}`].filter(Boolean).join(' · ') || '—'}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5 md:hidden" />
          {minutos !== null ? `${minutos} min` : '—'}
        </p>
        <p className="flex items-center gap-1.5 text-sm">
          {r.nota !== null ? (
            <span className={`font-bold tabular-nums ${corDaNota(r.nota)}`}>{r.nota}/10</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          {r.atencao_media !== null && (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground" title="Atenção média do cliente">
              <Gauge className="h-3 w-3" />{r.atencao_media}%
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {selo(r.gravacoes > 0, Video, 'Vídeo', 'video')}
          {selo(r.falas > 0, Mic, 'Transcrição', 'transcricao')}
          {selo(r.tem_relatorio || r.falas > 0, FileText, 'Relatório', 'relatorio')}
          {r.atencao_media !== null && selo(true, Eye, 'Engajamento', 'engajamento')}
        </div>
      </div>
    </li>
  );
}
