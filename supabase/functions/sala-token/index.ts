// RT Meet — porteiro das salas de reunião.
//
// É a ÚNICA porta entre quem está de fora e a tabela `reunioes_salas`. O lead
// nunca fala com o banco: ele fala com esta função, que roda com a chave de
// serviço e devolve só o mínimo.
//
// Três ações (POST, corpo JSON):
//   { acao: "buscar", email }                → reuniões daquele e-mail (sem dados sensíveis)
//   { acao: "entrar", slug, nome?, email? }  → crachá (token) para entrar na sala
//   { acao: "encerrar", slug }               → marca a reunião como encerrada (só equipe)
//
// Quem é quem:
//   • equipe logada (JWT do Supabase + e-mail na lista de editores) → anfitrião,
//     ou observador se pedir `papel: "observador"` (entra invisível e mudo);
//   • qualquer outra pessoa → lead, e só se o e-mail bater com o da reunião.
//
// Segredos no cofre do Supabase (Edge Functions → secrets):
//   LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL (wss://…livekit.cloud)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const limpaEmail = (v: unknown) => String(v ?? "").trim().toLowerCase();
const primeiroNome = (v: string) => (v || "").trim().split(/\s+/)[0] ?? "";

// Janela em que a sala aceita gente: 30 min antes do horário até 4 h depois.
const ANTES_MS = 30 * 60 * 1000;
const DEPOIS_MS = 4 * 60 * 60 * 1000;

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
    if (!email.includes("@")) return json({ ok: false, erro: "email_invalido" }, 400);

    const agora = Date.now();
    const { data, error } = await db
      .from("reunioes_salas")
      .select("slug, titulo, inicio, duracao_min, sdr, status")
      .eq("lead_email", email)
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
      // só o primeiro nome do SDR — ninguém precisa da lista da equipe
      com: primeiroNome(s.sdr),
      aberta: new Date(s.inicio).getTime() - ANTES_MS <= agora,
    }));

    return json({ ok: true, salas });
  }

  // ── entrar: devolve o crachá para entrar na sala ──────────────────────────
  if (acao === "entrar") {
    const slug = String(corpo.slug ?? "").trim().toLowerCase();
    if (!slug) return json({ ok: false, erro: "sala_invalida" }, 400);

    const { data: sala, error } = await db
      .from("reunioes_salas")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) return json({ ok: false, erro: "falha_na_busca" }, 500);
    if (!sala) return json({ ok: false, erro: "sala_nao_encontrada" }, 404);
    if (sala.status === "cancelada") return json({ ok: false, erro: "sala_cancelada" }, 410);

    const inicio = new Date(sala.inicio).getTime();
    const agora = Date.now();
    const dentroDaJanela = agora >= inicio - ANTES_MS && agora <= inicio + DEPOIS_MS;

    let papel: "anfitriao" | "observador" | "lead";

    if (equipe) {
      papel = corpo.papel === "observador" ? "observador" : "anfitriao";
    } else {
      // Visitante: só entra se for o lead da reunião e dentro do horário.
      if (limpaEmail(corpo.email) !== limpaEmail(sala.lead_email)) {
        return json({ ok: false, erro: "email_nao_confere" }, 403);
      }
      // Reunião encerrada não barra o lead: se o anfitrião caiu ou saiu sem
      // querer e voltou, a reunião reabre (logo abaixo). Quem protege a sala
      // fora de hora é a janela de horário.
      if (!dentroDaJanela) {
        return json({ ok: false, erro: "fora_do_horario", inicio: sala.inicio }, 403);
      }
      papel = "lead";
    }

    const nomeInformado = String(corpo.nome ?? "").trim().slice(0, 60);
    const nome = papel === "lead"
      ? (nomeInformado || sala.lead_nome)
      : (nomeInformado || equipe?.email?.split("@")[0] || "Equipe RT");

    const token = await criaCracha({
      identidade: `${papel}-${crypto.randomUUID().slice(0, 8)}`,
      nome,
      sala: `rt-${sala.slug}`,
      podePublicar: papel !== "observador",
      invisivel: papel === "observador",
      admin: papel === "anfitriao",
      metadata: { papel, sala_id: sala.id },
    });

    // Marca que a reunião começou (e que o lead apareceu) — isso é o dado do
    // funil nascendo sozinho, sem ninguém digitar.
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
    if (papel === "lead" && !sala.lead_entrou) mudancas.lead_entrou = true;
    if (Object.keys(mudancas).length > 0) {
      await db.from("reunioes_salas").update(mudancas).eq("id", sala.id);
    }

    return json({
      ok: true,
      token,
      url: LK_URL,
      papel,
      sala: {
        slug: sala.slug,
        titulo: sala.titulo,
        inicio: sala.inicio,
        lead_nome: sala.lead_nome,
        sdr: sala.sdr,
        origem: papel === "lead" ? null : sala.origem,
        gravar: sala.gravar,
      },
    });
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
