// RT Meet — porteiro das salas de reunião.
//
// É a ÚNICA porta entre quem está de fora e as tabelas `reunioes_salas` e
// `reunioes_pedidos`. O lead nunca fala com o banco: ele fala com esta função,
// que roda com a chave de serviço e devolve só o mínimo.
//
// Ações (POST, corpo JSON):
//   Visitante (sem login):
//     { acao: "buscar", email }                         → reuniões daquele e-mail
//     { acao: "entrar", slug, nome, email, consentiu }  → crachá, ou pedido na sala de espera
//     { acao: "pedido", pedido_id, chave }              → como está meu pedido (e o crachá, se aceito)
//   Equipe (JWT do Supabase + e-mail na lista de editores):
//     { acao: "entrar", slug, papel? }                  → anfitrião, ou observador (invisível)
//     { acao: "pedidos", slug }                         → quem está esperando para entrar
//     { acao: "decidir", pedido_id, aceitar }           → aceita ou recusa um pedido
//     { acao: "encerrar", slug }                        → fecha a reunião (chamado quando o anfitrião sai)
//
// Quem entra direto: o e-mail do lead e os da lista de convidados. Os outros:
//   • reunião "só convidados" → barrados;
//   • reunião com sala de espera → pedem para entrar e o anfitrião decide.
//
// Segredos no cofre do Supabase (Edge Functions → secrets):
//   LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL (wss://…livekit.cloud)
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const LK_KEY = Deno.env.get("LIVEKIT_API_KEY") ?? "";
const LK_SECRET = Deno.env.get("LIVEKIT_API_SECRET") ?? "";
const LK_URL = Deno.env.get("LIVEKIT_URL") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

// ── Crachá do LiveKit ───────────────────────────────────────────────────────
// Um token do LiveKit é um JWT comum assinado em HS256 com o API secret. Em vez
// de trazer o SDK inteiro para o Deno, montamos os 3 pedaços na mão.
const b64url = (data: Uint8Array | string) => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function criaCracha(opts: {
  identidade: string;
  nome: string;
  sala: string;
  podePublicar: boolean;
  invisivel: boolean;
  admin: boolean;
  metadata: Record<string, unknown>;
  horas?: number;
}) {
  const agora = Math.floor(Date.now() / 1000);
  const payload = {
    iss: LK_KEY,
    sub: opts.identidade,
    name: opts.nome,
    nbf: agora - 10,
    exp: agora + (opts.horas ?? 6) * 3600,
    metadata: JSON.stringify(opts.metadata),
    video: {
      room: opts.sala,
      roomJoin: true,
      roomAdmin: opts.admin,
      canPublish: opts.podePublicar,
      canPublishData: opts.podePublicar,
      canSubscribe: true,
      hidden: opts.invisivel,
    },
  };

  const cabecalho = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const corpo = b64url(JSON.stringify(payload));
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(LK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinatura = await crypto.subtle.sign(
    "HMAC",
    chave,
    new TextEncoder().encode(`${cabecalho}.${corpo}`),
  );
  return `${cabecalho}.${corpo}.${b64url(new Uint8Array(assinatura))}`;
}

// ── Quem está chamando ──────────────────────────────────────────────────────
async function equipeLogada(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ") || !ANON_KEY) return null;
  try {
    const cliente = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data } = await cliente.auth.getUser();
    if (!data?.user) return null;
    // Mesma lista de editores das políticas do banco (is_authorized_editor).
    const { data: autorizado } = await cliente.rpc("is_authorized_editor");
    if (autorizado !== true) return null;
    return { id: data.user.id, email: data.user.email ?? "" };
  } catch {
    return null;
  }
}

// ── Utilidades ──────────────────────────────────────────────────────────────
const limpaEmail = (v: unknown) => String(v ?? "").trim().toLowerCase();
const primeiroNome = (v: unknown) => String(v ?? "").trim().split(/\s+/)[0] ?? "";
const limpaNome = (v: unknown) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
// Formato simples e sem caracteres que quebrariam o filtro do banco (vírgula,
// parênteses, chaves, aspas). Basta para e-mail de verdade.
const EMAIL_OK = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

