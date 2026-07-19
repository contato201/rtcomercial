# Dashboard Comercial — Reproduzindo Talentos

Painel interno de acompanhamento comercial e growth: metas mensais, funil de vendas
(agendamentos → 1ª reunião → 2ª reunião → venda), faturamento por origem, desempenho
por SDR e tráfego pago (Meta Ads).

**No ar:** https://comercial.reproduzindotalentos.com.br

## Tecnologias

- **Vite** + **React** + **TypeScript**
- **Tailwind CSS** + **shadcn/ui**
- **Supabase** (banco de dados, autenticação e edge functions)
- **Cloudflare Pages** (hospedagem)
- **Meta Graph API** (dados de tráfego pago, sincronizados automaticamente)

## Páginas

| Rota | O que tem |
|------|-----------|
| `/` (Comercial) | Funil executivo, faturamento por origem, entrada de dados (vendas com origem, agendamentos, reuniões), metas semanais, taxas por SDR, gráficos |
| `/growth` | Funil de tráfego Meta Ads com filtro por período (calendário), nível (campanha/conjunto/anúncio) e texto "contém"; 9 KPIs (CPL, CPC, CPM, CTR, C/Agendamento, CAC, ROAS…); tabela dia a dia com agendamentos editáveis e CPA |
| `/planejamento` | Só admin. Funil reverso de metas: vendas × ticket → reuniões → agendamentos, com taxas de conversão editáveis e recálculo automático |

## Rodar localmente

Requisitos: [Node.js](https://nodejs.org) instalado.

```sh
npm install    # instalar dependências
npm run dev    # http://localhost:8080
```

## Build e publicação

```sh
npm run build      # gera a pasta dist/
npm run preview    # pré-visualiza o build localmente
npm run deploy     # builda e publica no Cloudflare Pages (projeto rtcomercial)
```

Se o wrangler pedir login: `npx wrangler login`.

## Configuração

As chaves públicas do Supabase ficam em `.env` (não versionado — copie de `.env.example`):
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.

## Sincronização com a Meta Ads

A edge function `supabase/functions/sync-meta` roda todo dia à 01:00 (pg_cron) e puxa
investimento, impressões, cliques e leads dos últimos 14 dias em 4 níveis (conta,
campanha, conjunto e anúncio) para as tabelas `growth_*_diario`. Aceita `?days=N`
(máx 90) para preencher histórico. Os segredos (`META_ACCESS_TOKEN`, `META_AD_ACCOUNT`,
`SYNC_SECRET`) ficam no cofre de secrets do Supabase — nunca no código.

## Regra de negócio importante

No funil de Growth, **Vendas, Faturamento, CAC e ROAS contam apenas as vendas marcadas
com origem "Tráfego pago (Meta)"** no dashboard comercial. Por isso é essencial escolher
a origem ao lançar cada venda (as origens estão em `src/lib/origens.ts`).
