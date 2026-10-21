// RT Meet — Coach IA.
//
// O cérebro do Coach. Recebe da sala do closer os trechos novos da conversa,
// junta com o processo comercial da RT (coach/processo-comercial.md) e pede ao
// Claude o que mostrar agora: o bloco do roteiro, a ficha preenchida, uma dica
// curta. No fim da reunião, escreve o relatório no padrão do Allan.
//
// Só a equipe logada chama (mesma lista de editores do banco). O lead nunca
// fala com esta função, e nada do que ela devolve vai para a tela dele.
//
// Ações (POST, corpo JSON):
//   { acao: "dica", sala_id, minuto, fala_closer_pct, estado, novos }
//   { acao: "relatorio", sala_id }
//
// Segredo no cofre do Supabase: ANTHROPIC_API_KEY.
import Anthropic from "npm:@anthropic-ai/sdk@0.133.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PROCESSO } from "./processo.ts";

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

// A chave da RT foi criada fora de um workspace, e chave assim precisa dizer
// em cada pedido de qual workspace ele é — senão o Claude recusa (erro 400).
// O id não é segredo. Se um dia a chave for trocada por uma criada dentro do
// workspace, este cabeçalho continua valendo e não atrapalha.
const WORKSPACE_ID = Deno.env.get("ANTHROPIC_WORKSPACE_ID") ?? "wrkspc_01SFK8JcwkaNQgdzFzFAsFRg";

// Haiku 5.5: o Claude mais barato (US$ 0,10 por milhão de palavras lidas,
// 40x menos que o Opus). Escolha do Allan: o Coach tem que custar centavos
// por reunião. Uma hora de call sai por volta de US$ 0,07 (dicas + relatório).
const MODELO = "claude-haiku-5-5";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function equipeLogada(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ") || !ANON_KEY) return null;
  try {
    const cliente = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data } = await cliente.auth.getUser();
    if (!data?.user) return null;
    const { data: autorizado } = await cliente.rpc("is_authorized_editor");
    return autorizado === true ? data.user : null;
  } catch {
    return null;
  }
}

// ── O que o Coach acompanha ─────────────────────────────────────────────────

/** Blocos do roteiro, com os nomes exatos das tabelas 3.2 e 4.1 do processo. */
const ROTEIRO: Record<1 | 2, string[]> = {
  1: ["Abertura", "Motivo", "Descoberta", "Funil atual", "Auditoria ao vivo", "Dinheiro parado", "RT + método", "Próximo passo"],
  2: ["Recapitulação", "Ecossistema", "Primeira ação", "Projeção", "Responsabilidades", "Entregáveis", "Investimento", "Condição e fechamento", "Próximos passos"],
};

/** Campos da ficha (seção 3.3). Os 7 primeiros são a prioridade 1. */
const CAMPOS_FICHA = [
  "alunos", "capacidade", "ticket", "faturamento", "meta", "decisor", "verba",
  "captacao_atual", "agencia_anterior", "funil", "atendimento_leads", "evasao",
  "permanencia", "sazonalidade", "gatilho_urgencia",
];

