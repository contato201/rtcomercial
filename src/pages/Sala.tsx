import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock, Eye, Loader2, Video } from 'lucide-react';
// Versão pequena (20 KB): o lead entra mais rápido, principalmente no celular.
import logo from '@/assets/logo-pequena.png';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// O LiveKit é pesado (~500 kB): só entra no navegador quando a sala abre de
// verdade, para não deixar o resto do site mais lento.
const SalaAoVivo = lazy(() =>
  import('@/components/sala/SalaAoVivo').then((m) => ({ default: m.SalaAoVivo })),
);
import {
  consultaPedido, encerraSala, encerraSalaAoFechar, entraNaSala, quando, tokenDeLogin,
  type Cracha, type ResultadoEntrada,
} from '@/lib/salas';
import { useTemaClaro } from '@/hooks/useTemaClaro';
import { EsperaLead } from '@/components/sala/EsperaLead';
import { useTituloAba } from '@/hooks/useTituloAba';
import { geraRelatorio } from '@/lib/coach';

/**
 * A sala pública: /sala/<slug>. É o link que o closer manda para o lead.
 *
 * Quem é da equipe e está logado entra direto (como anfitrião ou observador).
 * Quem é de fora informa nome e e-mail: se o e-mail estiver na lista de
 * convidados, entra; se não estiver e a reunião tiver sala de espera, espera
 * o anfitrião aceitar.
 *
 * Antes de entrar, o lead vê um aviso curto: a reunião pode ser gravada,
 * transcrita e analisada por IA, "incluindo expressões do rosto". Clicar em
 * Entrar vale como concordar (escolha do Allan — texto longo assustava). Como
 * o rosto é dado biométrico (LGPD), o aviso cita o rosto com todas as letras e
 * o "sim" para ele vai separado (`consentiu_rosto`).
 */

type Etapa = 'porta' | 'entrando' | 'esperando' | 'ao_vivo' | 'saiu';

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

const Erro = ({ texto }: { texto: string }) => (
  <p className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
    {texto}
  </p>
);

