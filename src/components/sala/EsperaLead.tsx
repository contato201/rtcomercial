import { useEffect, useState } from 'react';
import { ArrowRight, Loader2, Video } from 'lucide-react';
import logoRt from '@/assets/logo-rt-escura.webp';
import fotoAllan from '@/assets/especialista-allan.webp';
import { buscaConvite, type ConviteLead } from '@/lib/salas';

/**
 * Página de espera do lead que agendou pelo site (link pessoal /sala/<slug>?k=).
 *
 * Mesma estrutura do call.viverdeia.ai: "Reunião confirmada", o especialista,
 * data e hora, contagem regressiva. Na hora marcada fica esperando o anfitrião;
 * quando ele entra na sala, aparece "Entrar na reunião" e a chamada abre aqui
 * mesmo, nesta página.
 */

// A lista de closers do RT Comercial guarda só o primeiro nome ("Allan", "Rafael");
// para o lead, mostra o nome completo e a foto.
const ESPECIALISTAS: Record<string, { nome: string; foto?: string }> = {
  allan: { nome: 'Allan Cattão', foto: fotoAllan },
  'allan cattão': { nome: 'Allan Cattão', foto: fotoAllan },
  rafael: { nome: 'Rafael Andrade' },
  'rafael andrade': { nome: 'Rafael Andrade' },
};
const SDRS = [
  { nome: 'Felipe', fone: '556131991550' },
  { nome: 'Nicoly', fone: '5561996697033' },
];
const DEPOIS_MS = 4 * 60 * 60 * 1000; // igual à janela do porteiro

type Fase = 'contagem' | 'aguardando' | 'aberta' | 'encerrada' | 'passou' | 'cancelada';

const fase = (c: ConviteLead, agora: number): Fase => {
  const inicio = new Date(c.inicio).getTime();
  if (c.status === 'cancelada') return 'cancelada';
  if (c.status === 'ao_vivo') return 'aberta';
  if (c.status === 'encerrada') return 'encerrada';
  if (agora < inicio) return 'contagem';
  return agora <= inicio + DEPOIS_MS ? 'aguardando' : 'passou';
};

const BRT = 'America/Sao_Paulo';
const dataLonga = (iso: string) => {
  const t = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: BRT })
    .format(new Date(iso))
    .replace('-feira', '');
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const hora = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: BRT }).format(new Date(iso));
const iniciais = (nome: string) =>
  nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || 'RT';
const dois = (n: number) => String(n).padStart(2, '0');

