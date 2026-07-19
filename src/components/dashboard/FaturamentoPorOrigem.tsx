import { useMemo } from "react";
import { Coins } from "lucide-react";
import { ORIGENS_VENDA, isTrafego } from "@/lib/origens";
import type { UnitSale } from "@/components/dashboard/UnitSalesEditor";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

interface Props {
  sales: UnitSale[];
  periodLabel: string;
}

// Quebra o faturamento do período por origem da venda (tráfego, indicação,
// outbound, orgânico e sem origem) — visão executiva no topo do dashboard.
export const FaturamentoPorOrigem = ({ sales, periodLabel }: Props) => {
  const resumo = useMemo(() => {
    const porOrigem = new Map<string, { valor: number; qtd: number }>();
    let total = 0;
    for (const s of sales) {
      const key = s.origem || "sem-origem";
      const acc = porOrigem.get(key) ?? { valor: 0, qtd: 0 };
      acc.valor += Number(s.valor || 0);
      acc.qtd += 1;
      porOrigem.set(key, acc);
      total += Number(s.valor || 0);
    }
    return { porOrigem, total };
  }, [sales]);

  const linhas = [
    ...ORIGENS_VENDA.map((o) => ({
      key: o.value,
      label: o.label,
      trafego: isTrafego(o.value),
      ...(resumo.porOrigem.get(o.value) ?? { valor: 0, qtd: 0 }),
    })),
    { key: "sem-origem", label: "Sem origem", trafego: false, ...(resumo.porOrigem.get("sem-origem") ?? { valor: 0, qtd: 0 }) },
  ];

  const pct = (v: number) => (resumo.total > 0 ? `${((v / resumo.total) * 100).toFixed(0)}%` : "0%");

  return (
    <div className="dashboard-card mb-8 border-2 border-[hsl(var(--gold)/0.25)] p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className="rounded-lg bg-[hsl(var(--gold)/0.12)] p-2">
          <Coins className="h-5 w-5 text-[hsl(var(--gold))]" />
        </div>
        <div>
          <h3 className="font-bold text-foreground">💰 Faturamento por origem</h3>
          <p className="text-xs text-muted-foreground">
            {periodLabel} · Total: <strong className="text-foreground">{brl(resumo.total)}</strong> ({sales.length} venda{sales.length === 1 ? "" : "s"})
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
        {linhas.map((l) => (
          <div
            key={l.key}
            className={`rounded-lg border p-3 ${
              l.trafego
                ? "border-primary/50 bg-primary/10"
                : l.key === "sem-origem" && l.qtd > 0
                  ? "border-dashed border-[hsl(var(--warning,45_90%_50%)/0.6)] bg-muted/20"
                  : "border-border/60 bg-muted/20"
            }`}
          >
            <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground" title={l.label}>
              {l.trafego ? "🚀 " : ""}{l.label}
            </p>
            <p className="mt-1 text-base font-bold text-foreground sm:text-lg">{brl(l.valor)}</p>
            <p className="text-[11px] text-muted-foreground">
              {l.qtd} venda{l.qtd === 1 ? "" : "s"} · {pct(l.valor)}
            </p>
          </div>
        ))}
      </div>

      {(resumo.porOrigem.get("sem-origem")?.qtd ?? 0) > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          ⚠️ Há vendas <strong>sem origem</strong> — marque a origem delas lá no cadastro de vendas (botão Editar) pra este painel e o ROAS do Growth ficarem exatos.
        </p>
      )}
    </div>
  );
};
