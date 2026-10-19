import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, Mail, Search } from 'lucide-react';
// Versão pequena (20 KB): o lead entra mais rápido, principalmente no celular.
import logo from '@/assets/logo-pequena.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buscaReunioesPorEmail, quando, type SalaDoLead } from '@/lib/salas';
import { useTemaClaro } from '@/hooks/useTemaClaro';
import { useTituloAba } from '@/hooks/useTituloAba';

/**
 * /entrar — a porta da frente para quem perdeu o link.
 *
 * O lead digita o e-mail e o sistema encontra a reunião dele. Nenhum dado sai
 * do banco direto: quem responde é a edge function, e só com o mínimo
 * (título, horário e o primeiro nome de quem vai atender).
 */
const EntrarSala = () => {
  useTemaClaro();
  useTituloAba('Reunião — Reproduzindo Talentos');
  const [email, setEmail] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [salas, setSalas] = useState<SalaDoLead[]>([]);
  const [erro, setErro] = useState('');

  async function buscar(ev: React.FormEvent) {
    ev.preventDefault();
    setErro('');
    setBuscando(true);
    try {
      setSalas(await buscaReunioesPorEmail(email));
      setBuscou(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui buscar agora.');
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-6 sm:px-12">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo} alt="Reproduzindo Talentos" className="h-9 w-auto" />
        </Link>
      </header>

      <main className="flex flex-1 flex-wrap items-center justify-center gap-16 px-6 pb-16 sm:px-12">
        <section className="w-full max-w-md">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[2px] text-primary">
            Reunião comercial
          </p>
          <h1 className="mb-5 text-4xl font-light leading-tight text-foreground">
            A sua reunião,
            <br />
            <span className="font-semibold">na nossa sala.</span>
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Sem instalar nada e sem criar conta. Digite o e-mail do convite e a gente
            encontra o seu horário.
          </p>
        </section>

        <section className="w-full max-w-md">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm sm:p-10">
            <div className="mb-5 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-background">
                <Mail className="h-5 w-5 text-foreground" />
              </div>
            </div>
            <h2 className="mb-2 text-center text-2xl font-semibold text-foreground">
              Encontre sua reunião
            </h2>
            <p className="mb-7 text-center text-sm text-muted-foreground">
              Digite seu e-mail para localizar seu agendamento
            </p>

            <form onSubmit={buscar} className="space-y-4">
              <div>
                <Label htmlFor="email" className="mb-1.5 block text-xs font-semibold">
                  E-mail <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="h-12"
                  autoComplete="email"
                />
              </div>
              <Button type="submit" className="h-12 w-full text-sm font-semibold" disabled={buscando}>
                {buscando ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Buscar agendamento
              </Button>
            </form>

            {erro && (
              <p className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
                {erro}
              </p>
            )}
          </div>

          {buscou && salas.length === 0 && !erro && (
            <p className="mt-5 rounded-2xl border border-border bg-card px-6 py-5 text-center text-sm leading-relaxed text-muted-foreground">
              Não achei reunião marcada para esse e-mail. Confira se é o mesmo endereço
              que você usou ao agendar.
            </p>
          )}

          {salas.map((s) => (
            <div key={s.slug} className="mt-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-foreground">{s.titulo}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {quando(s.inicio)}
                    <br />
                    com {s.com} — Reproduzindo Talentos
                  </p>
                </div>
                {s.aberta && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    <span className="text-xs font-semibold text-success">Sala aberta</span>
                  </span>
                )}
              </div>
              <Button asChild className="mt-5 h-12 w-full text-sm font-semibold">
                <Link to={`/sala/${s.slug}`}>
                  {s.aberta ? 'Entrar na sala' : 'Ver a sala'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              {!s.aberta && (
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  A sala abre 30 minutos antes do horário.
                </p>
              )}
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Reproduzindo Talentos. Todos os direitos reservados.
      </footer>
    </div>
  );
};

export default EntrarSala;