const Sala = () => {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  useTemaClaro();
  useTituloAba('Reunião — Reproduzindo Talentos');
  const { isAuthenticated, canEdit, isLoading } = useAuth();
  const equipe = isAuthenticated && canEdit;
  // Link pessoal do lead que agendou pelo site (?k=): entra sem digitar nome e e-mail.
  const chave = params.get('k') ?? '';
  const peloLink = !!chave && !equipe;

  const [etapa, setEtapa] = useState<Etapa>('porta');
  const [cracha, setCracha] = useState<Cracha | null>(null);
  const [pedido, setPedido] = useState<{ id: string; chave: string } | null>(null);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState('');
  const [relatorio, setRelatorio] = useState<'nada' | 'gerando' | 'pronto' | 'sem'>('nada');
  // Guardado na entrada: ao fechar a aba não dá tempo de buscar o login.
  const loginGuardado = useRef<string | null>(null);

  const anfitriaoNaSala = etapa === 'ao_vivo' && cracha?.papel === 'anfitriao';

  // O anfitrião fechou a aba (ou o navegador) sem clicar em sair: avisa o
  // porteiro mesmo assim, para a reunião não ficar "ao vivo" para sempre.
  useEffect(() => {
    if (!anfitriaoNaSala) return;
    const aoFechar = () => {
      if (loginGuardado.current) encerraSalaAoFechar(slug, loginGuardado.current);
    };
    window.addEventListener('pagehide', aoFechar);
    return () => window.removeEventListener('pagehide', aoFechar);
  }, [anfitriaoNaSala, slug]);

  async function trata(r: ResultadoEntrada) {
    if (r.tipo === 'esperando') {
      setPedido(r.pedido);
      setEtapa('esperando');
      return;
    }
    if (r.cracha.papel === 'anfitriao') loginGuardado.current = await tokenDeLogin();
    setCracha(r.cracha);
    setEtapa('ao_vivo');
  }

  async function entrar(papel?: 'anfitriao' | 'observador') {
    setErro('');
    setEtapa('entrando');
    try {
      // O aviso aparece sempre antes do botão: quem clicou leu que a reunião
      // é gravada, transcrita e que as expressões do rosto são analisadas.
      await trata(await entraNaSala(peloLink && !papel
        ? { slug, chave, consentiu: true, consentiu_rosto: true }
        : { slug, nome: nome.trim(), email: email.trim(), papel, consentiu: true, consentiu_rosto: true }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui abrir a sala.');
      setEtapa('porta');
    }
  }

  // "Começar agora" manda a equipe para cá com ?entrar=1: entra direto como anfitrião.
  const jaEntrouSozinho = useRef(false);
  useEffect(() => {
    if (isLoading || !equipe || jaEntrouSozinho.current || params.get('entrar') !== '1') return;
    jaEntrouSozinho.current = true;
    void entrar('anfitriao');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, equipe]);

  // Na sala de espera: pergunta ao porteiro a cada 2,5 s se já foi aceito.
  useEffect(() => {
    if (etapa !== 'esperando' || !pedido) return;
    let vivo = true;
    const t = setInterval(async () => {
      try {
        const r = await consultaPedido(pedido);
        if (vivo && r.tipo === 'entrou') await trata(r);
      } catch (e) {
        if (!vivo) return;
        setErro(e instanceof Error ? e.message : 'Não consegui acompanhar o pedido.');
        setEtapa('porta');
      }
    }, 2500);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [etapa, pedido]);

  /**
   * Saiu da sala. Se foi o anfitrião, a reunião acaba aqui — é isso que dá a
   * duração e leva a reunião para o histórico. Se ele voltar, ela reabre.
   */
  function saiu() {
    if (cracha?.papel === 'anfitriao') {
      void encerraSala(slug).catch(() => undefined);
      // O relatório do Coach. Espera uns segundos para as últimas falas
      // chegarem ao banco (o painel guarda o que sobrou ao fechar).
      const salaId = cracha.sala.id;
      if (salaId) {
        setRelatorio('gerando');
        setTimeout(() => {
          geraRelatorio(salaId)
            .then(() => setRelatorio('pronto'))
            .catch(() => setRelatorio('sem')); // sem transcrição: não há o que relatar
        }, 6000);
      }
    }
    setEtapa('saiu');
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
        <SalaAoVivo cracha={cracha} aoSair={saiu} />
      </Suspense>
    );
  }

  // Link pessoal do lead: página de espera no estilo call.viverdeia.ai. O botão de
  // entrar aparece quando o anfitrião abre a sala, e a chamada abre aqui mesmo.
  if (peloLink && !isLoading && (etapa === 'porta' || etapa === 'entrando')) {
    return (
      <EsperaLead
        slug={slug}
        chave={chave}
        entrando={etapa === 'entrando'}
        erro={erro}
        aoEntrar={() => void entrar()}
      />
    );
  }

  if (etapa === 'esperando') {
    return (
      <Moldura>
        <div className="w-full max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card">
              <Clock className="h-6 w-6 animate-pulse text-primary" />
            </div>
          </div>
          <h1 className="mb-3 text-2xl font-semibold text-foreground">Aguardando o anfitrião</h1>
          <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
            Avisamos que você chegou. Assim que ele aceitar, você entra sozinho — não precisa
            recarregar a página.
          </p>
          <Button variant="outline" onClick={() => { setPedido(null); setEtapa('porta'); }}>
            Desistir
          </Button>
        </div>
      </Moldura>
    );
  }

  if (etapa === 'saiu') {
    const eraAnfitriao = cracha?.papel === 'anfitriao';
    return (
      <Moldura>
        <div className="w-full max-w-md text-center">
          <h1 className="mb-3 text-2xl font-semibold text-foreground">
            {eraAnfitriao ? 'Reunião encerrada' : 'Você saiu da reunião'}
          </h1>
          {eraAnfitriao && relatorio === 'gerando' && (
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              O Coach está escrevendo o relatório da reunião…
            </p>
          )}
          {eraAnfitriao && relatorio === 'pronto' && (
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-4 py-2 text-xs font-semibold text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Relatório pronto — está na reunião, em Reuniões.
            </p>
          )}
          <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
            {eraAnfitriao
              ? 'Ela já foi para o histórico, com a duração. Saiu sem querer? Entre de novo que ela reabre.'
              : cracha
                ? quando(cracha.sala.inicio)
                : 'Obrigado pela conversa.'}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => setEtapa('porta')} variant="outline">
              Entrar de novo
            </Button>
            {eraAnfitriao && (
              <Button asChild>
                <Link to="/reunioes">Voltar para Reuniões</Link>
              </Button>
            )}
          </div>
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
              : peloLink
                ? 'Sua sala já está pronta. É só entrar.'
                : 'Informe seu nome e o e-mail em que recebeu o convite.'}
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
          ) : peloLink ? (
            <div className="space-y-4">
              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                Esta reunião pode ser gravada, transcrita e analisada por inteligência artificial,
                incluindo expressões do rosto, para melhorarmos o nosso atendimento.
              </p>
              <Button className="h-12 w-full text-sm font-semibold" disabled={etapa === 'entrando'} onClick={() => entrar()}>
                {etapa === 'entrando' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                Entrar na sala
              </Button>
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
                  Seu nome <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nome"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Como quer aparecer na sala"
                  className="h-12"
                  autoComplete="name"
                />
              </div>
              <div>
                <Label htmlFor="email" className="mb-1.5 block text-xs font-semibold">
                  Seu e-mail <span className="text-destructive">*</span>
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

              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                Esta reunião pode ser gravada, transcrita e analisada por inteligência artificial,
                incluindo expressões do rosto, para melhorarmos o nosso atendimento.
              </p>

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

          {erro && <Erro texto={erro} />}
        </div>

        {!equipe && !peloLink && (
          <p className="mt-5 text-center text-xs text-muted-foreground">
            Não sabe qual e-mail usar?{' '}
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