/** Formato da resposta ao vivo. O Claude é obrigado a responder exatamente assim. */
const FORMATO_DICA = {
  type: "object",
  additionalProperties: false,
  required: ["bloco_atual", "ficha", "dica", "pendencias_novas", "citacoes_fortes", "spin_novas", "termometro", "orientacao"],
  properties: {
    bloco_atual: { type: "string", description: "Nome exato de um bloco do roteiro desta reunião." },
    ficha: {
      type: "array",
      description: "Só campos que apareceram ou mudaram no trecho novo.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["campo", "valor", "fonte"],
        properties: {
          campo: { type: "string", enum: CAMPOS_FICHA },
          valor: { type: "string" },
          fonte: { type: "string", enum: ["cliente", "closer", "estimativa"] },
        },
      },
    },
    dica: {
      type: "object",
      additionalProperties: false,
      required: ["nivel", "texto", "motivo"],
      properties: {
        nivel: { type: "string", enum: ["critico", "atencao", "sugestao", "nenhuma"] },
        texto: { type: "string", description: "No máximo 15 palavras. Vazio se nivel = nenhuma." },
        motivo: { type: "string" },
      },
    },
    pendencias_novas: { type: "array", items: { type: "string" } },
    citacoes_fortes: { type: "array", items: { type: "string" } },
    spin_novas: {
      type: "object",
      additionalProperties: false,
      required: ["situacao", "problema", "implicacao", "necessidade"],
      properties: {
        situacao: { type: "integer" },
        problema: { type: "integer" },
        implicacao: { type: "integer" },
        necessidade: { type: "integer" },
      },
    },
    termometro: { type: "integer", description: "Qualificação de 0 a 100, pela seção 5.5." },
    // Teleprompter do closer (inspirado no Abracadabra Meet). Vazio = nada a dizer.
    orientacao: {
      type: "object",
      additionalProperties: false,
      required: ["fala_sugerida", "proximo_passo", "evite_agora", "risco"],
      properties: {
        fala_sugerida: { type: "string", description: "Frase pronta para o closer ler agora, até 30 palavras, terminando com pergunta ao cliente." },
        proximo_passo: { type: "string", description: "Para onde levar a conversa agora, até 15 palavras." },
        evite_agora: { type: "string", description: "O que não fazer neste momento, até 15 palavras." },
        risco: { type: "string", description: "Sinal de que a reunião pode acabar em 'vou pensar', até 15 palavras." },
      },
    },
  },
};

const FORMATO_RELATORIO = {
  type: "object",
  additionalProperties: false,
  required: ["relatorio", "nota"],
  properties: {
    relatorio: { type: "string", description: "PARTE A e PARTE B em Markdown, no padrão da seção 6." },
    nota: { type: "integer", description: "Nota de 0 a 10 da reunião." },
  },
};

// O processo comercial vem primeiro e não muda entre as chamadas: fica em
// cache na Anthropic, e cada dica nova paga só o trecho novo da conversa.
const SISTEMA = [
  {
    type: "text",
    text:
      "Você é o Coach de IA da Reproduzindo Talentos. O manual abaixo é a sua base: siga-o à risca.\n\n" +
      "<processo_comercial>\n" + PROCESSO + "\n</processo_comercial>",
    cache_control: { type: "ephemeral" },
  },
];

const INSTRUCAO_AO_VIVO = `Você está acompanhando a reunião AO VIVO, pela lateral da tela do closer.
O cliente nunca vê o que você escreve.

Responda olhando o estado atual e o trecho novo:
- bloco_atual: o bloco do roteiro em que a conversa está agora (use um dos nomes da lista).
- ficha: só o que o trecho novo revelou. Número dito pelo closer como se fosse do cliente → fonte "closer". Conta ou suposição → "estimativa". Nunca invente: se não foi dito, não entra.
- dica: no máximo UMA, de até 15 palavras, específica e acionável (seção 5.1). Respeite os gatilhos da seção 5.3 e os níveis da 5.2. Use "nenhuma" quando não houver nada que valha interromper — na dúvida, "nenhuma". Não repita uma dica que já está em dicas_recentes.
- pendencias_novas: promessas ("te mando…"), condições ditas de boca, preços a enviar.
- citacoes_fortes: frases do cliente que valem ser usadas depois, palavra por palavra.
- spin_novas: quantas perguntas de cada tipo o closer fez NESTE trecho (seção 9.3).
- termometro: qualificação atual de 0 a 100 (seção 5.5).
- orientacao: o teleprompter do closer. Escreva em português simples, na voz da RT.
  - fala_sugerida: frase pronta para o closer ler AGORA, com as palavras dele, até 30 palavras,
    sempre terminando com uma pergunta que devolve a palavra ao cliente. Use quando o closer
    estiver falando demais, quando a atenção do cliente cair, ou quando faltar a pergunta-chave
    do bloco atual. Use os números da ficha e o dinheiro_parado_ano quando ajudarem. Vazio se
    a conversa estiver fluindo bem.
  - proximo_passo: para onde levar a conversa agora, ligado ao roteiro e ao que falta da ficha.
  - evite_agora: o que NÃO fazer neste momento (ex.: falar de preço antes de saber quem decide,
    apresentar a RT antes do cliente sentir o problema). Vazio se não houver.
  - risco: só com sinal real na conversa, o padrão que costuma terminar em "vou pensar" ou
    "vou ver com o mantenedor". Vazio se não houver.

Engajamento (quando vier): medido pela câmera do cliente no último minuto. "Atenção" é quanto
tempo ele ficou olhando para a tela. É um sinal, não uma certeza. Atenção abaixo de 50% por
causa do closer falando demais → dica para fazer uma pergunta e devolver a palavra.`;

