import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTrafegoDiario, NIVEIS, type NivelTrafego } from "@/hooks/useTrafegoDiario";
import { GrowthDateRange, periodoPadrao, type Periodo } from "@/components/growth/GrowthDateRange";
import { LayoutList, Search, ArrowUpDown, ArrowDown, ArrowUp, X } from "lucide-react";

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

const PREFIXO: Record<NivelTrafego, string> = { campanha: "CMP", conjunto: "CNJ", anuncio: "ANC" };
const COR_CHIP: Record<NivelTrafego, string> = {
  campanha: "border-[hsl(var(--gold))] text-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.1)]",
  conjunto: "border-violet-400 text-violet-300 bg-violet-400/10",
  anuncio: "border-sky-400 text-sky-300 bg-sky-400/10",
};

// "Gerenciador" — lista campanhas/conjuntos/anúncios da conta Meta com status e
// métricas do período. Seleção estilo Meta com DRILL-DOWN: marcar campanhas
// filtra as abas Conjuntos/Anúncios só para o que pertence a elas (e conjuntos
// filtram anúncios). As seleções viram etiquetas removíveis acima da tabela.
export const GerenciadorMeta = () => {
  const [periodo, setPeriodo] = useState<Periodo>(periodoPadrao);
  const [tipo, setTipo] = useState<NivelTrafego>("campanha");
  const [buscaTxt, setBuscaTxt] = useState("");
  const [soAtivas, setSoAtivas] = useState(false);
  const [comDados, setComDados] = useState(false);
  const [soSelecionadas, setSoSelecionadas] = useState(false);
  const [sel, setSel] = useState<Record<NivelTrafego, Set<string>>>({
    campanha: new Set(), conjunto: new Set(), anuncio: new Set(),
  });
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

  const entMap = useMemo(() => new Map(entidades.map((e) => [e.entity_id, e])), [entidades]);

  // Nomes das campanhas/conjuntos selecionados — usados pro drill-down por nome
  const campSelNomes = useMemo(
    () => new Set([...sel.campanha].map((id) => entMap.get(id)?.campaign_name ?? "").filter(Boolean)),
    [sel.campanha, entMap],
  );
  const conjSelNomes = useMemo(
    () => new Set([...sel.conjunto].map((id) => entMap.get(id)?.adset_name ?? "").filter(Boolean)),
    [sel.conjunto, entMap],
  );

  const trocarTipo = (n: NivelTrafego) => {
    setTipo(n);
    setSoSelecionadas(false);
  };

  // Campanha/conjunto "pai" de uma linha (pra aplicar o drill-down)
  const paisDaLinha = (l: Linha): { camp: string; conj: string } => {
    const e = entMap.get(l.id);
    if (e) return { camp: e.campaign_name, conj: e.adset_name };
    const partes = l.contexto.split(" · ");
    return { camp: partes[0] ?? "", conj: partes[1] ?? "" };
  };

  // Todas as linhas do tipo (métricas do período + status), antes dos filtros de exibição
  const todasLinhas = useMemo(() => {
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
    // Drill-down: conjuntos respeitam as campanhas marcadas; anúncios respeitam ambas
    if (tipo !== "campanha" && campSelNomes.size > 0) {
      lista = lista.filter((l) => campSelNomes.has(paisDaLinha(l).camp));
    }
    if (tipo === "anuncio" && conjSelNomes.size > 0) {
      lista = lista.filter((l) => conjSelNomes.has(paisDaLinha(l).conj));
    }
    return lista;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, entidades, tipo, periodo, campSelNomes, conjSelNomes, entMap]);

  // Linhas exibidas (filtros + ordenação)
  const linhas = useMemo(() => {
    let lista = todasLinhas;
    const f = buscaTxt.trim().toUpperCase();
    if (f) lista = lista.filter((l) => (l.nome + " " + l.contexto).toUpperCase().includes(f));
    if (soAtivas) lista = lista.filter((l) => l.status === "ACTIVE");
    if (comDados) lista = lista.filter((l) => l.impressoes > 0 || l.investimento > 0);
    if (soSelecionadas) lista = lista.filter((l) => sel[tipo].has(l.id));

    const valor = (l: Linha): number | string => {
      switch (sortCol) {
        case "nome": return l.nome.toUpperCase();
        case "cpl": return l.leads > 0 ? l.investimento / l.leads : Infinity;
        case "cpc": return l.cliques > 0 ? l.investimento / l.cliques : Infinity;
        case "ctr": return l.impressoes > 0 ? l.cliques / l.impressoes : -1;
        default: return l[sortCol];
      }
    };
    return [...lista].sort((a, b) => {
      const va = valor(a), vb = valor(b);
      const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return sortDesc ? -cmp : cmp;
    });
  }, [todasLinhas, buscaTxt, soAtivas, comDados, soSelecionadas, sel, tipo, sortCol, sortDesc]);

  // Resumo do que está selecionado NA ABA ATUAL (independe dos filtros de exibição)
  const selAgg = useMemo(() => {
    const marcadas = todasLinhas.filter((l) => sel[tipo].has(l.id));
    return marcadas.reduce(
      (a, l) => ({ n: a.n + 1, inv: a.inv + l.investimento, leads: a.leads + l.leads, imp: a.imp + l.impressoes, cli: a.cli + l.cliques }),
      { n: 0, inv: 0, leads: 0, imp: 0, cli: 0 },
    );
  }, [todasLinhas, sel, tipo]);

  // Subtotal do que está na tela
  const tot = useMemo(
    () => linhas.reduce(
      (a, l) => ({ inv: a.inv + l.investimento, leads: a.leads + l.leads, imp: a.imp + l.impressoes, cli: a.cli + l.cliques }),
      { inv: 0, leads: 0, imp: 0, cli: 0 },
    ),
    [linhas],
  );

  const mudarSel = (nivel: NivelTrafego, muda: (s: Set<string>) => void) => {
    setSel((prev) => {
      const next = { ...prev, [nivel]: new Set(prev[nivel]) };
      muda(next[nivel]);
      return next;
    });
  };

  const toggleLinha = (id: string) => mudarSel(tipo, (s) => (s.has(id) ? s.delete(id) : s.add(id)));

  const todasVisiveisMarcadas = linhas.length > 0 && linhas.every((l) => sel[tipo].has(l.id));
  const toggleTodas = () =>
    mudarSel(tipo, (s) => (todasVisiveisMarcadas ? linhas.forEach((l) => s.delete(l.id)) : linhas.forEach((l) => s.add(l.id))));

  const limparTudo = () => {
    setSel({ campanha: new Set(), conjunto: new Set(), anuncio: new Set() });
    setSoSelecionadas(false);
  };

  const chips = useMemo(() => {
    const out: { nivel: NivelTrafego; id: string; nome: string }[] = [];
    for (const nivel of ["campanha", "conjunto", "anuncio"] as NivelTrafego[]) {
      for (const id of sel[nivel]) {
        out.push({ nivel, id, nome: entMap.get(id)?.nome || id });
      }
    }
    return out;
  }, [sel, entMap]);

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

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center lg:ml-auto flex-wrap">
          <GrowthDateRange value={periodo} onChange={setPeriodo} />
          <div className="flex rounded-lg border border-border/60 bg-muted/20 p-0.5">
            {NIVEIS.map((n) => (
              <button
                key={n.value}
                type="button"
                onClick={() => trocarTipo(n.value)}
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
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={comDados} onChange={(e) => setComDados(e.target.checked)} className="accent-[hsl(var(--gold))]" />
            Com impressões
          </label>
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={buscaTxt} onChange={(e) => setBuscaTxt(e.target.value)} placeholder="Buscar por nome..." className="pl-8" />
          </div>
        </div>
      </div>

      {/* Etiquetas do que está selecionado (drill-down) — CMP filtra conjuntos/anúncios, CNJ filtra anúncios */}
      {chips.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <span
              key={c.id}
              className={`inline-flex max-w-[340px] items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${COR_CHIP[c.nivel]}`}
              title={c.nome}
            >
              <span className="opacity-70">{PREFIXO[c.nivel]}</span>
              <span className="truncate">{c.nome}</span>
              <button
                type="button"
                onClick={() => mudarSel(c.nivel, (s) => s.delete(c.id))}
                className="ml-0.5 rounded-full hover:bg-foreground/20 p-0.5"
                title="Remover"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button type="button" onClick={limparTudo} className="text-[11px] text-muted-foreground hover:text-foreground underline ml-1">
            limpar tudo
          </button>
        </div>
      )}

      {/* Barra da seleção — números só do que está marcado nesta aba */}
      {selAgg.n > 0 && (
        <div className="mb-4 rounded-lg border-2 border-primary bg-primary/10 p-3 flex flex-col lg:flex-row lg:items-center gap-2">
          <span className="text-sm font-bold text-primary whitespace-nowrap">✓ {selAgg.n} selecionada(s)</span>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground lg:ml-3">
            <span><strong>Investido:</strong> {brl(selAgg.inv)}</span>
            <span><strong>Leads:</strong> {num(selAgg.leads)}</span>
            <span><strong>CPL:</strong> {selAgg.leads > 0 ? brl(selAgg.inv / selAgg.leads) : "—"}</span>
            <span><strong>Cliques:</strong> {num(selAgg.cli)}</span>
            <span><strong>CPC:</strong> {selAgg.cli > 0 ? brl(selAgg.inv / selAgg.cli) : "—"}</span>
            <span><strong>CTR:</strong> {selAgg.imp > 0 ? `${((selAgg.cli / selAgg.imp) * 100).toFixed(2)}%` : "—"}</span>
            <span><strong>Impressões:</strong> {num(selAgg.imp)}</span>
          </div>
          <div className="flex gap-2 lg:ml-auto">
            <Button
              type="button"
              size="sm"
              variant={soSelecionadas ? "default" : "outline"}
              onClick={() => setSoSelecionadas(!soSelecionadas)}
            >
              {soSelecionadas ? "Ver todas" : "Ver só selecionadas"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={limparTudo}>
              <X className="w-3.5 h-3.5 mr-1" />
              Limpar
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p>
      ) : linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Nada encontrado com esses filtros.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                <th className="py-2 pl-1 pr-2 w-8">
                  <input
                    type="checkbox"
                    checked={todasVisiveisMarcadas}
                    onChange={toggleTodas}
                    className="accent-[hsl(var(--gold))] cursor-pointer"
                    title="Marcar/desmarcar todas as visíveis"
                  />
                </th>
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
                const marcada = sel[tipo].has(l.id);
                return (
                  <tr
                    key={l.id}
                    className={`border-b border-border/40 cursor-pointer ${marcada ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-accent/30"}`}
                    onClick={() => toggleLinha(l.id)}
                  >
                    <td className="py-2 pl-1 pr-2">
                      <input
                        type="checkbox"
                        checked={marcada}
                        onChange={() => toggleLinha(l.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="accent-[hsl(var(--gold))] cursor-pointer"
                      />
                    </td>
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
                <td className="py-2 pl-1 pr-2" />
                <td className="py-2 px-2">Subtotal ({linhas.length})</td>
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
        ✓ Marque campanhas e troque pra aba <strong>Conjuntos</strong>/<strong>Anúncios</strong>: só aparece o que pertence a elas (as etiquetas em cima mostram o filtro — X remove). No <strong>Subtotal</strong>, CPL, CPC e CTR já são a média ponderada do que está na tela. 🟢 Ativa · ⚪ Pausada — status atualiza na sincronização diária (01:00).
      </p>
    </div>
  );
};
