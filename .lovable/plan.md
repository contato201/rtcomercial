
# Plano de Correção: Erro de Porcentagem de Metas na Versão Publicada

## Diagnóstico do Problema

O erro identificado está relacionado a **cálculos de porcentagem que resultam em `NaN` (Not a Number) ou `Infinity`** quando as metas são zero ou os valores realizados são manipulados. Isso causa:

- Barras de progresso piscando entre cores
- Valores de porcentagem exibindo "NaN%" ou comportamento instável
- Re-renderizações rápidas nos gráficos

### Pontos Problemáticos Identificados

| Arquivo | Linha | Problema |
|---------|-------|----------|
| `StatCard.tsx` | 60 | `(realizado / meta) * 100` sem verificacao de meta = 0 |
| `DataEntryForm.tsx` | 314 | `(currentData.realizadoVendas / currentData.metaVendas) * 100` sem protecao |
| `DataEntryForm.tsx` | 401 | `(currentData.realizadoFaturamento / currentData.metaFaturamento) * 100` sem protecao |

---

## Solucao Proposta

### 1. Criar Funcao Utilitaria Centralizada

Adicionar uma funcao segura de calculo de porcentagem em `src/lib/formatters.ts`:

```typescript
export const safePercentage = (realizado: number, meta: number): number => {
  if (!meta || meta === 0) return 0;
  if (!Number.isFinite(realizado)) return 0;
  const result = (realizado / meta) * 100;
  return Number.isFinite(result) ? result : 0;
};
```

### 2. Corrigir StatCard.tsx

Atualizar linha 60 para usar verificacao segura:

```typescript
// Antes
style={{ width: `${Math.min((realizado / meta) * 100, 100) || 0}%` }}

// Depois  
style={{ width: `${meta > 0 ? Math.min((realizado / meta) * 100, 100) : 0}%` }}
```

### 3. Corrigir DataEntryForm.tsx

Atualizar linhas 314 e 401 para incluir verificacoes de seguranca:

```typescript
// Linha 314 - Vendas
style={{ width: `${currentData.metaVendas > 0 ? Math.min((currentData.realizadoVendas / currentData.metaVendas) * 100, 100) : 0}%` }}

// Linha 401 - Faturamento
style={{ width: `${currentData.metaFaturamento > 0 ? Math.min((currentData.realizadoFaturamento / currentData.metaFaturamento) * 100, 100) : 0}%` }}
```

### 4. Garantir Consistencia nos Textos de Porcentagem

Os textos de porcentagem nas linhas 318-320 e 405-407 ja possuem verificacao, mas podemos melhorar usando a funcao centralizada.

---

## Arquivos a Modificar

1. **`src/lib/formatters.ts`** - Adicionar funcao `safePercentage`
2. **`src/components/dashboard/StatCard.tsx`** - Corrigir calculo de largura da barra (linha 60)
3. **`src/components/dashboard/DataEntryForm.tsx`** - Corrigir calculos de barras de progresso (linhas 314, 401)

---

## Beneficios

- Elimina erros de `NaN` e `Infinity` nos calculos
- Barras de progresso exibem 0% quando nao ha meta definida
- Comportamento consistente em toda a aplicacao
- Codigo mais seguro e defensivo

---

## Detalhes Tecnicos

A causa raiz e a operacao de divisao sem verificacao previa:

```text
realizado = 0, meta = 0:
  (0 / 0) * 100 = NaN

realizado = 1, meta = 0:
  (1 / 0) * 100 = Infinity
```

Ambos os casos causam comportamento inesperado no CSS `width`, resultando em animacoes erraticas e flicker visual.
