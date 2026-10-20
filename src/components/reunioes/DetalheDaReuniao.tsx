import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Check, Copy, Download, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  agrupaFalas, buscaEngajamento, buscaTranscricao, tempoDaFala, transcricaoComoTexto,
  type Fala, type MinutoEngajamento,
} from '@/lib/arquivo';
import { CAMPOS_FICHA, buscaCoach, geraRelatorio, type RegistroCoach } from '@/lib/coach';
import {
  duracaoMin, linkDaGravacao, listaGravacoes, quando, type Gravacao, type Sala,
} from '@/lib/salas';

/**
 * Tudo de uma reunião numa janela só: resumo (ficha do Coach), vídeo,
 * transcrição completa (com busca e para baixar), relatório e engajamento.
 */

export type AbaDetalhe = 'resumo' | 'video' | 'transcricao' | 'relatorio' | 'engajamento';

export function DetalheDaReuniao({
  sala, aba, mudaAba, fechar,
}: {
  sala: Sala | null;
  aba: AbaDetalhe;
  mudaAba: (aba: AbaDetalhe) => void;
  fechar: () => void;
}) {
  const [carregando, setCarregando] = useState(false);
  const [coach, setCoach] = useState<RegistroCoach | null>(null);
  const [gravacoes, setGravacoes] = useState<Gravacao[]>([]);
  const [falas, setFalas] = useState<Fala[]>([]);
  const [engajamento, setEngajamento] = useState<MinutoEngajamento[]>([]);

  useEffect(() => {
    if (!sala) return;
    setCarregando(true);
    setCoach(null);
    setGravacoes([]);
    setFalas([]);
    setEngajamento([]);
    Promise.all([
      buscaCoach(sala.id).then(setCoach).catch(() => undefined),
      listaGravacoes(sala.id).then(setGravacoes).catch(() => undefined),
      buscaTranscricao(sala.id).then(setFalas).catch(() => undefined),
      buscaEngajamento(sala.id).then(setEngajamento).catch(() => undefined),
    ]).finally(() => setCarregando(false));
  }, [sala]);

  const minutos = sala ? duracaoMin(sala) : null;
  const titulo = sala?.lead_nome ?? sala?.titulo ?? '';

  return (
    <Dialog open={!!sala} onOpenChange={(aberto) => !aberto && fechar()}>
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6 text-left">
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
            {titulo}
            {coach?.nota !== null && coach?.nota !== undefined && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-bold text-primary">{coach.nota}/10</span>
            )}
          </DialogTitle>
          <DialogDescription>
            {sala && [
              quando(sala.inicio),
              minutos !== null ? `${minutos} min` : null,
              sala.closer && `Closer ${sala.closer}`,
              sala.sdr && `SDR ${sala.sdr}`,
              sala.origem,
            ].filter(Boolean).join(' · ')}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={aba} onValueChange={(v) => mudaAba(v as AbaDetalhe)} className="flex min-h-0 flex-1 flex-col">
          <div className="overflow-x-auto border-b border-border px-6 py-2">
            <TabsList>
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="video">Vídeo{gravacoes.length > 0 ? ` (${gravacoes.length})` : ''}</TabsTrigger>
              <TabsTrigger value="transcricao">Transcrição{falas.length > 0 ? ` (${falas.length})` : ''}</TabsTrigger>
              <TabsTrigger value="relatorio">Relatório</TabsTrigger>
              <TabsTrigger value="engajamento">Engajamento</TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {carregando ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Carregando…</p>
            ) : sala && (
              <>
                <TabsContent value="resumo" className="mt-0"><AbaResumo sala={sala} coach={coach} falas={falas} gravacoes={gravacoes} engajamento={engajamento} /></TabsContent>
                <TabsContent value="video" className="mt-0"><AbaVideo gravacoes={gravacoes} /></TabsContent>
                <TabsContent value="transcricao" className="mt-0"><AbaTranscricao sala={sala} falas={falas} /></TabsContent>
                <TabsContent value="relatorio" className="mt-0"><AbaRelatorio sala={sala} coach={coach} setCoach={setCoach} temFala={falas.length > 0} /></TabsContent>
                <TabsContent value="engajamento" className="mt-0"><AbaEngajamento linhas={engajamento} /></TabsContent>
              </>
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ── Resumo ─────────────────────────────────────────────────────────────────

function AbaResumo({
  sala, coach, falas, gravacoes, engajamento,
}: {
  sala: Sala;
  coach: RegistroCoach | null;
  falas: Fala[];
  gravacoes: Gravacao[];
  engajamento: MinutoEngajamento[];
}) {
  const estado = coach?.estado;
  const ficha = CAMPOS_FICHA.filter((c) => estado?.ficha?.[c.chave]?.valor);
  const atencao = engajamento.length
    ? Math.round(engajamento.reduce((t, l) => t + l.atencao, 0) / engajamento.length)
    : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Mini rotulo="Nota do Coach" valor={coach?.nota !== null && coach?.nota !== undefined ? `${coach.nota}/10` : '—'} />
        <Mini rotulo="Termômetro" valor={estado?.termometro !== null && estado?.termometro !== undefined ? `${estado.termometro}/100` : '—'} />
        <Mini rotulo="Atenção do cliente" valor={atencao !== null ? `${atencao}%` : '—'} />
        <Mini rotulo="Guardado" valor={`${gravacoes.length} vídeo${gravacoes.length === 1 ? '' : 's'} · ${falas.length} falas`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Bloco titulo="Ficha da instituição">
          {ficha.length === 0 ? (
            <p className="text-sm text-muted-foreground">O Coach não anotou dados nesta reunião.</p>
          ) : (
            <dl className="space-y-2">
              {ficha.map((c) => (
                <div key={c.chave} className="flex justify-between gap-3 text-sm">
                  <dt className="text-muted-foreground">{c.rotulo}</dt>
                  <dd className="text-right font-medium text-foreground">
                    {estado!.ficha[c.chave].valor}
                    {estado!.ficha[c.chave].fonte !== 'cliente' && (
                      <span className="ml-1 text-[11px] font-normal text-muted-foreground">({estado!.ficha[c.chave].fonte})</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </Bloco>

        <div className="space-y-4">
          <Bloco titulo="Pendências (o que foi prometido)">
            <Lista itens={estado?.pendencias} vazio="Nenhuma pendência anotada." />
          </Bloco>
          <Bloco titulo="Frases fortes do cliente">
            <Lista itens={estado?.citacoes?.map((c) => `“${c}”`)} vazio="Nenhuma frase anotada." />
          </Bloco>
          {sala.notas_sdr && (
            <Bloco titulo="Notas do SDR">
              <p className="whitespace-pre-line text-sm text-foreground">{sala.notas_sdr}</p>
            </Bloco>
          )}
        </div>
      </div>
    </div>
  );
}

const Mini = ({ rotulo, valor }: { rotulo: string; valor: string }) => (
  <div className="rounded-xl border border-border bg-muted/30 p-3">
    <p className="text-[11px] text-muted-foreground">{rotulo}</p>
    <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">{valor}</p>
  </div>
);

const Bloco = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <section className="rounded-xl border border-border p-4">
    <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[1.4px] text-muted-foreground">{titulo}</h3>
    {children}
  </section>
);

const Lista = ({ itens, vazio }: { itens?: string[]; vazio: string }) =>
  itens && itens.length > 0 ? (
    <ul className="list-disc space-y-1 pl-4 text-sm text-foreground">
      {itens.map((t, i) => <li key={i}>{t}</li>)}
    </ul>
  ) : (
    <p className="text-sm text-muted-foreground">{vazio}</p>
  );

// ── Vídeo ──────────────────────────────────────────────────────────────────

function AbaVideo({ gravacoes }: { gravacoes: Gravacao[] }) {
  const [escolhida, setEscolhida] = useState<Gravacao | null>(gravacoes[gravacoes.length - 1] ?? null);
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    setUrl(null);
    setErro('');
    if (!escolhida) return;
    if (escolhida.status === 'gravando') {
      setErro('Ainda está gravando. O vídeo aparece aqui uns minutos depois que a reunião termina.');
      return;
    }
    linkDaGravacao(escolhida.arquivo)
      .then(setUrl)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não consegui abrir a gravação.'));
  }, [escolhida]);

  if (gravacoes.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Esta reunião não foi gravada.</p>;
  }

  const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="space-y-3">
      {gravacoes.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {gravacoes.map((g, i) => (
            <Button key={g.id} size="sm" variant={escolhida?.id === g.id ? 'default' : 'outline'} onClick={() => setEscolhida(g)}>
              Parte {i + 1} · {hora(g.inicio)}
            </Button>
          ))}
        </div>
      )}
      {url ? (
        <>
          <video src={url} controls className="aspect-video w-full rounded-xl bg-black" />
          <a href={url} download className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
            <Download className="h-3.5 w-3.5" /> Baixar o vídeo
          </a>
        </>
      ) : (
        <p className="py-12 text-center text-sm text-muted-foreground">{erro || 'Carregando o vídeo…'}</p>
      )}
    </div>
  );
}

// ── Transcrição ────────────────────────────────────────────────────────────

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function AbaTranscricao({ sala, falas }: { sala: Sala; falas: Fala[] }) {
  const [busca, setBusca] = useState('');
  const [copiado, setCopiado] = useState(false);
  const grupos = useMemo(() => agrupaFalas(falas), [falas]);
  const termo = semAcento(busca.trim());
  const visiveis = termo ? grupos.filter((g) => semAcento(g.textos.join(' ')).includes(termo)) : grupos;
  const titulo = sala.lead_nome ?? sala.titulo;

  const texto = () => transcricaoComoTexto(titulo, quando(sala.inicio), falas);
  const baixar = () => {
    const blob = new Blob([texto()], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `transcricao-${titulo.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}-${sala.inicio.slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const copiar = async () => {
    await navigator.clipboard.writeText(texto());
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  if (falas.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Esta reunião não tem transcrição.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar na conversa…" className="pl-9" aria-label="Procurar na transcrição" />
        </div>
        <Button variant="outline" size="sm" onClick={copiar}>
          {copiado ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
          {copiado ? 'Copiado' : 'Copiar'}
        </Button>
        <Button variant="outline" size="sm" onClick={baixar}>
          <Download className="mr-1.5 h-3.5 w-3.5" /> Baixar .txt
        </Button>
      </div>

      {termo && <p className="mb-3 text-xs text-muted-foreground">{visiveis.length} trecho{visiveis.length === 1 ? '' : 's'} com “{busca.trim()}”</p>}

      <ol className="space-y-4">
        {visiveis.map((g) => {
          const daRT = g.papel === 'anfitriao';
          return (
            <li key={g.id} className="flex gap-3">
              <span className="w-12 shrink-0 pt-0.5 text-right text-[11px] tabular-nums text-muted-foreground">
                {tempoDaFala(g.falado_em, falas[0].falado_em)}
              </span>
              <div className={`min-w-0 flex-1 border-l-2 pl-3 ${daRT ? 'border-primary' : 'border-success'}`}>
                <p className={`text-xs font-semibold ${daRT ? 'text-primary' : 'text-success'}`}>
                  {g.quem}{daRT ? ' · RT' : ''}
                </p>
                <p className="text-sm leading-relaxed text-foreground">
                  <Destaque texto={g.textos.join(' ')} termo={busca.trim()} />
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Marca em amarelo o que foi procurado. */
function Destaque({ texto, termo }: { texto: string; termo: string }) {
  if (!termo) return <>{texto}</>;
  const alvo = semAcento(termo);
  const base = semAcento(texto); // mesmo tamanho do original (só tira acentos combinados)
  if (base.length !== texto.length) return <>{texto}</>;
  const partes: React.ReactNode[] = [];
  let i = 0;
  for (let achou = base.indexOf(alvo); achou !== -1; achou = base.indexOf(alvo, i)) {
    partes.push(texto.slice(i, achou));
    partes.push(<mark key={achou} className="rounded bg-warning/30 px-0.5 text-foreground">{texto.slice(achou, achou + alvo.length)}</mark>);
    i = achou + alvo.length;
  }
  partes.push(texto.slice(i));
  return <>{partes}</>;
}

// ── Relatório ──────────────────────────────────────────────────────────────

function AbaRelatorio({
  sala, coach, setCoach, temFala,
}: {
  sala: Sala;
  coach: RegistroCoach | null;
  setCoach: (c: RegistroCoach) => void;
  temFala: boolean;
}) {
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');

  async function gerar() {
    setErro('');
    setGerando(true);
    try {
      const r = await geraRelatorio(sala.id);
      setCoach({ estado: coach?.estado ?? null, relatorio: r.relatorio, nota: r.nota, relatorio_em: new Date().toISOString() });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui gerar o relatório.');
    } finally {
      setGerando(false);
    }
  }

  if (coach?.relatorio) {
    return (
      <div className="prose prose-sm max-w-none text-foreground dark:prose-invert">
        <ReactMarkdown>{coach.relatorio}</ReactMarkdown>
      </div>
    );
  }
  return (
    <div className="py-10 text-center">
      <p className="mb-4 text-sm text-muted-foreground">
        {temFala ? 'Esta reunião ainda não tem relatório.' : 'Sem transcrição, o Coach não tem o que analisar.'}
      </p>
      {temFala && (
        <Button onClick={gerar} disabled={gerando}>
          {gerando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {gerando ? 'Escrevendo… (leva até 1 minuto)' : 'Gerar relatório'}
        </Button>
      )}
      {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}
    </div>
  );
}

// ── Engajamento ────────────────────────────────────────────────────────────

function AbaEngajamento({ linhas }: { linhas: MinutoEngajamento[] }) {
  const pessoas = useMemo(() => {
    const mapa = new Map<string, MinutoEngajamento[]>();
    for (const l of linhas) mapa.set(l.quem, [...(mapa.get(l.quem) ?? []), l]);
    return [...mapa.entries()];
  }, [linhas]);

  if (pessoas.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Sem dados de engajamento: o cliente estava sem câmera ou entrou antes do aviso do rosto existir.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Cada barra é um minuto da reunião. Altura = quanto tempo o cliente ficou olhando para a tela.
        Laranja = atenção abaixo de 50%. É um sinal, não uma certeza.
      </p>
      {pessoas.map(([quem, mins]) => {
        const media = Math.round(mins.reduce((t, l) => t + l.atencao, 0) / mins.length);
        const sorriso = Math.round(mins.reduce((t, l) => t + l.sorriso, 0) / mins.length);
        const piores = [...mins].sort((a, b) => a.atencao - b.atencao).slice(0, 3).filter((m) => m.atencao < 50);
        return (
          <section key={quem} className="rounded-xl border border-border p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold text-foreground">{quem}</h3>
              <p className="text-xs text-muted-foreground">Atenção média <strong className="text-foreground">{media}%</strong> · sorriu {sorriso}%</p>
            </div>
            <div className="flex h-28 items-end gap-[3px] overflow-x-auto" role="img" aria-label={`Atenção de ${quem} minuto a minuto`}>
              {mins.map((m) => (
                <div
                  key={m.minuto}
                  title={`Minuto ${m.minuto}: atenção ${m.atencao}%, sorriso ${m.sorriso}%`}
                  className={`min-w-[6px] flex-1 rounded-t ${m.atencao < 50 ? 'bg-warning' : 'bg-success'}`}
                  style={{ height: `${Math.max(4, m.atencao)}%` }}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>min {mins[0].minuto}</span><span>min {mins[mins.length - 1].minuto}</span>
            </div>
            {piores.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Atenção mais baixa nos minutos {piores.map((m) => m.minuto).sort((a, b) => a - b).join(', ')} — veja na transcrição o que estava sendo falado.
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
