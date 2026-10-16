import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Link2, Loader2, Plus, Video, X } from 'lucide-react';
import { AppNavbar } from '@/components/AppNavbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { ORIGENS_LEAD } from '@/components/dashboard/ReunioesEditor';
import { fetchSdrNamesFromDb, loadSdrNames } from '@/lib/sdrNames';
import {
  cancelaSala, criaSala, linkDaSala, listaSalas, quando, type Sala,
} from '@/lib/salas';

/**
 * /reunioes — onde a equipe marca a sala e pega o link para mandar ao lead.
 *
 * Fase 1: marcar, copiar o link, entrar (como anfitrião ou invisível) e
 * cancelar. O que a reunião vira em dado (presença, duração, transcrição)
 * entra na Fase 2.
 */

const SELOS: Record<Sala['status'], { texto: string; classe: string }> = {
  agendada: { texto: 'Agendada', classe: 'border-border bg-muted text-muted-foreground' },
  ao_vivo: { texto: 'Ao vivo', classe: 'border-success/30 bg-success/10 text-success' },
  encerrada: { texto: 'Encerrada', classe: 'border-border bg-muted text-muted-foreground' },
  cancelada: { texto: 'Cancelada', classe: 'border-destructive/30 bg-destructive/10 text-destructive' },
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
  sdr: '',
  origem: ORIGENS_LEAD[0] as string,
  inicio: agoraLocal(),
  duracao_min: 60,
};

const Reunioes = () => {
  const [salas, setSalas] = useState<Sala[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [sdrs, setSdrs] = useState<string[]>(loadSdrNames());
  const [form, setForm] = useState({ ...VAZIO });
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState('');

  useEffect(() => {
    void fetchSdrNamesFromDb().then(setSdrs);
    void recarrega();
  }, []);

  async function recarrega() {
    setCarregando(true);
    try {
      setSalas(await listaSalas());
    } catch {
      toast({ title: 'Não consegui carregar as reuniões', variant: 'destructive' });
    } finally {
      setCarregando(false);
    }
  }

  async function salvar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!form.sdr) {
      toast({ title: 'Escolha o SDR que vai atender', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    try {
      const sala = await criaSala({
        ...form,
        inicio: new Date(form.inicio).toISOString(),
        duracao_min: Number(form.duracao_min) || 60,
      });
      setSalas((atuais) => [sala, ...atuais]);
      setForm({ ...VAZIO, sdr: form.sdr });
      await copiar(sala.slug);
      toast({
        title: 'Sala criada',
        description: 'O link já está copiado — é só colar para o lead.',
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

  async function copiar(slug: string) {
    try {
      await navigator.clipboard.writeText(linkDaSala(slug));
      setCopiado(slug);
      setTimeout(() => setCopiado(''), 2000);
    } catch {
      toast({ title: 'Copie o link na mão', description: linkDaSala(slug) });
    }
  }

  async function cancelar(sala: Sala) {
    if (!window.confirm(`Cancelar a reunião com ${sala.lead_nome}? O link para de funcionar.`)) return;
    try {
      await cancelaSala(sala.id);
      setSalas((atuais) =>
        atuais.map((s) => (s.id === sala.id ? { ...s, status: 'cancelada' } : s)),
      );
    } catch {
      toast({ title: 'Não consegui cancelar', variant: 'destructive' });
    }
  }

  const proximas = useMemo(
    () => salas.filter((s) => s.status === 'agendada' || s.status === 'ao_vivo'),
    [salas],
  );
  const passadas = useMemo(
    () => salas.filter((s) => s.status === 'encerrada' || s.status === 'cancelada'),
    [salas],
  );

  const Linha = ({ sala }: { sala: Sala }) => {
    const selo = SELOS[sala.status];
    const ativa = sala.status === 'agendada' || sala.status === 'ao_vivo';
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
            <p className="font-semibold text-foreground">{sala.lead_nome}</p>
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${selo.classe}`}>
              {selo.texto}
            </span>
            {sala.lead_entrou && (
              <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
                lead compareceu
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {sala.titulo} · {quando(sala.inicio)} · SDR {sala.sdr}
            {sala.origem ? ` · ${sala.origem}` : ''}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground/80">{sala.lead_email}</p>
        </div>

        {ativa && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => copiar(sala.slug)}>
              {copiado === sala.slug ? (
                <><Check className="mr-1.5 h-3.5 w-3.5" />Copiado</>
              ) : (
                <><Copy className="mr-1.5 h-3.5 w-3.5" />Link do lead</>
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
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Reuniões</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Marque a sala, mande o link e atenda aqui dentro — sem Meet, sem Zoom.
          </p>
        </div>

        <form
          onSubmit={salvar}
          className="mb-10 rounded-2xl border border-border bg-card p-6"
        >
          <h2 className="mb-5 flex items-center gap-2 font-semibold text-foreground">
            <Plus className="h-4 w-4 text-primary" />
            Nova reunião
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="lg:col-span-1">
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
              <Label htmlFor="titulo" className="mb-1.5 block text-xs font-semibold">Título</Label>
              <Input
                id="titulo" value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
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
              <Label className="mb-1.5 block text-xs font-semibold">SDR *</Label>
              <Select value={form.sdr} onValueChange={(v) => setForm({ ...form, sdr: v })}>
                <SelectTrigger><SelectValue placeholder="Quem vai atender" /></SelectTrigger>
                <SelectContent>
                  {sdrs.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">Origem do lead</Label>
              <Select value={form.origem} onValueChange={(v) => setForm({ ...form, origem: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORIGENS_LEAD.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={salvando}>
              {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
              Criar sala e copiar link
            </Button>
            <p className="text-xs text-muted-foreground">
              A sala abre 30 min antes e o lead confirma com o e-mail acima.
            </p>
          </div>
        </form>

        {carregando ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <>
            <section className="mb-10">
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
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-[1.6px] text-muted-foreground">
                  Já aconteceram · {passadas.length}
                </h2>
                <div className="space-y-3">
                  {passadas.slice(0, 20).map((s) => <Linha key={s.id} sala={s} />)}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Reunioes;
