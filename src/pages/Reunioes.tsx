import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  CalendarClock, CalendarPlus, Check, Circle, Copy, FileText, Link2, Loader2, Play, Plus,
  Settings2, Users, Video, X, Zap,
} from 'lucide-react';
import { AppNavbar } from '@/components/AppNavbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArquivoDeReunioes } from '@/components/reunioes/ArquivoDeReunioes';
import { DetalheDaReuniao, type AbaDetalhe } from '@/components/reunioes/DetalheDaReuniao';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { ORIGENS_LEAD } from '@/components/dashboard/ReunioesEditor';
import { fetchSdrNamesFromDb, loadSdrNames } from '@/lib/sdrNames';
import { buscaClosers, salvaClosers } from '@/lib/closerNames';
import {
  cancelaSala, criaReuniaoAgora, criaSala, duracaoMin, estaEsquecida, fechaSalaEsquecida,
  linkDaSala, linkGoogleAgenda, listaGravacoes, listaSalas, quando,
  ABORDAGENS, separaEmails, situacao, type Abordagem, type AcessoSala, type Gravacao, type Sala, type Situacao,
} from '@/lib/salas';

/**
 * /reunioes — onde a equipe marca a sala, manda o convite e vê o histórico.
 *
 * O SDR marca a reunião; quem atende é o closer. "Começar agora" abre uma
 * reunião na hora, sem lead. Cada reunião escolhe quem pode entrar: só a lista
 * de convidados, ou sala de espera (os outros pedem e o anfitrião aceita).
 */

const SELOS: Record<Situacao, { texto: string; classe: string }> = {
  agendada: { texto: 'Agendada', classe: 'border-border bg-muted text-muted-foreground' },
  ao_vivo: { texto: 'Ao vivo', classe: 'border-success/30 bg-success/10 text-success' },
  encerrada: { texto: 'Encerrada', classe: 'border-border bg-muted text-muted-foreground' },
  cancelada: { texto: 'Cancelada', classe: 'border-destructive/30 bg-destructive/10 text-destructive' },
  nao_aconteceu: { texto: 'Não aconteceu', classe: 'border-warning/30 bg-warning/10 text-warning' },
};

