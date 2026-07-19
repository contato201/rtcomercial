import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { isTrafego } from "@/lib/origens";
import { GrowthDateRange, periodoPadrao, type Periodo } from "@/components/growth/GrowthDateRange";
import type { TrafegoRow } from "@/hooks/useTrafegoDiario";
import { Filter, Megaphone, MousePointerClick, Users, CalendarCheck, DollarSign, Eye, X } from "lucide-react";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const num = (v: number) => new Intl.NumberFormat("pt-BR").format(Math.round(v || 0));
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : "—");
const custo = (inv: number, q: number) => (q > 0 ? brl(inv / q) : "—");

// data local (YYYY-MM-DD) de um timestamp — pra comparar com o período no fuso do usuário
const localYmd = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const noPeriodo = (dataStr: string, p: Periodo) => dataStr >= p.from && dataStr <= p.to;

interface Props {
  filtro: string;
  onFiltroChange: (v: string) => void;
  rows: TrafegoRow[];
  rowsLoading: boolean;
}

export const GrowthFunnelMeta = ({ filtro, onFiltroChange, rows, rowsLoading }: Props) => {
  const [periodo, setPeriodo] = useState<Periodo>(periodoPadrao);
  const [com, setCom] = useState({ reunioes: 0, vendas: 0, faturamento: 0 });

  // Dados comerciais no período: reuniões (agendamentos por data_lancamento),
  // vendas + faturamento (vendas_unitarias de ORIGEM TRÁFEGO, por created_at).
  useEffect(() => {
    (async () => {
      const [ag, vd] = await Promise.all([
        (supabase as any).from("agendamentos").select("quantidade,data_lancamento"),
        (supabase as any).from("vendas_unitarias").select("valor,origem,created_at"),
      ]);
      const reunioes = (ag.data || [])
        .filter((r: any) => noPeriodo(String(r.data_lancamento ?? "").slice(0, 10), periodo))
        .reduce((s: number, r: any) => s + (r.quantidade || 0), 0);
      const vendasTrafego = (vd.data || []).filter(
        (r: any) => isTrafego(r.origem) && noPeriodo(localYmd(r.created_at), periodo),
      );
      const vendas = vendasTrafego.length;
      const faturamento = vendasTrafego.reduce((s: number, r: any) => s + Number(r.valor || 0), 0);
      setCom({ reunioes, vendas, faturamento });
    })();
  }, [periodo]);

  const periodoRows = useMemo(() => rows.filter((r) => noPeriodo(r.data, periodo)), [rows, periodo]);

  const agg = useMemo(() => {
    const f = filtro.trim().toUpperCase();
    const sel = periodoRows.filter((r) => !f || r.busca.includes(f));
    return sel.reduce(
      (a, r) => ({
        inv: a.inv + Number(r.investimento || 0),
        imp: a.imp + (r.impressoes || 0),
        cli: a.cli + (r.cliques || 0),
        leads: a.leads + (r.leads || 0),
        campanhas: a.campanhas.add(r.nome),
      }),
      { inv: 0, imp: 0, cli: 0, leads: 0, campanhas: new Set<string>() },
    );
  }, [periodoRows, filtro]);

  const roas = agg.inv > 0 ? com.faturamento / agg.inv : 0;
  const cpm = agg.imp > 0 ? agg.inv / (agg.imp / 1000) : 0;
  const ctr = agg.imp > 0 ? (agg.cli / agg.imp) * 100 : 0;

  const kpis = [
    { label: "Investido", valor: brl(agg.inv), cor: "text-foreground", destaque: false },
    { label: "Leads", valor: num(agg.leads), cor: "text-foreground", destaque: false },
    { label: "CPL (custo/lead)", valor: custo(agg.inv, agg.leads), cor: "text-foreground", destaque: false },
    { label: "CPC (custo/clique)", valor: custo(agg.inv, agg.cli), cor: "text-foreground", destaque: false },
    { label: "CPM (custo/mil)", valor: agg.imp > 0 ? brl(cpm) : "—", cor: "text-foreground", destaque: false },
    { label: "CTR (cliques/impr.)", valor: agg.imp > 0 ? `${ctr.toFixed(2)}%` : "—", cor: "text-foreground", destaque: false },
    { label: "C/ Agendamento", valor: custo(agg.inv, com.reunioes), cor: "text-foreground", destaque: true },
    { label: "CAC (custo/venda)", valor: custo(agg.inv, com.vendas), cor: "text-foreground", destaque: true },
    { label: "ROAS (retorno)", valor: agg.inv > 0 && com.faturamento > 0 ? `${roas.toFixed(2)}x` : "—", cor: roas >= 1 ? "text-[hsl(var(--success))]" : "text-foreground", destaque: true },
  ];

  const funil = [
    { label: "Impressões", valor: agg.imp, icon: Eye, conv: null as string | null, meta: true },
    { label: "Cliques", valor: agg.cli, icon: MousePointerClick, conv: pct(agg.cli, agg.imp), meta: true },
    { label: "Leads", valor: agg.leads, icon: Users, conv: pct(agg.leads, agg.cli), meta: true },
    { label: "Reuniões marcadas", valor: com.reunioes, icon: CalendarCheck, conv: pct(com.reunioes, agg.leads), meta: false },
    { label: "Vendas (tráfego)", valor: com.vendas, icon: DollarSign, conv: pct(com.vendas, com.reunioes), meta: false },
  ];
  const maxVal = Math.max(agg.imp, 1);

  return (
    <div className="dashboard-card p-4 sm:p-6 border-2 border-primary/20 mb-4 md:mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Megaphone className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">🚀 Funil de Growth — Meta Ads</h3>
            <p className="text-xs text-muted-foreground">
              {agg.campanhas.size} campanha(s){filtro.trim() ? ` com "${filtro.trim()}"` : ' — todas'}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <GrowthDateRange value={periodo} onChange={setPeriodo} />
          <div className="relative w-full sm:w-64">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={filtro}
              onChange={(e) => onFiltroChange(e.target.value)}
              placeholder="Filtrar campanha (ex: DIAGNOSTICO)"
              className={`pl-8 ${filtro.trim() ? 'border-primary ring-1 ring-primary/40' : ''}`}
            />
          </div>
        </div>
      </div>

      {/* Etiqueta do filtro ativo — fica fixa até remover no X */}
      {filtro.trim() && (
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center gap-2 rounded-full border-2 border-primary bg-primary/15 px-4 py-1.5 text-sm font-bold text-primary">
            <Filter className="w-4 h-4" />
            Contém: “{filtro.trim().toUpperCase()}”
            <button
              type="button"
              onClick={() => onFiltroChange("")}
              title="Remover filtro e mostrar todas as campanhas"
              className="ml-1 rounded-full bg-primary/20 p-0.5 hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            filtrando funil + dia a dia · clique no X pra ver todas
          </span>
        </div>
      )}

      {rowsLoading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mb-6">
            {kpis.map((k) => (
              <div
                key={k.label}
                className={`rounded-lg border p-3 ${k.destaque ? 'border-[hsl(var(--gold)/0.5)] bg-[hsl(var(--gold)/0.08)]' : 'border-border/60 bg-muted/20'}`}
              >
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</p>
                <p className={`text-base sm:text-lg font-bold mt-1 ${k.cor}`}>{k.valor}</p>
              </div>
            ))}
          </div>

          {/* Funil */}
          <div className="space-y-2">
            {funil.map((etapa) => {
              const width = Math.max(6, (etapa.valor / maxVal) * 100);
              return (
                <div key={etapa.label} className="flex items-center gap-3">
                  <div className="w-40 sm:w-48 flex items-center gap-2 shrink-0">
                    <etapa.icon className={`w-4 h-4 ${etapa.meta ? 'text-primary' : 'text-[hsl(var(--gold))]'}`} />
                    <span className="text-sm font-medium text-foreground">{etapa.label}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="relative h-8 rounded-md bg-muted/30 overflow-hidden">
                      <div
                        className={`h-full ${etapa.meta ? 'bg-primary/70' : 'bg-[hsl(var(--gold))]/60'} transition-all`}
                        style={{ width: `${width}%` }}
                      />
                      <span className="absolute inset-y-0 left-3 flex items-center text-sm font-bold text-foreground">
                        {num(etapa.valor)}
                      </span>
                    </div>
                  </div>
                  <div className="w-16 text-right shrink-0">
                    {etapa.conv && <span className="text-xs text-muted-foreground">{etapa.conv}</span>}
                  </div>
                </div>
              );
            })}
            {/* Faturamento */}
            <div className="flex items-center gap-3 pt-2 mt-2 border-t border-border/60">
              <div className="w-40 sm:w-48 flex items-center gap-2 shrink-0">
                <DollarSign className="w-4 h-4 text-[hsl(var(--success))]" />
                <span className="text-sm font-semibold text-foreground">Faturamento (tráfego)</span>
              </div>
              <div className="flex-1 text-left">
                <span className="text-lg font-bold text-[hsl(var(--success))]">{brl(com.faturamento)}</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            🔵 <strong>Impressões, Cliques, Leads</strong> vêm da Meta (filtráveis por campanha). 🟡 <strong>Reuniões</strong> são os agendamentos do período. 💰 <strong>Vendas e Faturamento</strong> contam apenas as vendas marcadas como <strong>origem "Tráfego pago"</strong> no período (lançadas no dashboard comercial).
          </p>
        </>
      )}
    </div>
  );
};