// Engajamento do relatório: uma linha por pessoa, minuto a minuto.
function linhasDoEngajamento(linhas: Array<{ quem: string; minuto: number; atencao: number; sorriso: number }>) {
  const porPessoa = new Map<string, string[]>();
  for (const l of linhas) {
    const lista = porPessoa.get(l.quem) ?? [];
    lista.push(`min ${l.minuto}: atenção ${l.atencao}%, sorriso ${l.sorriso}%`);
    porPessoa.set(l.quem, lista);
  }
  return [...porPessoa.entries()].map(([quem, lista]) => `${quem}: ${lista.join("; ")}`).join("\n");
}

function linhasDaConversa(trechos: Array<{ quem: string; papel?: string; texto: string }>) {
  return trechos
    .map((t) => {
      const lado = t.papel === "anfitriao" ? "CLOSER" : "CLIENTE";
      return `[${lado}] ${t.quem}: ${t.texto}`;
    })
    .join("\n");
}

function textoDaResposta(resposta: { content: Array<{ type: string; text?: string }> }) {
  return resposta.content.find((b) => b.type === "text")?.text ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, erro: "metodo_invalido" }, 405);
  if (!ANTHROPIC_KEY) return json({ ok: false, erro: "coach_nao_configurado" }, 500);

  const equipe = await equipeLogada(req);
  if (!equipe) return json({ ok: false, erro: "nao_autorizado" }, 401);

  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return json({ ok: false, erro: "corpo_invalido" }, 400);
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: sala } = await db
    .from("reunioes_salas")
    .select("id, titulo, lead_nome, sdr, closer, origem, tipo_reuniao, notas_sdr, inicio")
    .eq("id", String(corpo.sala_id ?? ""))
    .maybeSingle();
  if (!sala) return json({ ok: false, erro: "sala_nao_encontrada" }, 404);

  const tipo = (sala.tipo_reuniao === 2 ? 2 : 1) as 1 | 2;
  const claude = new Anthropic({
    apiKey: ANTHROPIC_KEY,
    defaultHeaders: { "anthropic-workspace-id": WORKSPACE_ID },
  });
  const contexto = [
    `Reunião ${tipo} (${tipo === 1 ? "Consultoria / Diagnóstico" : "Plano de Ação / Proposta"}).`,
    `Roteiro desta reunião: ${ROTEIRO[tipo].join(" → ")}.`,
    `Cliente: ${sala.lead_nome ?? "não cadastrado"}. Closer: ${sala.closer ?? "não informado"}. SDR: ${sala.sdr ?? "não informado"}. Origem: ${sala.origem ?? "não informada"}.`,
    `Notas do SDR: ${sala.notas_sdr?.trim() || "nenhuma"}.`,
  ].join("\n");

  try {
    // ── dica: o que mostrar ao closer agora ─────────────────────────────────
    if (corpo.acao === "dica") {
      const novos = Array.isArray(corpo.novos) ? corpo.novos as Array<{ quem: string; papel?: string; texto: string }> : [];
      if (novos.length === 0) return json({ ok: true, nada: true });

      const pedido = {
        model: MODELO,
        max_tokens: 4000,
        // Ao vivo, rapidez vale mais que profundidade: esforço baixo.
        output_config: { effort: "low", format: { type: "json_schema", schema: FORMATO_DICA } },
        system: SISTEMA,
        messages: [{
          role: "user",
          content:
            `${INSTRUCAO_AO_VIVO}\n\n<reuniao>\n${contexto}\nMinuto: ${Number(corpo.minuto) || 0}. ` +
            `Fala do closer até agora: ${Number(corpo.fala_closer_pct) || 0}%.` +
            (typeof corpo.engajamento === "string" && corpo.engajamento
              ? `\nEngajamento (câmera, último minuto): ${corpo.engajamento.slice(0, 500)}.`
              : "") +
            `\n</reuniao>\n\n` +
            `<estado_atual>\n${JSON.stringify(corpo.estado ?? {})}\n</estado_atual>\n\n` +
            `<trecho_novo>\n${linhasDaConversa(novos)}\n</trecho_novo>`,
        }],
      };
      // deno-lint-ignore no-explicit-any
      const resposta = await claude.messages.create(pedido as any);
      if (resposta.stop_reason === "refusal") return json({ ok: true, nada: true });
      return json({ ok: true, coach: JSON.parse(textoDaResposta(resposta)) });
    }

    // ── relatorio: PARTE A + PARTE B, no fim da reunião ─────────────────────
    if (corpo.acao === "relatorio") {
      const { data: trechos } = await db
        .from("reunioes_transcricao")
        .select("quem, papel, texto")
        .eq("sala_id", sala.id)
        .order("falado_em", { ascending: true })
        .limit(5000);
      if (!trechos || trechos.length === 0) return json({ ok: false, erro: "sem_transcricao" }, 422);

      const { data: coach } = await db.from("reunioes_coach").select("estado").eq("sala_id", sala.id).maybeSingle();
      const { data: engajamento } = await db
        .from("reunioes_engajamento")
        .select("quem, minuto, atencao, sorriso")
        .eq("sala_id", sala.id)
        .order("minuto", { ascending: true })
        .limit(2000);
      const blocoEngajamento = engajamento && engajamento.length > 0
        ? `\n\n<engajamento>\nMedido pela câmera do cliente (atenção = olhando para a tela). É sinal, não certeza. ` +
          `Na PARTE A, diga em que momentos a atenção caiu ou subiu e o que estava sendo falado.\n` +
          `${linhasDoEngajamento(engajamento)}\n</engajamento>`
        : "";

      const pedido = {
        model: MODELO,
        max_tokens: 32000,
        output_config: { effort: "high", format: { type: "json_schema", schema: FORMATO_RELATORIO } },
        system: SISTEMA,
        messages: [{
          role: "user",
          content:
            `A reunião terminou. Escreva o relatório da seção 6 (PARTE A: feedback; PARTE B: ficha da instituição), ` +
            `em português direto, sem inventar dado: o que não foi dito fica "não informado"; estimativas ficam marcadas. ` +
            `Se a transcrição estiver ruim em algum ponto, avise.\n\n<reuniao>\n${contexto}\nData: ${sala.inicio}.\n</reuniao>\n\n` +
            `<estado_do_coach>\n${JSON.stringify(coach?.estado ?? {})}\n</estado_do_coach>\n\n` +
            `<transcricao>\n${linhasDaConversa(trechos)}\n</transcricao>` + blocoEngajamento,
        }],
      };
      // Relatório longo: em fluxo, para não estourar o tempo de espera.
      // deno-lint-ignore no-explicit-any
      const resposta = await claude.messages.stream(pedido as any).finalMessage();
      if (resposta.stop_reason === "refusal") return json({ ok: false, erro: "recusado" }, 422);

      const { relatorio, nota } = JSON.parse(textoDaResposta(resposta));
      const notaValida = Math.max(0, Math.min(10, Math.round(Number(nota) || 0)));
      await db.from("reunioes_coach").upsert({
        sala_id: sala.id,
        relatorio,
        nota: notaValida,
        relatorio_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return json({ ok: true, relatorio, nota: notaValida });
    }

    return json({ ok: false, erro: "acao_desconhecida" }, 400);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ ok: false, erro: "coach_ocupado" }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ ok: false, erro: "coach_chave_invalida" }, 500);
    if (e instanceof Anthropic.APIError) {
      console.error("Claude respondeu erro", e.status, e.message);
      return json({ ok: false, erro: "coach_falhou" }, 502);
    }
    console.error("Coach falhou", e);
    return json({ ok: false, erro: "coach_falhou" }, 500);
  }
});
