import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Wallet, Plus, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const ANO = 2026;
const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

interface Orc { id: string; funil: string; mes: string; ano: number; valor_planejado: number; }
interface CampRow { data: string; campaign_name: string; investimento: number; }

export const GrowthOrcamento = ({ canEdit }: { canEdit: boolean }) => {
  const [orcs, setOrcs] = useState<Orc[]>([]);
  const [camps, setCamps] = useState<CampRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoFunil, setNovoFunil] = useState("");
  const [novoMes, setNovoMes] = useState(MESES[new Date().getMonth()]);
  const [novoValor, setNovoValor] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [o, c] = await Promise.all([
      (supabase as any).from("orcamento_funil").select("*").order("mes").order("funil"),
      (supabase as any).from("growth_campanha_diario").select("data,campaign_name,investimento"),
    ]);
    if (Array.isArray(o.data)) setOrcs(o.data);
    if (Array.isArray(c.data)) setCamps(c.data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const gastoDe = (funil: string, mes: string, ano: number) => {
    const idx = MESES.indexOf(mes);
    const f = funil.trim().toUpperCase();
    return camps
      .filter((r) => {
        const d = new Date(r.data + "T12:00:00");
        return d.getMonth() === idx && d.getFullYear() === ano && String(r.campaign_name).toUpperCase().includes(f);
      })
      .reduce((s, r) => s + Number(r.investimento || 0), 0);
  };

  const linhas = useMemo(() => {
    const hoje = new Date();
    return orcs.map((o) => {
      const gasto = gastoDe(o.funil, o.mes, o.ano);
      const plan = Number(o.valor_planejado || 0);
      const pct = plan > 0 ? (gasto / plan) * 100 : 0;
      const restante = plan - gasto;
      const idx = MESES.indexOf(o.mes);
      const diasNoMes = new Date(o.ano, idx + 1, 0).getDate();
      const ehMesAtual = idx === hoje.getMonth() && o.ano === hoje.getFullYear();
      const ehPassado = o.ano < hoje.getFullYear() || (o.ano === hoje.getFullYear() && idx < hoje.getMonth());
      const diasPassados = ehMesAtual ? hoje.getDate() : ehPassado ? diasNoMes : 0;
      const diasRestantes = Math.max(0, diasNoMes - diasPassados);
      const ritmoAtual = diasPassados > 0 ? gasto / diasPassados : 0; // quanto/dia está gastando
      const ritmoIdeal = diasNoMes > 0 ? plan / diasNoMes : 0; // quanto/dia pra fechar no orçado
      const ritmoRestante = diasRestantes > 0 ? Math.max(0, restante) / diasRestantes : 0; // quanto/dia daqui pra frente
      const projecao = ehMesAtual && diasPassados > 0 ? ritmoAtual * diasNoMes : gasto; // se manter o ritmo
      return { ...o, gasto, plan, pct, restante, diasNoMes, diasPassados, diasRestantes, ritmoAtual, ritmoIdeal, ritmoRestante, projecao, ehMesAtual };
    });
  }, [orcs, camps]);

  const add = async () => {
    const funil = novoFunil.trim();
    const valor = parseFloat(String(novoValor).replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
    if (!funil || valor <= 0) { toast.error("Preencha o funil e um valor válido."); return; }
    setSaving(true);
    const { error } = await (supabase as any)
      .from("orcamento_funil")
      .upsert({ funil: funil.toUpperCase(), mes: novoMes, ano: ANO, valor_planejado: valor }, { onConflict: "funil,mes,ano" });
    setSaving(false);
    if (error) { toast.error("Erro ao salvar", { description: error.message }); return; }
    setNovoFunil(""); setNovoValor("");
    toast.success("Orçamento salvo.");
    load();
  };

  const del = async (id: string) => {
    setOrcs((p) => p.filter((o) => o.id !== id));
    await (supabase as any).from("orcamento_funil").delete().eq("id", id);
  };

  const statusInfo = (pct: number) => {
    if (pct > 100) return { cls: "text-destructive", bar: "bg-destructive", label: "Estourou", icon: AlertTriangle };
    if (pct >= 90) return { cls: "text-amber-500", bar: "bg-amber-500", label: "Atenção", icon: AlertTriangle };
    return { cls: "text-[hsl(var(--success))]", bar: "bg-[hsl(var(--success))]", label: "No orçamento", icon: CheckCircle2 };
  };

  return (
    <div className="dashboard-card p-4 sm:p-6 border-2 border-primary/20 mb-4 md:mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-primary/10 p-2 rounded-lg">
          <Wallet className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-bold text-foreground">💰 Orçamento por Funil</h3>
          <p className="text-xs text-muted-foreground">
            Planeje quanto investir em cada funil no mês e acompanhe o gasto real da Meta (o "contém" bate com o nome da campanha).
          </p>
        </div>
      </div>

      {canEdit && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-4 rounded-lg border border-border/60 bg-muted/20 p-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Funil (contém)</label>
            <Input value={novoFunil} onChange={(e) => setNovoFunil(e.target.value)} placeholder="Ex: DIAGNOSTICO" className="mt-1" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Mês</label>
            <select value={novoMes} onChange={(e) => setNovoMes(e.target.value)} className="input-field mt-1">
              {MESES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Orçamento (R$)</label>
            <Input value={novoValor} onChange={(e) => setNovoValor(e.target.value)} placeholder="Ex: 5000" inputMode="decimal" className="mt-1" onKeyDown={(e) => e.key === "Enter" && add()} />
          </div>
          <div className="flex items-end">
            <Button onClick={add} disabled={saving} className="w-full"><Plus className="w-4 h-4 mr-1" /> Salvar</Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p>
      ) : linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Nenhum orçamento cadastrado ainda. Adicione acima.</p>
      ) : (
        <div className="space-y-2">
          {linhas.map((l) => {
            const st = statusInfo(l.pct);
            return (
              <div key={l.id} className="rounded-lg border border-border/60 bg-card/40 px-3 py-2">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="font-bold text-sm text-foreground">{l.funil}</span>
                  <span className="text-[11px] text-muted-foreground">· {l.mes}</span>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${st.cls}`}>
                    <st.icon className="w-3 h-3" /> {st.label}
                  </span>
                  <span className="text-[11px] font-bold text-foreground ml-auto">{l.pct.toFixed(0)}%</span>
                  {canEdit && (
                    <button onClick={() => del(l.id)} title="Remover" className="text-destructive/70 hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
                <div className="h-2 rounded-full bg-muted/40 overflow-hidden mb-2">
                  <div className={`h-full ${st.bar} transition-all`} style={{ width: `${Math.min(100, l.pct)}%` }} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                  <span><span className="text-muted-foreground">Orçado</span> <strong className="text-foreground">{brl(l.plan)}</strong></span>
                  <span><span className="text-muted-foreground">Gasto</span> <strong className={st.cls}>{brl(l.gasto)}</strong></span>
                  <span><span className="text-muted-foreground">{l.restante >= 0 ? "Resta" : "Estouro"}</span> <strong className={l.restante >= 0 ? "text-foreground" : "text-destructive"}>{brl(Math.abs(l.restante))}</strong></span>
                  {l.ehMesAtual && (
                    <>
                      <span className="text-border">•</span>
                      <span title="Quanto/dia você está gastando"><span className="text-muted-foreground">Ritmo</span> <strong className="text-foreground">{l.ritmoAtual > 0 ? brl(l.ritmoAtual) : "—"}/d</strong></span>
                      <span title="Orçado ÷ dias do mês"><span className="text-muted-foreground">Ideal</span> <strong className="text-foreground">{brl(l.ritmoIdeal)}/d</strong></span>
                      <span title="Quanto ainda pode gastar por dia até o fim do mês"><span className="text-muted-foreground">Pode</span> <strong className="text-primary">{l.diasRestantes > 0 && l.restante > 0 ? brl(l.ritmoRestante) : "R$ 0"}/d</strong></span>
                      <span title="Se mantiver o ritmo atual"><span className="text-muted-foreground">Projeção</span> <strong className={l.projecao > l.plan ? "text-destructive" : "text-[hsl(var(--success))]"}>{brl(l.projecao)}{l.projecao > l.plan ? " ⚠️" : ""}</strong></span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