// Janela em que a sala aceita gente de fora: 30 min antes até 4 h depois.
const ANTES_MS = 30 * 60 * 1000;
const DEPOIS_MS = 4 * 60 * 60 * 1000;
// Teto de pedidos esperando numa sala, para ninguém lotar a fila de propósito.
const MAX_PEDIDOS_PENDENTES = 30;

type Sala = Record<string, any>;
type Papel = "anfitriao" | "observador" | "lead" | "convidado";

const dentroDaJanela = (sala: Sala) => {
  const inicio = new Date(sala.inicio).getTime();
  const agora = Date.now();
  return agora >= inicio - ANTES_MS && agora <= inicio + DEPOIS_MS;
};

/** E-mails que entram direto: o do lead e os da lista de convidados. */
const listaDeConvidados = (sala: Sala): string[] =>
  [sala.lead_email, ...(sala.convidados ?? [])].map(limpaEmail).filter(Boolean);

/** Com quem é a reunião, do jeito que o lead vê: o closer, ou o SDR. */
const comQuem = (sala: Sala) => primeiroNome(sala.closer) || primeiroNome(sala.sdr) || null;

/**
 * Marca no banco que a reunião começou, que alguém de fora apareceu e o
 * consentimento — é o dado do funil nascendo sozinho, sem ninguém digitar.
 */
async function registraEntrada(db: SupabaseClient, sala: Sala, papel: Papel, consentiu: boolean) {
  const mudancas: Record<string, unknown> = {};
  if (papel !== "observador") {
    if (sala.status === "agendada") {
      mudancas.status = "ao_vivo";
      mudancas.entrou_em = new Date().toISOString();
    } else if (sala.status === "encerrada") {
      // Alguém voltou depois de encerrada (queda de internet, saiu sem
      // querer): reabre, e o fim passa a ser a próxima saída do anfitrião.
      mudancas.status = "ao_vivo";
      mudancas.encerrada_em = null;
    }
  }
  const deFora = papel === "lead" || papel === "convidado";
  if (deFora && !sala.lead_entrou) mudancas.lead_entrou = true;
  if (deFora && consentiu && !sala.consentimento_em) {
    mudancas.consentimento_em = new Date().toISOString();
  }
  if (Object.keys(mudancas).length > 0) {
    await db.from("reunioes_salas").update(mudancas).eq("id", sala.id);
  }
}

/** Monta a resposta com o crachá. Quem é de fora recebe menos informação. */
async function respostaComCracha(sala: Sala, papel: Papel, nome: string, consentiu: boolean) {
  const equipe = papel === "anfitriao" || papel === "observador";
  const token = await criaCracha({
    identidade: `${papel}-${crypto.randomUUID().slice(0, 8)}`,
    nome,
    sala: `rt-${sala.slug}`,
    podePublicar: papel !== "observador",
    invisivel: papel === "observador",
    admin: papel === "anfitriao",
    // `consentiu` diz às próximas fases (transcrição, análise do rosto) se
    // podem processar essa pessoa. Equipe é sempre sim; quem é de fora, só
    // se marcou "Concordo".
    metadata: { papel, sala_id: sala.id, consentiu: equipe ? true : consentiu },
  });

  return json({
    ok: true,
    token,
    url: LK_URL,
    papel,
    sala: {
      slug: sala.slug,
      titulo: sala.titulo,
      inicio: sala.inicio,
      com: comQuem(sala),
      // Daqui pra baixo, só a equipe vê. O lead nunca recebe origem, SDR,
      // closer completo nem o nome cadastrado de outras pessoas.
      lead_nome: equipe ? sala.lead_nome : null,
      sdr: equipe ? sala.sdr : null,
      closer: equipe ? sala.closer : null,
      origem: equipe ? sala.origem : null,
      acesso: equipe ? sala.acesso : null,
    },
  });
}

