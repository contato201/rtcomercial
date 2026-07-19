import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { useTrafegoDiario, NIVEIS, type NivelTrafego } from "@/hooks/useTrafegoDiario";
import type { Periodo } from "@/components/growth/GrowthDateRange";
import { LayoutList, Search, ArrowUpDown, ArrowDown, ArrowUp } from "lucide-react";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const num = (v: number) => new Intl.NumberFormat("pt-BR").format(Math.round(v || 0));

interface Entidade {
  entity_id: string;
  tipo: string;
  nome: string;
  status: string;
  campaign_name: string;
  adset_name: string;
}

interface Linha {
  id: string;
  nome: string;
  contexto: string;
  status: string;
  investimento: number;
  leads: number;
  impressoes: number;
  cliques: number;
}

type Coluna = "nome" | "investimento" | "leads" | "cpl" | "cliques" | "cpc" | "ctr" | "impressoes";

// Traduz o status técnico da Meta pra algo legível
const statusInfo = (s: string): { label: string; cor: string } => {
  if (s === "ACTIVE") return { label: "Ativa", cor: "bg-[hsl(var(--success))]" };
  if (s.includes("PAUSED")) return { label: "Pausada", cor: "bg-muted-foreground/50" };
  if (s === "WITH_ISSUES") return { label: "Com problema", cor: "bg-destructive" };
  if (s === "ARCHIVED" || s === "DELETED") return { label: "Arquivada", cor: "bg-muted-foreground/30" };
  if (!s) return { label: "—", cor: "bg-muted-foreground/30" };
  return { label: s, cor: "bg-muted-foreground/50" };
};

interface Props {
  periodo: Periodo;
}

