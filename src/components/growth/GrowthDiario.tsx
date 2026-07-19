import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { CalendarDays, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import type { Periodo } from "@/components/growth/GrowthDateRange";
import type { TrafegoRow } from "@/hooks/useTrafegoDiario";

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
  periodo: Periodo;
  canEdit: boolean;
  filtro: string;
  trafegoRows: TrafegoRow[];
}

export const GrowthDiario = ({ periodo, canEdit, filtro, trafegoRows }: Props) => {
  const [rows, setRows] = useState<GrowthDia[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("growth_diario")
      .select("*")
      .order("data", { ascending: true });
    if (!error && Array.isArray(data)) setRows(data as GrowthDia[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtroAtivo = filtro.trim().length > 0;

  const mesRows = useMemo(() => {
    const noPeriodo = rows.filter((r) => r.data >= periodo.from && r.data <= periodo.to);
    if (!filtroAtivo) return noPeriodo;

    // Filtro ativo: soma os números da Meta (investimento/leads/cliques) só das
    // linhas do nível selecionado (campanha/conjunto/anúncio) que contêm o
    // texto, dia a dia. Os agendamentos digitados continuam vindo do dia inteiro.
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
    const diarioPorData = new Map(noPeriodo.map((r) => [r.data, r]));
    return [...porDia.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([data, m]) => {
        const base = diarioPorData.get(data);
        return {
          id: base?.id ?? "",
          data,
          investimento: m.investimento,
          leads: m.leads,
          impressoes: m.impressoes,
          cliques: m.cliques,
          agendamentos: base?.agendamentos ?? 0,
        } as GrowthDia;
      });
  }, [rows, trafegoRows, periodo, filtro, filtroAtivo]);

  const saveAgendamentos = async (r: GrowthDia, valor: string) => {
    if (!r.id) return; // dia sem registro base — não dá pra salvar
    const num = Math.max(0, parseInt(valor || "0", 10) || 0);
    if (num === r.agendamentos) return;
    setSavingId(r.id);
    const { error } = await (supabase as any)
      .from("growth_diario")
      .update({ agendamentos: num })
      .eq("id", r.id);
    setSavingId(null);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, agendamentos: num } : x)));
  };

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
              Investimento e leads vêm automáticos da Meta. Digite os <strong>agendamentos</strong> do dia e o custo por agendamento sai sozinho.
            </p>
          </div>
        </div>
        {filtroAtivo && (
          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-primary bg-primary/15 px-3 py-1 text-xs font-bold text-primary sm:ml-auto">
            Contém: “{filtro.trim().toUpperCase()}”
          </span>
        )}
      </div>
      {filtroAtivo && (
        <p className="text-xs text-muted-foreground -mt-2 mb-3">
          ⚠️ Com o filtro ativo, <strong>Investido, Leads e Cliques</strong> são só das campanhas filtradas. Já <strong>Agendou</strong> é o total digitado do dia (todas as campanhas) — a conversão e o CPA ficam aproximados.
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
                <th className="text-right py-2 px-2 font-semibold text-primary" title="Agendamentos (você digita)">Agendou ✍️</th>
                <th className="text-right py-2 px-2 font-semibold" title="Taxa de conversão: Agendamentos ÷ Leads">Conv.</th>
                <th className="text-right py-2 pl-2 font-semibold text-[hsl(var(--success))]" title="Custo por agendamento = Investido ÷ Agendamentos">CPA</th>
              </tr>
            </thead>
            <tbody>
              {mesRows.map((r) => (
                <tr key={r.id} className="border-b border-border/40 hover:bg-accent/30">
                  <td className="py-2 pr-3 font-medium text-foreground whitespace-nowrap">{diaFmt(r.data)}</td>
                  <td className="text-right py-2 px-2">{brl(Number(r.investimento))}</td>
                  <td className="text-right py-2 px-2">{r.leads}</td>
                  <td className="text-right py-2 px-2 text-muted-foreground">{custo(Number(r.investimento), r.leads)}</td>
                  <td className="text-right py-2 px-2 text-muted-foreground">{r.cliques}</td>
                  <td className="text-right py-2 px-2">
                    <Input
                      type="number"
                      min={0}
                      defaultValue={r.agendamentos}
                      disabled={!canEdit || !r.id || savingId === r.id}
                      onBlur={(e) => saveAgendamentos(r, e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      className="h-8 w-20 text-right ml-auto"
                      title={canEdit ? "Digite quantos agendou neste dia (total do dia)" : "Faça login para editar"}
                    />
                  </td>
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
                <td className="text-right py-2 px-2">{tot.agend}</td>
                <td className="text-right py-2 px-2">{pct(tot.agend, tot.leads)}</td>
                <td className="text-right py-2 pl-2 text-[hsl(var(--success))]">{custo(tot.inv, tot.agend)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {!canEdit && (
        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
          <TrendingDown className="w-3 h-3" /> Faça login para digitar os agendamentos.
        </p>
      )}
    </div>
  );
};