async function buscaSala(db: SupabaseClient, slug: unknown) {
  const s = String(slug ?? "").trim().toLowerCase();
  if (!s) return { erro: json({ ok: false, erro: "sala_invalida" }, 400) };
  const { data, error } = await db.from("reunioes_salas").select("*").eq("slug", s).maybeSingle();
  if (error) return { erro: json({ ok: false, erro: "falha_na_busca" }, 500) };
  if (!data) return { erro: json({ ok: false, erro: "sala_nao_encontrada" }, 404) };
  return { sala: data as Sala };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, erro: "metodo_invalido" }, 405);

  if (!LK_KEY || !LK_SECRET || !LK_URL) {
    return json({ ok: false, erro: "livekit_nao_configurado" }, 500);
  }

  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return json({ ok: false, erro: "corpo_invalido" }, 400);
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const acao = String(corpo.acao ?? "");
  const equipe = await equipeLogada(req);

  // ── buscar: o lead digita o e-mail e descobre a reunião dele ──────────────
  if (acao === "buscar") {
    const email = limpaEmail(corpo.email);
    if (!EMAIL_OK.test(email)) return json({ ok: false, erro: "email_invalido" }, 400);

    const agora = Date.now();
    const { data, error } = await db
      .from("reunioes_salas")
      .select("slug, titulo, inicio, duracao_min, sdr, closer, status")
      .or(`lead_email.eq."${email}",convidados.cs.{"${email}"}`)
      .in("status", ["agendada", "ao_vivo"])
      .gte("inicio", new Date(agora - DEPOIS_MS).toISOString())
      .order("inicio", { ascending: true })
      .limit(5);

    if (error) return json({ ok: false, erro: "falha_na_busca" }, 500);

    const salas = (data ?? []).map((s) => ({
      slug: s.slug,
      titulo: s.titulo,
      inicio: s.inicio,
      duracao_min: s.duracao_min,
      com: comQuem(s),
      aberta: new Date(s.inicio).getTime() - ANTES_MS <= agora,
    }));

    return json({ ok: true, salas });
  }

  // ── entrar ────────────────────────────────────────────────────────────────
  if (acao === "entrar") {
    const { sala, erro } = await buscaSala(db, corpo.slug);
    if (erro) return erro;
    if (sala.status === "cancelada") return json({ ok: false, erro: "sala_cancelada" }, 410);

    // Equipe logada: entra sempre, a qualquer hora.
    if (equipe) {
      const papel: Papel = corpo.papel === "observador" ? "observador" : "anfitriao";
      const nome = limpaNome(corpo.nome) || equipe.email.split("@")[0] || "Equipe RT";
      await registraEntrada(db, sala, papel, true);
      return respostaComCracha(sala, papel, nome, true);
    }

    // Visitante. Reunião encerrada não barra: se o anfitrião caiu e voltou,
    // ela reabre. Quem protege a sala fora de hora é a janela de horário.
    if (!dentroDaJanela(sala)) {
      return json({ ok: false, erro: "fora_do_horario", inicio: sala.inicio }, 403);
    }

    const email = limpaEmail(corpo.email);
    const consentiu = corpo.consentiu === true;
    const convidado = listaDeConvidados(sala).includes(email);

    if (convidado) {
      const papel: Papel = email === limpaEmail(sala.lead_email) ? "lead" : "convidado";
      const nome = limpaNome(corpo.nome) || (papel === "lead" ? sala.lead_nome : "") || "Convidado";
      await registraEntrada(db, sala, papel, consentiu);
      return respostaComCracha(sala, papel, nome, consentiu);
    }

    // Não está na lista.
    if (sala.acesso !== "espera") return json({ ok: false, erro: "email_nao_confere" }, 403);

    // Sala de espera: registra o pedido e devolve a chave para acompanhar.
    const nome = limpaNome(corpo.nome);
    if (!nome || !EMAIL_OK.test(email)) return json({ ok: false, erro: "dados_incompletos" }, 400);

    // Pediu de novo (recarregou a página)? Reaproveita o pedido pendente.
    const { data: jaPediu } = await db
      .from("reunioes_pedidos")
      .select("id, chave")
      .eq("sala_id", sala.id)
      .eq("email", email)
      .eq("status", "pendente")
      .maybeSingle();
    if (jaPediu) return json({ ok: true, aguardando: true, pedido: jaPediu });

    const { count } = await db
      .from("reunioes_pedidos")
      .select("id", { count: "exact", head: true })
      .eq("sala_id", sala.id)
      .eq("status", "pendente");
    if ((count ?? 0) >= MAX_PEDIDOS_PENDENTES) {
      return json({ ok: false, erro: "fila_cheia" }, 429);
    }

    const { data: pedido, error: erroPedido } = await db
      .from("reunioes_pedidos")
      .insert({ sala_id: sala.id, nome, email, consentiu })
      .select("id, chave")
      .single();
    if (erroPedido || !pedido) return json({ ok: false, erro: "falha_no_pedido" }, 500);

    return json({ ok: true, aguardando: true, pedido });
  }

  // ── pedido: quem está na sala de espera pergunta se já foi aceito ─────────
  if (acao === "pedido") {
    const id = String(corpo.pedido_id ?? "");
    const chave = String(corpo.chave ?? "");
    if (!id || !chave) return json({ ok: false, erro: "pedido_invalido" }, 400);

    const { data: pedido } = await db
      .from("reunioes_pedidos")
      .select("*, sala:reunioes_salas(*)")
      .eq("id", id)
      .eq("chave", chave)
      .maybeSingle();
    if (!pedido) return json({ ok: false, erro: "pedido_invalido" }, 404);

    if (pedido.status === "pendente") return json({ ok: true, aguardando: true });
    if (pedido.status === "recusado") return json({ ok: false, erro: "pedido_recusado" }, 403);

    const sala = pedido.sala as Sala;
    if (sala.status === "cancelada") return json({ ok: false, erro: "sala_cancelada" }, 410);
    await registraEntrada(db, sala, "convidado", pedido.consentiu);
    return respostaComCracha(sala, "convidado", pedido.nome, pedido.consentiu);
  }

  // ── pedidos: o anfitrião vê quem está esperando ───────────────────────────
  if (acao === "pedidos") {
    if (!equipe) return json({ ok: false, erro: "nao_autorizado" }, 401);
    const { sala, erro } = await buscaSala(db, corpo.slug);
    if (erro) return erro;
    const { data } = await db
      .from("reunioes_pedidos")
      .select("id, nome, email, created_at")
      .eq("sala_id", sala.id)
      .eq("status", "pendente")
      .order("created_at", { ascending: true });
    return json({ ok: true, pedidos: data ?? [] });
  }

  // ── decidir: o anfitrião aceita ou recusa ─────────────────────────────────
  if (acao === "decidir") {
    if (!equipe) return json({ ok: false, erro: "nao_autorizado" }, 401);
    const id = String(corpo.pedido_id ?? "");
    const { error } = await db
      .from("reunioes_pedidos")
      .update({
        status: corpo.aceitar === true ? "aceito" : "recusado",
        decidido_em: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "pendente");
    if (error) return json({ ok: false, erro: "falha_ao_decidir" }, 500);
    return json({ ok: true });
  }

  // ── encerrar: só a equipe fecha a reunião ─────────────────────────────────
  // Chamada sozinha quando o anfitrião sai da sala. Só fecha reunião que
  // estava acontecendo — nunca carimba fim em reunião que nem começou.
  if (acao === "encerrar") {
    if (!equipe) return json({ ok: false, erro: "nao_autorizado" }, 401);
    const slug = String(corpo.slug ?? "").trim().toLowerCase();
    const { error } = await db
      .from("reunioes_salas")
      .update({ status: "encerrada", encerrada_em: new Date().toISOString() })
      .eq("slug", slug)
      .eq("status", "ao_vivo");
    if (error) return json({ ok: false, erro: "falha_ao_encerrar" }, 500);
    return json({ ok: true });
  }

  return json({ ok: false, erro: "acao_desconhecida" }, 400);
});
