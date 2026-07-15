# Painel de Planejamento

Criar uma nova aba **Planejamento** (visível apenas para admin) que permite configurar tudo que hoje é hardcoded, sem precisar mexer no back end.

## O que muda para o usuário

Nova aba no topo, ao lado de Comercial / Growth / Análise de Perfil, com 3 seções:

1. **Metas Mensais** — tabela editável de 12 meses com colunas: Vendas, 1ª Reuniões, 2ª Reuniões. Faturamento é calculado automaticamente (Vendas × Ticket).
2. **Parâmetros Globais**
   - Ticket médio (hoje fixo em R$ 2.700)
   - Taxa de comparecimento (hoje fixa em 60%)
3. **Equipe de SDRs** — lista de SDRs com botões para adicionar, renomear e remover. Ao mudar a equipe, as metas por SDR recalculam automaticamente em todo o dashboard.

Tudo salvo no banco. Qualquer mudança reflete em tempo real nos gráficos, funil, ritmo semanal e metas por SDR.

## Estrutura técnica

### Banco
- Nova tabela `planejamento_mensal` (month_index 0–11, meta_vendas, meta_primeira, meta_segunda) — pré-populada com os valores atuais.
- `app_settings` novos keys: `ticket_medio`, `taxa_comparecimento`.
- SDRs continuam em `app_settings.sdr_names` (já existe), mas com suporte a N SDRs em vez de fixo 3.

### Front
- Remover constantes `METAS_FIXAS`, `VALOR_POR_VENDA`, `TAXA_COMPARECIMENTO` de `src/types/dashboard.ts` — passam a vir de um hook `usePlanejamento()` que faz cache + realtime.
- `src/lib/sdrNames.ts` passa a suportar array dinâmico (não mais tupla fixa de 3).
- Componentes que usam essas constantes (`ChartsGrid`, `MetasSemanais`, `TaxasPorSdr`, `AgendamentosEditor`, `ReunioesEditor`, `useDashboardData`, `StatsOverview`, `FunnelOverview`) passam a ler do hook.
- Nova página `src/pages/Planejamento.tsx` + rota `/planejamento`.
- Novo componente `src/components/planejamento/*` com as 3 seções.

### Permissões
- Somente `is_authorized_editor()` pode escrever em `planejamento_mensal` e `app_settings`. Leitura liberada para todos autenticados (igual ao restante).

## Ordem de execução

1. Migração do banco (criar tabela + seeds + policies + grants).
2. Hook `usePlanejamento` com realtime.
3. Refatorar componentes para consumir o hook em vez das constantes.
4. Suporte a N SDRs em `sdrNames.ts` e nos editores.
5. Nova página + rota + link na navbar (só para admin).
6. UI das 3 seções com salvamento otimista.

Vou começar pela migração.
