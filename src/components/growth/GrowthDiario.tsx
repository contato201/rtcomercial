import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays } from "lucide-react";
import { GrowthDateRange, periodoPadrao, type Periodo } from "@/components/growth/GrowthDateRange";
import type { TrafegoRow } from "@/hooks/useTrafegoDiario";
import { ORIGEM_TRAFEGO_LEAD } from "@/components/dashboard/ReunioesEditor";

interface GrowthDia {
  id: string;
  data: string; // YYYY-MM-DD
  investimento: number;
  leads: number;
  impressoes: number;
  cliques: number;
  agendamentos: number;
}

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const custo = (invest: number, qtd: number) => (qtd > 0 ? brl(invest / qtd) : "—");

const pct = (num: number, den: number) => (den > 0 ? `${((num / den) * 100).toFixed(1)}%` : "—");

interface Props {
  filtro: string;
  trafegoRows: TrafegoRow[];
}

export const GrowthDiario = ({ filtro, trafegoRows }: Props) => {
  const [periodo, setPeriodo] = useState<Periodo>(periodoPadrao);
  const [rows, setRows] = useState<GrowthDia[]>([]);
  // Agendamentos de "Tráfego Pago" por dia (YYYY-MM-DD), vindos do dashboard Comercial
  const [agPorDia, setAgPorDia] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [diario, agendaRes] = await Promise.all([
      (supabase as any).from("growth_diario").select("*").order("data", { ascending: true }),
      (supabase as any).from("agendamentos").select("quantidade,data_lancamento,origem"),
    ]);
    if (!diario.error && Array.isArray(diario.data)) setRows(diario.data as GrowthDia[]);

    const mapa = new Map<string, number>();
    if (!agendaRes.error && Array.isArray(agendaRes.data)) {
      for (const a of agendaRes.data as any[]) {
        if (a.origem !== ORIGEM_TRAFEGO_LEAD) continue;
        const dia = String(a.data_lancamento ?? "").slice(0, 10);
        if (!dia) continue;
        mapa.set(dia, (mapa.get(dia) ?? 0) + (Number(a.quantidade) || 0));
      }
    }
    setAgPorDia(mapa);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtroAtivo = filtro.trim().length > 0;

  const mesRows = useMemo(() => {
    const ag = (dia: string) => agPorDia.get(dia) ?? 0;

    if (!filtroAtivo) {
      return rows
        .filter((r) => r.data >= periodo.from && r.data <= periodo.to)
        .map((r) => ({ ...r, agendamentos: ag(r.data) }));
    }

    // Filtro ativo: investimento/leads/cliques só das campanhas filtradas (dia a dia).
    // Agendou continua sendo o total de "Tráfego Pago" do dia (não dá pra separar por campanha).
    const f = filtro.trim().toUpperCase();
    const porDia = new Map<string, { investimento: number; leads: number; impressoes: number; cliques: number }>();
    for (const c of trafegoRows) {
      if (c.data < periodo.from || c.data > periodo.to) continue;
      if (!c.busca.includes(f)) continue;
      const acc = porDia.get(c.data) ?? { investimento: 0, leads: 0, impressoes: 0, cliques: 0 };
      acc.investimento += Number(c.investimento || 0);
      acc.leads += c.leads || 0;
      acc.impressoes += c.impressoes || 0;
      acc.cliques += c.cliques || 0;
      porDia.set(c.data, acc);
    }
    const diarioPorData = new Map(rows.map((r) => [r.data, r]));
    return [...porDia.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([data, m]) => ({
        id: diarioPorData.get(data)?.id ?? "",
        data,
        investimento: m.investimento,
        leads: m.leads,
        impressoes: m.impressoes,
        cliques: m.cliques,
        agendamentos: ag(data),
      } as GrowthDia));
  }, [rows, trafegoRows, agPorDia, periodo, filtro, filtroAtivo]);

  const tot = mesRows.reduce(
    (a, r) => ({
      inv: a.inv + Number(r.investimento || 0),
      leads: a.leads + (r.leads || 0),
      cliques: a.cliques + (r.cliques || 0),
      agend: a.agend + (r.agendamentos || 0),
    }),
    { inv: 0, leads: 0, cliques: 0, agend: 0 },
  );

  const diaFmt = (d: string) => {
    const dt = new Date(d + "T12:00:00");
    return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", weekday: "short" });
  };

  return (
    <div className="dashboard-card p-4 sm:p-6 border-2 border-primary/20">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <CalendarDays className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">📅 Growth Diário — Meta Ads</h3>
            <p className="text-xs text-muted-foreground">
              Tudo automático: investimento e leads vêm da Meta; os <strong>agendamentos</strong> vêm do que você lança como <strong>"Tráfego Pago"</strong> no dashboard comercial. O custo por agendamento sai sozinho.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:ml-auto">
          {filtroAtivo && (
            <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-primary bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
              Contém: “{filtro.trim().toUpperCase()}”
            </span>
          )}
          <GrowthDateRange value={periodo} onChange={setPeriodo} />
        </div>
      </div>
      {filtroAtivo && (
        <p className="text-xs text-muted-foreground -mt-2 mb-3">
          ⚠️ Com o filtro ativo, <strong>Investido, Leads e Cliques</strong> são só das campanhas filtradas. Já <strong>Agendou</strong> é o total de "Tráfego Pago" do dia (todas as campanhas) — a conversão e o CPA ficam aproximados.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p>
      ) : mesRows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Nenhum dado da Meta para este período ainda.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                <th className="text-left py-2 pr-3 font-semibold">Dia</th>
                <th className="text-right py-2 px-2 font-semibold" title="Investido na Meta">Investido</th>
                <th className="text-right py-2 px-2 font-semibold">Leads</th>
                <th className="text-right py-2 px-2 font-semibold" title="Custo por lead">C/ Lead</th>
                <th className="text-right py-2 px-2 font-semibold">Cliques</th>
                <th className="text-right py-2 px-2 font-semibold text-primary" title="Agendamentos de Tráfego Pago lançados no dashboard comercial">Agendou 🚀</th>
                <th className="text-right py-2 px-2 font-semibold" title="Taxa de conversão: Agendamentos ÷ Leads">Conv.</th>
                <th className="text-right py-2 pl-2 font-semibold text-[hsl(var(--success))]" title="Custo por agendamento = Investido ÷ Agendamentos">CPA</th>
              </tr>
            </thead>
            <tbody>
              {mesRows.map((r) => (
                <tr key={r.data} className="border-b border-border/40 hover:bg-accent/30">
                  <td className="py-2 pr-3 font-medium text-foreground whitespace-nowrap">{diaFmt(r.data)}</td>
                  <td className="text-right py-2 px-2">{brl(Number(r.investimento))}</td>
                  <td className="text-right py-2 px-2">{r.leads}</td>
                  <td className="text-right py-2 px-2 text-muted-foreground">{custo(Number(r.investimento), r.leads)}</td>
                  <td className="text-right py-2 px-2 text-muted-foreground">{r.cliques}</td>
                  <td className="text-right py-2 px-2 font-semibold text-primary">{r.agendamentos}</td>
                  <td className="text-right py-2 px-2 font-medium">{pct(r.agendamentos, r.leads)}</td>
                  <td className="text-right py-2 pl-2 font-semibold text-[hsl(var(--success))]">
                    {custo(Number(r.investimento), r.agendamentos)}
                  </td>
                </tr>
              ))}
              <tr className="bg-accent/40 font-bold">
                <td className="py-2 pr-3">Total do período</td>
                <td className="text-right py-2 px-2">{brl(tot.inv)}</td>
                <td className="text-right py-2 px-2">{tot.leads}</td>
                <td className="text-right py-2 px-2">{custo(tot.inv, tot.leads)}</td>
                <td className="text-right py-2 px-2">{tot.cliques}</td>
                <td className="text-right py-2 px-2 text-primary">{tot.agend}</td>
                <td className="text-right py-2 px-2">{pct(tot.agend, tot.leads)}</td>
                <td className="text-right py-2 pl-2 text-[hsl(var(--success))]">{custo(tot.inv, tot.agend)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-3">
        💡 O <strong>Agendou</strong> agora é automático — conforme a equipe lança os agendamentos com origem <strong>"Tráfego Pago"</strong> no dashboard comercial (com a data), eles aparecem aqui no dia certo. Não precisa mais digitar.
      </p>
    </div>
  );
};
