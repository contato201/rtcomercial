import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { pdfText, pageUrl, scripts } = await req.json();

    if (!pdfText && !pageUrl && !scripts) {
      return new Response(
        JSON.stringify({ error: "Envie pelo menos uma entrada (PDF, URL ou scripts)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let userPrompt = `Analise o seguinte perfil/prospect e gere um ROTEIRO DE VÍDEO DE PROSPECÇÃO detalhado. O roteiro deve demonstrar valor, apontar melhorias e posicionar nossos serviços como solução.\n\n`;

    if (pdfText) {
      userPrompt += `## Dados do perfil Instagram (extraídos do PDF):\n${pdfText}\n\n`;
    }
    if (pageUrl) {
      userPrompt += `## URL da página do prospect:\n${pageUrl}\n\n`;
    }
    if (scripts) {
      userPrompt += `## Scripts de prospecção atuais:\n${scripts}\n\n`;
    }

    const systemPrompt = `Você é um especialista em marketing digital e prospecção B2B. Seu papel é analisar perfis de Instagram, páginas de vendas/captura/negócio local e scripts de prospecção.

Com base nas informações fornecidas, gere um ROTEIRO DE VÍDEO DE PROSPECÇÃO personalizado que:

1. **Abertura (10-15s)**: Cumprimento personalizado mencionando o nome/negócio do prospect
2. **Diagnóstico (30-45s)**: Aponte 3-5 problemas ou oportunidades de melhoria identificados no perfil/página
3. **Soluções (30-45s)**: Para cada problema, sugira uma solução concreta e prática
4. **Prova social (10-15s)**: Mencione resultados que você já alcançou para clientes similares
5. **CTA (10-15s)**: Convite claro para uma conversa/reunião

Também forneça:
- **Resumo executivo**: 2-3 frases sobre o prospect
- **Tipo de negócio detectado**: (perfil pessoal, negócio local, e-commerce, infoproduto, lançamento, etc.)
- **Nível de maturidade digital**: (iniciante, intermediário, avançado)
- **Top 3 melhorias prioritárias**

Formate o roteiro de forma clara com timestamps e falas sugeridas. Use linguagem profissional mas acessível.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Erro ao processar análise" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "Não foi possível gerar a análise.";

    return new Response(
      JSON.stringify({ analysis: content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("analyze-profile error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