const CSS = `
.rtl{--ink:#171C42;--body:#344054;--muted:#667085;--azul:#1B27C4;--azul-2:#2A36D6;--azul-deep:#131C96;
  --coral:#8c2c2c;--ease:cubic-bezier(.32,.08,.24,1);--ease-out:cubic-bezier(.16,1,.3,1);
  min-height:100svh;display:flex;flex-direction:column;font-family:Inter,system-ui,-apple-system,sans-serif;
  color:var(--body);background:linear-gradient(#F6F7F9,#E9EDF1);-webkit-font-smoothing:antialiased}
.rtl main{flex:1;display:flex;align-items:center;justify-content:center;padding:32px 16px}
.rtl-glass{position:relative;width:100%;max-width:35rem;padding:40px 24px;border-radius:24px;
  background:linear-gradient(rgba(255,255,255,.78),rgba(255,255,255,.52));backdrop-filter:blur(28px) saturate(170%);
  border:1px solid rgba(255,255,255,.85);box-shadow:inset 0 1px rgba(255,255,255,.95),inset 0 -1px rgba(255,255,255,.3),
  0 0 0 1px rgba(23,28,66,.04),0 24px 64px -28px rgba(23,28,66,.35),0 6px 20px rgba(23,28,66,.1);
  animation:rtl-in .5s var(--ease-out) both}
@media(min-width:640px){.rtl-glass{padding:48px 44px;border-radius:28px}}
@keyframes rtl-in{from{opacity:0;transform:translateY(14px)}}
.rtl-logo{display:block;height:26px;width:auto;margin:0 auto 22px}
.rtl-ribbon{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--ink)}
.rtl-ribbon i{width:6px;height:6px;border-radius:50%;background:currentColor;flex:none}
.rtl-ribbon.live{color:#1EA84C}.rtl-ribbon.live i{animation:rtl-pulse 2s var(--ease) infinite}
.rtl-ribbon.quiet{color:var(--muted)}.rtl-ribbon.danger{color:var(--coral)}
@keyframes rtl-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.78)}}
.rtl h1{margin-top:14px;font-size:2.1rem;line-height:1.12;font-weight:600;letter-spacing:-.025em;color:var(--ink);text-wrap:balance}
@media(min-width:640px){.rtl h1{font-size:2.6rem}}
.rtl-sub{margin-top:10px;font-size:16px;line-height:1.4;color:var(--body)}
@media(min-width:640px){.rtl-sub{font-size:18px}}
.rtl-card{margin-top:32px;text-align:left;border-radius:18px;padding:22px 24px;
  background:linear-gradient(rgba(255,255,255,.7),rgba(255,255,255,.42));backdrop-filter:blur(20px) saturate(150%);
  border:1px solid rgba(255,255,255,.9);box-shadow:inset 0 1px rgba(255,255,255,.95),0 0 0 1px rgba(23,28,66,.06),0 12px 30px -14px rgba(23,28,66,.22)}
.rtl-esp{display:flex;align-items:center;gap:14px}
.rtl-av{display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:50%;flex:none;overflow:hidden;
  background:linear-gradient(160deg,var(--azul-2),var(--azul-deep));border:1px solid rgba(23,28,66,.2);font-size:17px;font-weight:600;color:#fff}
.rtl-av img{width:100%;height:100%;object-fit:cover}
.rtl-host{font-size:17px;font-weight:600;line-height:1.25;color:var(--ink)}
.rtl-role{margin-top:3px;font-size:13.5px;line-height:1.3;color:#475467}
.rtl-div{height:1px;background:rgba(23,28,66,.08);margin:16px 0}
.rtl-stats{display:flex;flex-wrap:wrap;column-gap:40px;row-gap:12px}
.rtl-lab{display:block;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#5E6B82}
.rtl-val{display:block;margin-top:4px;font-size:17px;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums}
.rtl-val small{font-size:13.5px;font-weight:500;color:var(--muted)}
.rtl-ct{margin-top:8px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.rtl-ct div{display:flex;flex-direction:column;align-items:center;padding:13px 0 11px;border-radius:12px;
  background:rgba(23,28,66,.05);border:1px solid rgba(23,28,66,.12)}
.rtl-ct b{font-size:28px;font-weight:600;line-height:1;color:var(--ink);font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.rtl-ct span{margin-top:5px;font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#5E6B82}
.rtl-wait{margin-top:28px;text-align:center;font-size:15px;font-weight:500;line-height:1.5;color:var(--body)}
.rtl-run{position:relative;height:5px;margin:0 auto 12px;max-width:250px;border-radius:999px;background:rgba(23,28,66,.12);overflow:hidden}
.rtl-run:after{content:"";position:absolute;inset:0 auto 0 -38%;width:38%;border-radius:999px;
  background:linear-gradient(90deg,transparent,var(--azul-2) 35%,var(--azul-deep) 65%,transparent);animation:rtl-sweep 1.9s var(--ease) infinite}
@keyframes rtl-sweep{to{left:100%}}
.rtl-cta{margin-top:28px;display:inline-flex;align-items:center;justify-content:center;gap:10px;width:100%;height:62px;padding:0 28px;
  border-radius:14px;font-size:17px;font-weight:600;letter-spacing:.01em;color:#fff;cursor:pointer;
  background:linear-gradient(135deg,var(--azul-2),var(--azul) 55%,var(--azul-deep));border:1px solid rgba(255,255,255,.14);
  box-shadow:inset 0 1px rgba(255,255,255,.18),0 14px 34px -14px rgba(19,28,150,.6);
  transition:transform .15s var(--ease),box-shadow .15s var(--ease),opacity .15s var(--ease)}
.rtl-cta:hover:not(:disabled){transform:translateY(-1px);box-shadow:inset 0 1px rgba(255,255,255,.2),0 18px 40px -14px rgba(19,28,150,.7)}
.rtl-cta:disabled{opacity:.6;cursor:not-allowed}
.rtl-cta svg{transition:transform .18s var(--ease-out)}.rtl-cta:hover:not(:disabled) svg{transform:translateX(3px)}
.rtl-aviso{margin-top:12px;text-align:center;font-size:12px;line-height:1.5;color:var(--muted)}
.rtl-erro{margin-top:16px;padding:14px 18px;border-radius:12px;background:rgba(184,92,92,.08);border:1px solid rgba(184,92,92,.28);
  color:var(--coral);font-size:14px;font-weight:500;line-height:1.5;text-align:center}
.rtl-reag{margin-top:20px;text-align:center}
.rtl-reag a{font-size:15px;color:#475467;text-underline-offset:4px}.rtl-reag a:hover{color:var(--ink);text-decoration:underline}
.rtl-cap{margin-top:24px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:13px;color:var(--muted)}
.rtl footer{padding:24px 16px;text-align:center;font-size:13px;color:#5E6B82}
@media(prefers-reduced-motion:reduce){.rtl-ribbon.live i,.rtl-run:after,.rtl-glass{animation:none}}
`;

