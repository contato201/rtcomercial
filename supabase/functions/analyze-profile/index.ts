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

    const { pdfText, pageUrl, pageType, businessType, scripts, prospectName } = await req.json();

    if (!pdfText && !pageUrl && !scripts) {
      return new Response(
        JSON.stringify({ error: "Envie pelo menos uma entrada (PDF, URL ou scripts)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const businessTypeLabels: Record<string, string> = {
      "negocio-local": "Negócio Local",
      "infoproduto": "Infoproduto",
      "ecommerce": "E-commerce",
      "saas": "SaaS / Software",
      "servicos": "Prestação de Serviços",
    };

    const pageTypeLabels: Record<string, string> = {
      "vendas": "Página de Vendas",
      "captura": "Página de Captura / Lançamento",
      "negocio-local": "Página de Negócio Local",
      "institucional": "Site Institucional",
    };

    let userPrompt = `Analise o seguinte prospect com profundidade consultiva e gere uma análise estratégica completa.\n\n`;

    if (prospectName) {
      userPrompt += `## Nome do Prospect: ${prospectName}\n\n`;
    }

    if (businessType) {
      userPrompt += `## Tipo de Negócio: ${businessTypeLabels[businessType] || businessType}\n\n`;
    }

    if (pdfText) {
      userPrompt += `## Dados do perfil Instagram (extraídos do PDF):\n${pdfText}\n\n`;
    }
    if (pageUrl) {
      const pageLabel = pageType ? (pageTypeLabels[pageType] || pageType) : "não especificado";
      userPrompt += `## URL da página do prospect (Tipo: ${pageLabel}):\n${pageUrl}\n\nAcesse mentalmente esta URL e analise: headline, copy, CTA, design, velocidade percebida, prova social, estrutura de oferta.\n\n`;
    }
    if (scripts) {
      userPrompt += `## Scripts de prospecção atuais:\n${scripts}\n\n`;
    }

    const systemPrompt = `Você é um CONSULTOR SÊNIOR de marketing digital e vendas B2B com 15+ anos de experiência.
Você NÃO é um gerador de textos genéricos. Você é um estrategista que entrega análises de altíssimo valor.

SUA MISSÃO: Entregar uma análise TÃO DETALHADA e PERSONALIZADA que o prospect sinta que você estudou o negócio dele por horas.

═══════════════════════════════════════
ESTRUTURA OBRIGATÓRIA DA ANÁLISE
═══════════════════════════════════════

## 📋 RESUMO EXECUTIVO
- Quem é esse prospect (nome, nicho, posicionamento)
- Nível de maturidade digital: INICIANTE / INTERMEDIÁRIO / AVANÇADO (justifique)
- Potencial de crescimento estimado: BAIXO / MÉDIO / ALTO / EXPLOSIVO
- Ticket médio estimado do negócio
- 1 frase que resume a maior oportunidade

## 🔍 DIAGNÓSTICO COMPLETO

### Presença no Instagram
Analise com profundidade:
- Qualidade da bio (tem CTA? Tem proposta de valor clara? Tem link?)
- Frequência e consistência de postagens
- Qualidade visual (feed, stories, reels)
- Engajamento (curtidas, comentários, compartilhamentos)
- Uso de hashtags, geolocalização
- Estratégia de conteúdo (educativo, entretenimento, vendas - qual mix?)
- Presença de destaques organizados
- Se usa link na bio (Linktree, etc)

### Análise da Página/Site
${businessType === 'negocio-local' ? `
FOCO NEGÓCIO LOCAL:
- Google Meu Negócio está otimizado?
- Avaliações e reputação online
- Fotos profissionais do estabelecimento?
- Cardápio/catálogo online?
- Agendamento online disponível?
- Presença em apps de delivery/reserva?
- SEO local (aparece nas buscas locais?)
- WhatsApp Business configurado?
` : ''}
${businessType === 'infoproduto' ? `
FOCO INFOPRODUTO:
- Funil de vendas está completo? (topo, meio, fundo)
- Estrutura de lançamento (semente, interno, meteórico?)
- Qualidade da copy (headline, sub-headline, bullet points)
- Prova social (depoimentos, cases, números)
- Gatilhos mentais utilizados (escassez, urgência, autoridade, reciprocidade)
- Sequência de e-mails/WhatsApp existe?
- Conteúdo gratuito de valor para nutrir leads?
- Precificação e ancoragem de preço
- Garantia oferecida
` : ''}
${businessType === 'ecommerce' ? `
FOCO E-COMMERCE:
- Experiência de navegação e busca
- Fotos de produto (qualidade, ângulos, lifestyle)
- Descrições de produto (copy de vendas ou genérica?)
- Processo de checkout (fricção, abandono de carrinho)
- Política de frete e devoluções
- Remarketing e recuperação de carrinho
- Cross-sell e upsell implementados?
- Avaliações de produtos
` : ''}
${businessType === 'saas' ? `
FOCO SAAS:
- Proposta de valor clara em 5 segundos?
- Página de pricing transparente?
- Free trial ou freemium disponível?
- Onboarding do produto
- Comparação com concorrentes
- Cases de sucesso e métricas
- Blog/conteúdo educativo
- Documentação e suporte
` : ''}
${businessType === 'servicos' ? `
FOCO SERVIÇOS:
- Portfólio de trabalhos anteriores
- Cases com resultados mensuráveis
- Depoimentos de clientes reais
- Processo de trabalho explicado
- Diferenciação clara dos concorrentes
- Precificação ou estimativa disponível
- Blog/conteúdo que demonstre autoridade
- Certificações e credenciais
` : ''}

Analise a página segundo o tipo:
${pageType === 'vendas' ? `
PÁGINA DE VENDAS - Analise cada elemento:
- Headline: gera curiosidade? É específica?
- Sub-headline: complementa bem?
- Vídeo de vendas (VSL): tem? Qual duração ideal?
- Bullet points: são orientados a benefício ou feature?
- Prova social: quantidade e qualidade dos depoimentos
- Garantia: está clara e remove risco?
- Bônus: complementam a oferta?
- CTA: quantos existem? São claros?
- Urgência/escassez: está implementada?
- Objeções: são tratadas?
- Preço: ancoragem bem feita?
` : ''}
${pageType === 'captura' ? `
PÁGINA DE CAPTURA - Analise:
- Promessa principal: é irresistível?
- Lead magnet: qual tipo? (ebook, aula, planilha, quiz)
- Formulário: quantos campos? Está otimizado?
- Design: limpo e focado ou poluído?
- Velocidade de carregamento
- Mobile-first?
- Prova social acima do formulário?
- Contra-objeções presentes?
` : ''}

## 🎯 TOP 5 PROBLEMAS IDENTIFICADOS
Para cada problema:
1. **[Nome do Problema]**
   - ❌ O que está errado (com exemplos específicos)
   - 💡 Impacto no negócio (perda estimada de leads/vendas)
   - ✅ Solução detalhada passo a passo
   - 📊 Resultado esperado após implementação

## 🎬 ROTEIRO DE VÍDEO DE PROSPECÇÃO

### 🎙️ ABERTURA (0:00 - 0:15)
Fala sugerida palavra por palavra. Mencione o nome do prospect e algo específico que você notou.

### 🔍 DIAGNÓSTICO (0:15 - 1:00)
Fala sugerida mostrando que você REALMENTE estudou o negócio. Cite 3 pontos específicos com exemplos reais do perfil/página.

### 💡 SOLUÇÕES (1:00 - 1:45)
Para cada problema, dê uma solução concreta com resultado esperado. Use números quando possível.

### 📈 PROVA SOCIAL (1:45 - 2:00)
Mencione resultados alcançados com negócios SIMILARES (mesmo nicho/tipo). Seja específico com números.

### 🤝 CTA (2:00 - 2:15)
Convite claro, sem pressão, mas com senso de oportunidade. Sugira um horário específico.

## 📊 PLANO DE AÇÃO SUGERIDO (30-60-90 DIAS)

### Primeiros 30 dias (Quick Wins):
- 3 ações imediatas de alto impacto

### 60 dias (Estruturação):
- 3 ações de estruturação do marketing

### 90 dias (Escala):
- 3 ações de crescimento e escala

## 💰 ESTIMATIVA DE IMPACTO
- Aumento estimado de leads: X%
- Aumento estimado de conversão: X%
- Faturamento adicional estimado: R$ X.XXX/mês

REGRAS CRÍTICAS:
- NUNCA seja genérico. Cada análise deve parecer única.
- USE o nome do prospect quando disponível.
- CITE elementos específicos que você analisou (cores, textos, estrutura).
- DÊ números e percentuais sempre que possível.
- SEJA DIRETO e ACIONÁVEL - nada de "considere fazer X". Diga "FAÇA X porque Y".
- O tom deve ser de consultor premium, não de vendedor.
- Formate com markdown rico: negrito, listas, emojis, separadores.`;

    console.log("Sending request to AI gateway...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    console.log("AI gateway response status:", response.status);

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      
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
      return new Response(
        JSON.stringify({ error: `Erro ao processar análise (${response.status})` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("AI response received, choices:", data.choices?.length);
    
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
