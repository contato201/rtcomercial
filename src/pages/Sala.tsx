import { lazy, Suspense, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowRight, Eye, Loader2, Video } from 'lucide-react';
import logo from '@/assets/logo.png';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// O LiveKit é pesado (~450 kB): só entra no navegador quando a sala abre de
// verdade, para não deixar o resto do site mais lento.
const SalaAoVivo = lazy(() =>
  import('@/components/sala/SalaAoVivo').then((m) => ({ default: m.SalaAoVivo })),
);
import { pedeCracha, quando, type Cracha } from '@/lib/salas';
import { useTemaClaro } from '@/hooks/useTemaClaro';

/**
 * A sala pública: /sala/<slug>. É o link que o SDR manda para o lead.
 *
 * Quem é da equipe e está logado entra direto (como anfitrião ou observador).
 * Quem não é precisa confirmar o e-mail — é assim que a sala sabe que é mesmo
 * o lead convidado, sem obrigar ninguém a criar conta.
 */

type Etapa = 'porta' | 'entrando' | 'ao_vivo' | 'saiu';

const Moldura = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-screen flex-col bg-background">
    <header className="flex items-center justify-between px-6 py-6 sm:px-12">
      <Link to="/" className="flex items-center gap-3">
        <img src={logo} alt="Reproduzindo Talentos" className="h-9 w-auto" />
      </Link>
    </header>
    <main className="flex flex-1 items-center justify-center px-6 pb-16">{children}</main>
    <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">
      © {new Date().getFullYear()} Reproduzindo Talentos.
    </footer>
  </div>
);

const Sala = () => {
  const { slug = '' } = useParams();
  useTemaClaro();
  const { isAuthenticated, canEdit } = useAuth();
  const equipe = isAuthenticated && canEdit;

  const [etapa, setEtapa] = useState<Etapa>('porta');
  const [cracha, setCracha] = useState<Cracha | null>(null);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState('');

  async function entrar(papel?: 'anfitriao' | 'observador') {
    setErro('');
    setEtapa('entrando');
    try {
      const c = await pedeCracha({ slug, nome: nome.trim(), email: email.trim(), papel });
      setCracha(c);
      setEtapa('ao_vivo');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui abrir a sala.');
      setEtapa('porta');
    }
  }

  if (etapa === 'ao_vivo' && cracha) {
    return (
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center bg-[#0A0A0A] text-sm text-[#8F8A80]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Abrindo a sala…
          </div>
        }
      >
        <SalaAoVivo cracha={cracha} aoSair={() => setEtapa('saiu')} />
      </Suspense>
    );
  }

  if (etapa === 'saiu') {
    return (
      <Moldura>
        <div className="w-full max-w-md text-center">
          <h1 className="mb-3 text-2xl font-semibold text-foreground">Você saiu da reunião</h1>
          <p className="mb-8 text-sm text-muted-foreground">
            {cracha ? quando(cracha.sala.inicio) : 'Obrigado pela conversa.'}
          </p>
          <Button onClick={() => setEtapa('porta')} variant="outline">
            Entrar de novo
          </Button>
        </div>
      </Moldura>
    );
  }

  return (
    <Moldura>
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm sm:p-10">
          <div className="mb-5 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-background">
              <Video className="h-6 w-6 text-foreground" />
            </div>
          </div>

          <h1 className="mb-2 text-center text-2xl font-semibold text-foreground">
            {equipe ? 'Abrir a sala' : 'Entrar na reunião'}
          </h1>
          <p className="mb-7 text-center text-sm leading-relaxed text-muted-foreground">
            {equipe
              ? 'Você está logado como equipe. Escolha como quer entrar.'
              : 'Confirme seu nome e o e-mail do convite para a sala te reconhecer.'}
          </p>

          {equipe ? (
            <div className="space-y-3">
              <Button
                className="h-12 w-full text-sm font-semibold"
                disabled={etapa === 'entrando'}
                onClick={() => entrar('anfitriao')}
              >
                {etapa === 'entrando' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Video className="mr-2 h-4 w-4" />
                )}
                Entrar como anfitrião
              </Button>
              <Button
                variant="outline"
                className="h-12 w-full text-sm font-semibold"
                disabled={etapa === 'entrando'}
                onClick={() => entrar('observador')}
              >
                <Eye className="mr-2 h-4 w-4" />
                Entrar invisível (observador)
              </Button>
              <p className="pt-1 text-center text-xs leading-relaxed text-muted-foreground">
                Como observador você assiste sem aparecer: o lead não vê nem ouve você.
              </p>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(ev) => {
                ev.preventDefault();
                void entrar();
              }}
            >
              <div>
                <Label htmlFor="nome" className="mb-1.5 block text-xs font-semibold">
                  Seu nome
                </Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Como quer aparecer na sala"
                  className="h-12"
                  autoComplete="name"
                />
              </div>
              <div>
                <Label htmlFor="email" className="mb-1.5 block text-xs font-semibold">
                  E-mail do convite <span className="text-destructive">*</span>
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
              <Button type="submit" className="h-12 w-full text-sm font-semibold" disabled={etapa === 'entrando'}>
                {etapa === 'entrando' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                Entrar na sala
              </Button>
            </form>
          )}

          {erro && (
            <p className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
              {erro}
            </p>
          )}
        </div>

        {!equipe && (
          <p className="mt-5 text-center text-xs text-muted-foreground">
            Não tem o e-mail em mãos?{' '}
            <Link to="/entrar" className="font-semibold text-foreground underline underline-offset-2">
              procure sua reunião
            </Link>
          </p>
        )}
      </div>
    </Moldura>
  );
};

export default Sala;