export function EsperaLead(props: {
  slug: string;
  chave: string;
  entrando: boolean;
  erro: string;
  aoEntrar: () => void;
}) {
  const { slug, chave } = props;
  const [convite, setConvite] = useState<ConviteLead | null>(null);
  const [falha, setFalha] = useState('');
  const [agora, setAgora] = useState(Date.now());
  const [sdr] = useState(() => SDRS[Math.floor(Math.random() * SDRS.length)]!);

  // Relógio da contagem.
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Pergunta ao porteiro como está a reunião: a cada 5 s perto da hora (para o
  // botão aparecer logo que o anfitrião entra), a cada 60 s antes disso.
  const perto = convite ? agora >= new Date(convite.inicio).getTime() - 30 * 60 * 1000 : true;
  useEffect(() => {
    let vivo = true;
    const consulta = () =>
      buscaConvite(slug, chave)
        .then((c) => { if (vivo) { setConvite(c); setFalha(''); } })
        .catch((e) => { if (vivo && !convite) setFalha(e instanceof Error ? e.message : 'Não encontramos esta reunião.'); });
    void consulta();
    const t = setInterval(consulta, perto ? 5000 : 60000);
    return () => { vivo = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, chave, perto]);

  const f = convite ? fase(convite, agora) : null;
  const reagendar = convite
    ? `https://wa.me/${sdr.fone}?text=${encodeURIComponent(
        `Olá! Marquei uma reunião com a Reproduzindo Talentos para ${dataLonga(convite.inicio).toLowerCase()} às ${hora(convite.inicio)} e preciso reagendar.`,
      )}`
    : `https://wa.me/${sdr.fone}`;

  const topo: Record<Fase, { fita: string; tipo: string; sub: string }> = {
    contagem: { fita: 'Reunião confirmada', tipo: '', sub: 'Tudo certo: o seu horário está garantido.' },
    aguardando: { fita: 'Começando', tipo: 'live', sub: 'Seu especialista entra a qualquer momento.' },
    aberta: { fita: 'Sala aberta', tipo: 'live', sub: 'Tudo pronto: é só entrar.' },
    encerrada: { fita: 'Reunião encerrada', tipo: 'quiet', sub: 'Obrigado pela conversa.' },
    passou: { fita: 'Horário encerrado', tipo: 'danger', sub: 'O horário desta reunião passou. Vamos remarcar?' },
    cancelada: { fita: 'Reunião cancelada', tipo: 'danger', sub: 'Esta reunião foi cancelada. Vamos marcar outro horário?' },
  };

  const falta = convite ? Math.max(0, Math.floor((new Date(convite.inicio).getTime() - agora) / 1000)) : 0;
  const cadastro = ESPECIALISTAS[String(convite?.especialista ?? '').trim().toLowerCase()];
  const esp = cadastro?.nome || convite?.especialista || 'Equipe Reproduzindo Talentos';
  const foto = cadastro?.foto;

  return (
    <div className="rtl">
      <style>{CSS}</style>
      <main>
        <div className="rtl-glass">
          <img className="rtl-logo" src={logoRt} alt="Reproduzindo Talentos" />

          {!convite ? (
            falha ? (
              <div style={{ textAlign: 'center' }}>
                <h1>Reunião não encontrada</h1>
                <p className="rtl-sub">{falha}</p>
                <p className="rtl-reag"><a href={reagendar} target="_blank" rel="noopener noreferrer">Fale com a nossa equipe</a></p>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div className="rtl-run" />
                <p className="rtl-wait" style={{ marginTop: 0 }}>Confirmando os detalhes da sua reunião…</p>
              </div>
            )
          ) : (
            <>
              <div style={{ textAlign: 'center' }}>
                <span className={`rtl-ribbon ${topo[f!].tipo}`} role="status" aria-live="polite"><i aria-hidden="true" />{topo[f!].fita}</span>
                <h1>Olá{convite.nome ? `, ${convite.nome}` : ''}.</h1>
                <p className="rtl-sub">{topo[f!].sub}</p>
              </div>

              <div className="rtl-card">
                <div className="rtl-esp">
                  <span className="rtl-av" aria-hidden="true">{foto ? <img src={foto} alt="" /> : iniciais(esp)}</span>
                  <div style={{ minWidth: 0 }}>
                    <p className="rtl-host">{esp}</p>
                    <p className="rtl-role">Seu especialista · Reproduzindo Talentos</p>
                  </div>
                </div>
                <div className="rtl-div" />
                <div className="rtl-stats">
                  <div><span className="rtl-lab">Data</span><span className="rtl-val">{dataLonga(convite.inicio)}</span></div>
                  <div><span className="rtl-lab">Horário</span><span className="rtl-val">{hora(convite.inicio)} <small>· Brasília</small></span></div>
                </div>
                {f === 'contagem' && (
                  <>
                    <div className="rtl-div" />
                    <span className="rtl-lab">Começa em</span>
                    <div className="rtl-ct" role="timer" aria-label="Tempo restante até o início da reunião">
                      <div><b>{dois(Math.floor(falta / 86400))}</b><span>dias</span></div>
                      <div><b>{dois(Math.floor((falta % 86400) / 3600))}</b><span>horas</span></div>
                      <div><b>{dois(Math.floor((falta % 3600) / 60))}</b><span>min</span></div>
                      <div><b>{dois(falta % 60)}</b><span>seg</span></div>
                    </div>
                  </>
                )}
              </div>

              {f === 'contagem' && (
                <p className="rtl-wait" role="status">Deixe esta página aberta: o botão de entrar aparece na hora da reunião.</p>
              )}
              {f === 'aguardando' && (
                <div className="rtl-wait" role="status">
                  <div className="rtl-run" />
                  Assim que o seu especialista entrar, o botão de acesso aparece aqui.
                </div>
              )}
              {(f === 'aberta' || f === 'encerrada') && (
                <>
                  <button type="button" className="rtl-cta" disabled={props.entrando} onClick={props.aoEntrar}>
                    {props.entrando ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                    {f === 'aberta' ? 'Entrar na reunião' : 'Voltar para a reunião'}
                    {!props.entrando && <ArrowRight className="h-5 w-5" />}
                  </button>
                  <p className="rtl-aviso">
                    Ao entrar, você concorda que a reunião pode ser gravada, transcrita e analisada por inteligência
                    artificial, incluindo expressões do rosto, para melhorarmos o nosso atendimento.
                  </p>
                </>
              )}
              {(f === 'passou' || f === 'cancelada') && (
                <a className="rtl-cta" href={reagendar} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                  Reagendar agora <ArrowRight className="h-5 w-5" />
                </a>
              )}

              {props.erro && <p className="rtl-erro">{props.erro}</p>}

              {f !== 'passou' && f !== 'cancelada' && (
                <p className="rtl-reag">
                  <a href={reagendar} target="_blank" rel="noopener noreferrer">Não vai conseguir participar? Reagende aqui</a>
                </p>
              )}
              <p className="rtl-cap"><Video className="h-4 w-4" aria-hidden="true" />A chamada abre aqui no navegador, sem instalar nada.</p>
            </>
          )}
        </div>
      </main>
      <footer>© {new Date().getFullYear()} Reproduzindo Talentos. Todos os direitos reservados.</footer>
    </div>
  );
}