/** Datetime-local quer "YYYY-MM-DDTHH:mm" no fuso de quem está digitando. */
const agoraLocal = () => {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const VAZIO = {
  titulo: 'Reunião de diagnóstico',
  lead_nome: '',
  lead_email: '',
  outros: '',
  sdr: '',
  closer: '',
  origem: ORIGENS_LEAD[0] as string,
  inicio: agoraLocal(),
  acesso: 'espera' as AcessoSala,
  tipo_reuniao: 1 as 1 | 2,
  abordagem: '' as Abordagem | '',
  notas_sdr: '',
  gravar: false,
};

/** Aviso de espaço: no plano grátis do Supabase cabe pouco vídeo. */
const DICA_GRAVAR = 'Cada hora gravada ocupa uns 450 MB no armazém.';

const Reunioes = () => {
  const navigate = useNavigate();
  const [salas, setSalas] = useState<Sala[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [sdrs, setSdrs] = useState<string[]>(loadSdrNames());
  const [closers, setClosers] = useState<string[]>([]);
  const [editandoClosers, setEditandoClosers] = useState(false);
  const [form, setForm] = useState({ ...VAZIO });
  const [salvando, setSalvando] = useState(false);
  const [comecando, setComecando] = useState(false);
  const [copiado, setCopiado] = useState('');
  // Aba e reunião aberta ficam no endereço (?aba=arquivo&reuniao=…): dá para
  // recarregar a página ou mandar o link sem perder onde estava.
  const [params, setParams] = useSearchParams();
  const aba = params.get('aba') === 'arquivo' ? 'arquivo' : 'agenda';
  const abaDetalhe = (params.get('ver') as AbaDetalhe | null) ?? 'resumo';
  const detalhe = useMemo(
    () => salas.find((s) => s.id === params.get('reuniao')) ?? null,
    [salas, params],
  );
  const [versao, setVersao] = useState(0);
  const [gravarAgora, setGravarAgora] = useState(false);
  const [gravacoes, setGravacoes] = useState<Record<string, Gravacao[]>>({});

  useEffect(() => {
    void fetchSdrNamesFromDb().then(setSdrs);
    void buscaClosers().then(setClosers).catch(() => undefined);
    void recarrega();
  }, []);

  function mudaParams(muda: Record<string, string | null>) {
    const novo = new URLSearchParams(params);
    for (const [k, v] of Object.entries(muda)) {
      if (v === null) novo.delete(k);
      else novo.set(k, v);
    }
    setParams(novo, { replace: true });
  }
  const abreDetalhe = (sala: Sala, ver: string = 'resumo') => mudaParams({ reuniao: sala.id, ver });

  async function recarrega() {
    setCarregando(true);
    setVersao((v) => v + 1);
    try {
      const lista = await listaSalas();
      // Reunião que ficou "ao vivo" muito além do previsto: o anfitrião saiu
      // sem a página conseguir avisar. Fecha aqui, para ir ao histórico.
      const esquecidas = lista.filter((s) => estaEsquecida(s));
      await Promise.all(esquecidas.map((s) => fechaSalaEsquecida(s.id).catch(() => undefined)));
      const fechadas = new Set(esquecidas.map((s) => s.id));
      setSalas(lista.map((s) => (fechadas.has(s.id) ? { ...s, status: 'encerrada' } : s)));
      // As gravações vêm à parte: se a tabela ainda não existir, o resto funciona.
      listaGravacoes()
        .then((todas) => {
          const porSala: Record<string, Gravacao[]> = {};
          for (const g of todas) (porSala[g.sala_id] ??= []).push(g);
          setGravacoes(porSala);
        })
        .catch(() => undefined);
    } catch {
      toast({ title: 'Não consegui carregar as reuniões', variant: 'destructive' });
    } finally {
      setCarregando(false);
    }
  }

  async function copiar(slug: string) {
    try {
      await navigator.clipboard.writeText(linkDaSala(slug));
      setCopiado(slug);
      setTimeout(() => setCopiado(''), 2000);
      return true;
    } catch {
      toast({ title: 'Copie o link na mão', description: linkDaSala(slug) });
      return false;
    }
  }

  /** "Começar agora": cria, copia o link e já entra como anfitrião. */
  async function comecarAgora() {
    setComecando(true);
    try {
      const sala = await criaReuniaoAgora({ gravar: gravarAgora });
      await copiar(sala.slug);
      navigate(`/sala/${sala.slug}?entrar=1`);
    } catch (e) {
      toast({
        title: 'Não consegui abrir a reunião',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
      setComecando(false);
    }
  }

  async function salvar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!form.sdr) {
      toast({ title: 'Escolha o SDR que agendou', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    try {
      const sala = await criaSala({
        titulo: form.titulo.trim() || 'Reunião',
        lead_nome: form.lead_nome.trim(),
        lead_email: form.lead_email.trim(),
        convidados: separaEmails(form.outros),
        sdr: form.sdr,
        closer: form.closer || null,
        origem: form.origem,
        acesso: form.acesso,
        inicio: new Date(form.inicio).toISOString(),
        duracao_min: 60,
        tipo_reuniao: form.tipo_reuniao,
        abordagem: form.abordagem || null,
        notas_sdr: form.notas_sdr.trim() || null,
        gravar: form.gravar,
      });
      setSalas((atuais) => [sala, ...atuais]);
      setForm({
        ...VAZIO, sdr: form.sdr, closer: form.closer, acesso: form.acesso,
        tipo_reuniao: form.tipo_reuniao, gravar: form.gravar,
      });
      await copiar(sala.slug);
      toast({
        title: 'Sala criada e link copiado',
        description: 'Para mandar o convite com confirmação, clique em "Google Agenda" na reunião.',
      });
    } catch (e) {
      toast({
        title: 'Não consegui criar a sala',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSalvando(false);
    }
  }

  async function cancelar(sala: Sala) {
    const quem = sala.lead_nome ?? 'esta reunião';
    if (!window.confirm(`Cancelar a reunião com ${quem}? O link para de funcionar.`)) return;
    try {
      await cancelaSala(sala.id);
      setSalas((atuais) =>
        atuais.map((s) => (s.id === sala.id ? { ...s, status: 'cancelada' } : s)),
      );
    } catch {
      toast({ title: 'Não consegui cancelar', variant: 'destructive' });
    }
  }

  // Próximas em ordem de horário (a mais perto primeiro); histórico do mais recente.
  const proximas = useMemo(
    () => salas
      .filter((s) => ['agendada', 'ao_vivo'].includes(situacao(s)))
      .sort((a, b) => a.inicio.localeCompare(b.inicio)),
    [salas],
  );
  const passadas = useMemo(
    () => salas.filter((s) => ['encerrada', 'cancelada', 'nao_aconteceu'].includes(situacao(s))),
    [salas],
  );

  const Linha = ({ sala }: { sala: Sala }) => {
    const sit = situacao(sala);
    const selo = SELOS[sit];
    const ativa = sit === 'agendada' || sit === 'ao_vivo';
    const minutos = duracaoMin(sala);
    const equipe = [sala.closer && `Closer ${sala.closer}`, sala.sdr && `SDR ${sala.sdr}`].filter(Boolean);
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
            <p className="font-semibold text-foreground">{sala.lead_nome ?? sala.titulo}</p>
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${selo.classe}`}>
              {selo.texto}
            </span>
            {sala.lead_entrou && (
              <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
                lead compareceu
              </span>
            )}
            {sit === 'encerrada' && !sala.lead_entrou && !sala.instantanea && (
              <span className="rounded-full border border-warning/30 bg-warning/10 px-2.5 py-0.5 text-[11px] text-warning">
                lead não entrou
              </span>
            )}
            {sit === 'encerrada' && (
              <span className="text-[11px] text-muted-foreground">
                {minutos !== null ? `durou ${minutos} min` : 'duração não registrada'}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {[sala.lead_nome ? sala.titulo : null, quando(sala.inicio), ...equipe, sala.origem]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground/80">
            {sala.lead_email && <span className="truncate">{sala.lead_email}</span>}
            {sala.convidados.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" />+{sala.convidados.length} convidado{sala.convidados.length > 1 ? 's' : ''}
              </span>
            )}
            <span>{sala.acesso === 'espera' ? 'sala de espera' : 'só convidados'}</span>
            {ativa && sala.gravar && (
              <span className="inline-flex items-center gap-1 text-destructive">
                <Circle className="h-2.5 w-2.5 fill-current" />grava sozinha
              </span>
            )}
          </p>
        </div>

        {(gravacoes[sala.id]?.length ?? 0) > 0 && (
          <Button variant="outline" size="sm" onClick={() => abreDetalhe(sala, 'video')}>
            <Play className="mr-1.5 h-3.5 w-3.5" />
            Assistir
          </Button>
        )}

        {sit === 'encerrada' && (
          <Button variant="outline" size="sm" onClick={() => abreDetalhe(sala, 'relatorio')}>
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            Relatório
          </Button>
        )}

        {ativa && (
          <div className="flex flex-wrap items-center gap-2">
            {sit === 'agendada' && sala.lead_email && (
              <Button asChild variant="outline" size="sm" title="Abre o seu Google Agenda com o convite pronto">
                <a href={linkGoogleAgenda(sala)} target="_blank" rel="noreferrer">
                  <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
                  Google Agenda
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => copiar(sala.slug)}>
              {copiado === sala.slug ? (
                <><Check className="mr-1.5 h-3.5 w-3.5" />Copiado</>
              ) : (
                <><Copy className="mr-1.5 h-3.5 w-3.5" />Copiar link</>
              )}
            </Button>
            <Button asChild size="sm">
              <Link to={`/sala/${sala.slug}`}>
                <Video className="mr-1.5 h-3.5 w-3.5" />
                Entrar
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => cancelar(sala)}
              aria-label="Cancelar reunião"
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />

      <main className="mx-auto max-w-[1100px] px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Reuniões</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Marque a sala, mande o convite e atenda aqui dentro — sem Meet, sem Zoom.
          </p>
        </div>

        <Tabs value={aba} onValueChange={(v) => mudaParams({ aba: v === 'arquivo' ? 'arquivo' : null })}>
          <TabsList className="mb-6">
            <TabsTrigger value="agenda">Agenda</TabsTrigger>
            <TabsTrigger value="arquivo">Arquivo · gravações e transcrições</TabsTrigger>
          </TabsList>

          <TabsContent value="arquivo" className="mt-0">
            {carregando && salas.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>
            ) : (
              <ArquivoDeReunioes salas={salas} versao={versao} abrir={abreDetalhe} />
            )}
          </TabsContent>

          <TabsContent value="agenda" className="mt-0">
        {/* Os dois jeitos de começar, lado a lado, como no Meet. */}
        <div className="mb-8 grid gap-4 md:grid-cols-2">
          <div className="flex flex-col rounded-2xl border border-primary/40 bg-primary/5 p-6">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Zap className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Reunião agora</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Abre a sala na hora, sem marcar nada. O link já vai copiado para você mandar no WhatsApp —
              quem chegar pede para entrar e você aceita.
            </p>
            <div className="mt-4 flex items-center gap-2.5">
              <Switch id="gravar-agora" checked={gravarAgora} onCheckedChange={setGravarAgora} />
              <Label htmlFor="gravar-agora" className="cursor-pointer text-sm font-medium">
                Gravar esta reunião
              </Label>
            </div>
            {gravarAgora && <p className="mt-1 text-[11px] text-muted-foreground">{DICA_GRAVAR}</p>}
            <Button onClick={comecarAgora} disabled={comecando} className="mt-5 h-11 w-full sm:w-auto sm:self-start sm:px-6">
              {comecando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Video className="mr-2 h-4 w-4" />}
              Começar agora
            </Button>
          </div>

          <div className="flex flex-col rounded-2xl border border-border bg-card p-6">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-foreground">
              <CalendarClock className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Agendar para depois</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Para reunião com lead: escolha o dia, o SDR e o closer. Você recebe o link e o convite do
              Google Agenda pronto.
            </p>
            <Button
              variant="outline"
              className="mt-auto h-11 w-full sm:w-auto sm:self-start sm:px-6"
              onClick={() => document.getElementById('agendar')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <Plus className="mr-2 h-4 w-4" />
              Agendar reunião
            </Button>
          </div>
        </div>

        <form id="agendar" onSubmit={salvar} className="mb-6 scroll-mt-6 rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-5 flex items-center gap-2 font-semibold text-foreground">
            <Plus className="h-4 w-4 text-primary" />
            Agendar reunião
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="lead_nome" className="mb-1.5 block text-xs font-semibold">Nome do lead *</Label>
              <Input
                id="lead_nome" required value={form.lead_nome}
                onChange={(e) => setForm({ ...form, lead_nome: e.target.value })}
                placeholder="Mariana Alves"
              />
            </div>
            <div>
              <Label htmlFor="lead_email" className="mb-1.5 block text-xs font-semibold">E-mail do lead *</Label>
              <Input
                id="lead_email" type="email" required value={form.lead_email}
                onChange={(e) => setForm({ ...form, lead_email: e.target.value })}
                placeholder="mariana@empresa.com.br"
              />
            </div>
            <div>
              <Label htmlFor="outros" className="mb-1.5 block text-xs font-semibold">Outros convidados</Label>
              <Input
                id="outros" value={form.outros}
                onChange={(e) => setForm({ ...form, outros: e.target.value })}
                placeholder="socio@empresa.com.br, outro@email.com"
              />
            </div>

            <div>
              <Label htmlFor="inicio" className="mb-1.5 block text-xs font-semibold">Quando *</Label>
              <Input
                id="inicio" type="datetime-local" required value={form.inicio}
                onChange={(e) => setForm({ ...form, inicio: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">SDR que agendou *</Label>
              <Select value={form.sdr} onValueChange={(v) => setForm({ ...form, sdr: v })}>
                <SelectTrigger><SelectValue placeholder="Quem marcou" /></SelectTrigger>
                <SelectContent>
                  {sdrs.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <Label className="text-xs font-semibold">Closer que vai atender</Label>
                <button
                  type="button"
                  onClick={() => setEditandoClosers((v) => !v)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                >
                  <Settings2 className="h-3 w-3" />
                  {closers.length === 0 ? 'Cadastrar closers' : 'Editar lista'}
                </button>
              </div>
              <Select
                value={form.closer}
                onValueChange={(v) => setForm({ ...form, closer: v })}
                disabled={closers.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={closers.length === 0 ? 'Nenhum closer cadastrado' : 'Quem atende'} />
                </SelectTrigger>
                <SelectContent>
                  {closers.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="titulo" className="mb-1.5 block text-xs font-semibold">Título</Label>
              <Input
                id="titulo" value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">Origem do lead</Label>
              <Select value={form.origem} onValueChange={(v) => setForm({ ...form, origem: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORIGENS_LEAD.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">Só a equipe vê. Não vai no convite.</p>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Label className="mb-1.5 block text-xs font-semibold">Como o lead chegou</Label>
              <Select value={form.abordagem} onValueChange={(v) => setForm({ ...form, abordagem: v as Abordagem })}>
                <SelectTrigger><SelectValue placeholder="Inbound, outbound, indicação…" /></SelectTrigger>
                <SelectContent>
                  {ABORDAGENS.map((a) => <SelectItem key={a.valor} value={a.valor}>{a.texto}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {ABORDAGENS.find((a) => a.valor === form.abordagem)?.dica
                  ?? 'Muda a conversa: o Coach ajusta as dicas. Dá para escolher também dentro da sala.'}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">Tipo de reunião</Label>
              <Select
                value={String(form.tipo_reuniao)}
                onValueChange={(v) => setForm({ ...form, tipo_reuniao: v === '2' ? 2 : 1 })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 · Consultoria / Diagnóstico</SelectItem>
                  <SelectItem value="2">2 · Plano de Ação / Proposta</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">O Coach segue o roteiro de cada uma.</p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="notas_sdr" className="mb-1.5 block text-xs font-semibold">Notas do SDR</Label>
              <Textarea
                id="notas_sdr"
                value={form.notas_sdr}
                onChange={(e) => setForm({ ...form, notas_sdr: e.target.value })}
                placeholder="O que você já descobriu: alunos, mensalidade, quem decide, por que agendou…"
                className="min-h-[72px]"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">O Coach lê antes da reunião, pra o closer não perguntar de novo.</p>
            </div>
          </div>

          <fieldset className="mt-5">
            <legend className="mb-2 text-xs font-semibold text-foreground">Quem pode entrar</legend>
            <RadioGroup
              value={form.acesso}
              onValueChange={(v) => setForm({ ...form, acesso: v as AcessoSala })}
              className="grid gap-3 sm:grid-cols-2"
            >
              <Label
                htmlFor="acesso-espera"
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 font-normal has-[[data-state=checked]]:border-primary"
              >
                <RadioGroupItem id="acesso-espera" value="espera" className="mt-0.5" />
                <span>
                  <span className="block text-sm font-semibold text-foreground">Com sala de espera</span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">
                    Os convidados entram direto. Quem não foi convidado pede para entrar e você aceita ou recusa.
                  </span>
                </span>
              </Label>
              <Label
                htmlFor="acesso-convidados"
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 font-normal has-[[data-state=checked]]:border-primary"
              >
                <RadioGroupItem id="acesso-convidados" value="convidados" className="mt-0.5" />
                <span>
                  <span className="block text-sm font-semibold text-foreground">Só convidados</span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">
                    Ninguém além do lead e dos outros convidados consegue entrar.
                  </span>
                </span>
              </Label>
            </RadioGroup>
          </fieldset>

          <div className="mt-5 flex items-start gap-3 rounded-xl border border-border p-4">
            <Switch
              id="gravar-auto"
              checked={form.gravar}
              onCheckedChange={(v) => setForm({ ...form, gravar: v })}
              className="mt-0.5"
            />
            <Label htmlFor="gravar-auto" className="cursor-pointer font-normal">
              <span className="block text-sm font-semibold text-foreground">Gravar automaticamente</span>
              <span className="block text-xs leading-relaxed text-muted-foreground">
                A gravação começa sozinha quando você entra. Desligado, você grava na hora pelo botão
                "Gravar" da sala, se quiser. {DICA_GRAVAR}
              </span>
            </Label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={salvando}>
              {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
              Criar sala e copiar link
            </Button>
            <p className="text-xs text-muted-foreground">
              A sala abre 30 min antes do horário.
            </p>
          </div>
        </form>

        {editandoClosers && (
          <EditorDeClosers
            closers={closers}
            aoSalvar={(lista) => {
              setClosers(lista);
              if (form.closer && !lista.includes(form.closer)) setForm({ ...form, closer: '' });
            }}
            fechar={() => setEditandoClosers(false)}
          />
        )}

        {carregando ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <>
            <section className="mb-10 mt-10">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-[1.6px] text-muted-foreground">
                Próximas e ao vivo · {proximas.length}
              </h2>
              {proximas.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
                  Nenhuma reunião marcada ainda.
                </p>
              ) : (
                <div className="space-y-3">
                  {proximas.map((s) => <Linha key={s.id} sala={s} />)}
                </div>
              )}
            </section>

            {passadas.length > 0 && (
              <section>
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-[1.6px] text-muted-foreground">
                    Últimas que aconteceram
                  </h2>
                  <button
                    type="button"
                    onClick={() => mudaParams({ aba: 'arquivo' })}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Ver todas no Arquivo ({passadas.length}) →
                  </button>
                </div>
                <div className="space-y-3">
                  {passadas.slice(0, 5).map((s) => <Linha key={s.id} sala={s} />)}
                </div>
              </section>
            )}
          </>
        )}
          </TabsContent>
        </Tabs>
      </main>

      <DetalheDaReuniao
        sala={detalhe}
        aba={abaDetalhe}
        mudaAba={(ver) => mudaParams({ ver })}
        fechar={() => mudaParams({ reuniao: null, ver: null })}
      />
    </div>
  );
};

/** Lista de closers: adicionar e tirar nomes. Fica guardada para toda a equipe. */
function EditorDeClosers({
  closers, aoSalvar, fechar,
}: {
  closers: string[];
  aoSalvar: (lista: string[]) => void;
  fechar: () => void;
}) {
  const [lista, setLista] = useState(closers);
  const [novo, setNovo] = useState('');
  const [salvando, setSalvando] = useState(false);

  function adicionar() {
    const n = novo.trim();
    if (!n || lista.includes(n)) return;
    setLista([...lista, n]);
    setNovo('');
  }

  async function salvar() {
    setSalvando(true);
    try {
      const salva = await salvaClosers(lista);
      aoSalvar(salva);
      toast({ title: 'Lista de closers salva' });
      fechar();
    } catch {
      toast({ title: 'Não consegui salvar a lista', variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Closers</h2>
        <button type="button" onClick={fechar} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Quem atende as reuniões. Aparece na sala e no convite ("Reunião com Fulano").
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {lista.length === 0 && <p className="text-sm text-muted-foreground">Nenhum closer ainda.</p>}
        {lista.map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-sm text-foreground">
            {c}
            <button
              type="button"
              onClick={() => setLista(lista.filter((x) => x !== c))}
              aria-label={`Tirar ${c}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Label htmlFor="novo-closer" className="sr-only">Nome do closer</Label>
        <Input
          id="novo-closer"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              adicionar();
            }
          }}
          placeholder="Nome do closer"
          className="max-w-xs"
        />
        <Button type="button" variant="outline" onClick={adicionar}>Adicionar</Button>
        <Button type="button" onClick={salvar} disabled={salvando}>
          {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar lista
        </Button>
      </div>
    </div>
  );
}

export default Reunioes;