// "Gerenciador" — lista todas as campanhas/conjuntos/anúncios da conta Meta com
// nome, status (ativa/pausada) e métricas do período. Independente do funil.
export const GerenciadorMeta = ({ periodo }: Props) => {
  const [tipo, setTipo] = useState<NivelTrafego>("campanha");
  const [buscaTxt, setBuscaTxt] = useState("");
  const [soAtivas, setSoAtivas] = useState(false);
  const [sortCol, setSortCol] = useState<Coluna>("investimento");
  const [sortDesc, setSortDesc] = useState(true);
  const [entidades, setEntidades] = useState<Entidade[]>([]);
  const { rows, loading } = useTrafegoDiario(tipo);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("meta_entidades")
        .select("entity_id,tipo,nome,status,campaign_name,adset_name");
      setEntidades(Array.isArray(data) ? data : []);
    })();
  }, []);

  const linhas = useMemo(() => {
    // métricas do período agregadas por entidade
    const porEntidade = new Map<string, Linha>();
    for (const r of rows) {
      if (r.data < periodo.from || r.data > periodo.to) continue;
      const acc = porEntidade.get(r.entityId) ?? {
        id: r.entityId, nome: r.nome, contexto: r.contexto, status: "",
        investimento: 0, leads: 0, impressoes: 0, cliques: 0,
      };
      acc.investimento += r.investimento;
      acc.leads += r.leads;
      acc.impressoes += r.impressoes;
      acc.cliques += r.cliques;
      porEntidade.set(r.entityId, acc);
    }
    // junta com a lista de entidades (traz status e inclui ativas sem gasto no período)
    for (const e of entidades) {
      if (e.tipo !== tipo) continue;
      const atual = porEntidade.get(e.entity_id);
      if (atual) {
        atual.status = e.status;
        if (!atual.nome) atual.nome = e.nome;
      } else if (e.status === "ACTIVE") {
        const contexto = tipo === "campanha" ? "" : tipo === "conjunto" ? e.campaign_name : [e.campaign_name, e.adset_name].filter(Boolean).join(" · ");
        porEntidade.set(e.entity_id, {
          id: e.entity_id, nome: e.nome, contexto, status: e.status,
          investimento: 0, leads: 0, impressoes: 0, cliques: 0,
        });
      }
    }
    let lista = [...porEntidade.values()];
    const f = buscaTxt.trim().toUpperCase();
    if (f) lista = lista.filter((l) => (l.nome + " " + l.contexto).toUpperCase().includes(f));
    if (soAtivas) lista = lista.filter((l) => l.status === "ACTIVE");

    const valor = (l: Linha): number | string => {
      switch (sortCol) {
        case "nome": return l.nome.toUpperCase();
        case "cpl": return l.leads > 0 ? l.investimento / l.leads : Infinity;
        case "cpc": return l.cliques > 0 ? l.investimento / l.cliques : Infinity;
        case "ctr": return l.impressoes > 0 ? l.cliques / l.impressoes : -1;
        default: return l[sortCol];
      }
    };
    lista.sort((a, b) => {
      const va = valor(a), vb = valor(b);
      const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return sortDesc ? -cmp : cmp;
    });
    return lista;
  }, [rows, entidades, tipo, periodo, buscaTxt, soAtivas, sortCol, sortDesc]);

  const tot = useMemo(
    () => linhas.reduce(
      (a, l) => ({ inv: a.inv + l.investimento, leads: a.leads + l.leads, imp: a.imp + l.impressoes, cli: a.cli + l.cliques }),
      { inv: 0, leads: 0, imp: 0, cli: 0 },
    ),
    [linhas],
  );

  const ordenar = (c: Coluna) => {
    if (sortCol === c) setSortDesc(!sortDesc);
    else { setSortCol(c); setSortDesc(c !== "nome"); }
  };

  const Th = ({ col, children, right = true }: { col: Coluna; children: React.ReactNode; right?: boolean }) => (
    <th
      className={`py-2 px-2 font-semibold cursor-pointer select-none hover:text-foreground whitespace-nowrap ${right ? "text-right" : "text-left"}`}
      onClick={() => ordenar(col)}
      title="Clique para ordenar"
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortCol === col ? (sortDesc ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
      </span>
    </th>
  );

  const cpl = (l: { investimento: number; leads: number }) => (l.leads > 0 ? brl(l.investimento / l.leads) : "—");
  const cpc = (l: { investimento: number; cliques: number }) => (l.cliques > 0 ? brl(l.investimento / l.cliques) : "—");
  const ctr = (l: { cliques: number; impressoes: number }) => (l.impressoes > 0 ? `${((l.cliques / l.impressoes) * 100).toFixed(2)}%` : "—");

  return (
    <div className="dashboard-card p-4 sm:p-6 border-2 border-primary/20 mt-4 md:mt-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <LayoutList className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">📋 Gerenciador — Meta Ads</h3>
            <p className="text-xs text-muted-foreground">
              Todas as suas {NIVEIS.find((n) => n.value === tipo)?.plural} com status e números do período
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center lg:ml-auto">
          <div className="flex rounded-lg border border-border/60 bg-muted/20 p-0.5">
            {NIVEIS.map((n) => (
              <button
                key={n.value}
                type="button"
                onClick={() => setTipo(n.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  tipo === n.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {n.label}s
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={soAtivas} onChange={(e) => setSoAtivas(e.target.checked)} className="accent-[hsl(var(--gold))]" />
            Só ativas
          </label>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={buscaTxt} onChange={(e) => setBuscaTxt(e.target.value)} placeholder="Buscar por nome..." className="pl-8" />
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p>
      ) : linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Nada encontrado com esses filtros.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                <Th col="nome" right={false}>Nome</Th>
                <th className="py-2 px-2 font-semibold text-left">Status</th>
                <Th col="investimento">Investido</Th>
                <Th col="leads">Leads</Th>
                <Th col="cpl">CPL</Th>
                <Th col="cliques">Cliques</Th>
                <Th col="cpc">CPC</Th>
                <Th col="ctr">CTR</Th>
                <Th col="impressoes">Impressões</Th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const st = statusInfo(l.status);
                return (
                  <tr key={l.id} className="border-b border-border/40 hover:bg-accent/30">
                    <td className="py-2 px-2 max-w-[380px]">
                      <p className="font-medium text-foreground truncate" title={l.nome}>{l.nome}</p>
                      {l.contexto && <p className="text-[11px] text-muted-foreground truncate" title={l.contexto}>{l.contexto}</p>}
                    </td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className={`w-2 h-2 rounded-full ${st.cor}`} />
                        {st.label}
                      </span>
                    </td>
                    <td className="text-right py-2 px-2 font-medium">{brl(l.investimento)}</td>
                    <td className="text-right py-2 px-2">{num(l.leads)}</td>
                    <td className="text-right py-2 px-2 text-muted-foreground">{cpl(l)}</td>
                    <td className="text-right py-2 px-2 text-muted-foreground">{num(l.cliques)}</td>
                    <td className="text-right py-2 px-2 text-muted-foreground">{cpc(l)}</td>
                    <td className="text-right py-2 px-2 text-muted-foreground">{ctr(l)}</td>
                    <td className="text-right py-2 px-2 text-muted-foreground">{num(l.impressoes)}</td>
                  </tr>
                );
              })}
              <tr className="bg-accent/40 font-bold">
                <td className="py-2 px-2">Total ({linhas.length})</td>
                <td className="py-2 px-2" />
                <td className="text-right py-2 px-2">{brl(tot.inv)}</td>
                <td className="text-right py-2 px-2">{num(tot.leads)}</td>
                <td className="text-right py-2 px-2">{tot.leads > 0 ? brl(tot.inv / tot.leads) : "—"}</td>
                <td className="text-right py-2 px-2">{num(tot.cli)}</td>
                <td className="text-right py-2 px-2">{tot.cli > 0 ? brl(tot.inv / tot.cli) : "—"}</td>
                <td className="text-right py-2 px-2">{tot.imp > 0 ? `${((tot.cli / tot.imp) * 100).toFixed(2)}%` : "—"}</td>
                <td className="text-right py-2 px-2">{num(tot.imp)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-3">
        🟢 Ativa · ⚪ Pausada — status vem da Meta e atualiza na sincronização diária (01:00). Números respeitam o período escolhido no topo. Campanhas ativas sem gasto no período também aparecem.
      </p>
    </div>
  );
};
