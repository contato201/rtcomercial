import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Target, RefreshCw } from "lucide-react";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const ANO = 2026;
// O score (A/B/C) vem do quiz do funil DIAGNOSTICO, que começou a rastrear em 26/08/2026.
// Por isso o custo usa só o gasto das campanhas DIAGNOSTICO e só a partir dessa data —
// senão agosto (gasto do mês inteiro ÷ leads de 6 dias) daria um custo inflado e errado.
// A planilha junta os leads dos dois funis; o investido soma as campanhas dos dois.
const FUNIS_SCORE = ["DIAGNOSTICO", "CONSULTORIA"];
const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

interface DiaRow { data: string; campaign_name: string; investimento: number; }
interface Counts { a: number; b: number; c: number; d: number; leads?: number; }

const ZERO: Counts = { a: 0, b: 0, c: 0, d: 0, leads: 0 };

// "Big numbers" de qualidade de lead: puxa AO VIVO do trackeamento (Cloudflare D1, via
// /api/leadscore) quantos leads A/B/C/Desqualificado o quiz do funil DIAGNOSTICO gerou por
// mês, e cruza com o investimento da Meta pra mostrar o custo real de cada tier e do MQL (A+B).
// Fallback: se a leitura ao vivo falhar (ex.: dev local), usa o último salvo em leads_score.
export const GrowthMQL = (_: { canEdit: boolean }) => {
  const [mes, setMes] = useState(MESES[new Date().getMonth()]);
  const [dias, setDias] = useState<DiaRow[]>([]);
  const [live, setLive] = useState<Record<string, Counts> | null>(null);
  const [fallback, setFallback] = useState<Record<string, Counts>>({});
  const [aoVivo, setAoVivo] = useState<boolean | null>(null);

  useEffect(() => {
    (supabase as any).from("growth_campanha_diario").select("data,campaign_name,investimento").then((r: any) => {
      if (Array.isArray(r.data)) setDias(r.data);
    });
    // Fallback: números salvos (caso o ao vivo falhe).
    (supabase as any).from("leads_score").select("*").then((r: any) => {
      if (Array.isArray(r.data)) {
        const map: Record<string, Counts> = {};
        for (const row of r.data) {
          const idx = MESES.indexOf(row.mes);
          if (idx < 0) continue;
          const ym = `${row.ano}-${String(idx + 1).padStart(2, "0")}`;
          map[ym] = { a: row.qtd_a ?? 0, b: row.qtd_b ?? 0, c: row.qtd_c ?? 0, d: row.qtd_d ?? 0, leads: row.qtd_leads ?? 0 };
        }
        setFallback(map);
      }
    });
    // Ao vivo: lê direto do Cloudflare (D1 do trackeamento).
    fetch("/api/leadscore")
      .then((r) => r.json())
      .then((j) => {
        if (j && j.meses) { setLive(j.meses); setAoVivo(true); }
        else setAoVivo(false);
      })
      .catch(() => setAoVivo(false));
  }, []);

  const idx = MESES.indexOf(mes);
  const ym = `${ANO}-${String(idx + 1).padStart(2, "0")}`;
  const counts: Counts = (live && live[ym]) || fallback[ym] || ZERO;
  const nA = counts.a, nB = counts.b, nC = counts.c, nD = counts.d;
  const scored = nA + nB + nC + nD;
  // Total de leads real (da planilha). Se não vier, cai pro total pontuado.
  const leadsTotal = counts.leads && counts.leads > 0 ? counts.leads : scored;
  const mql = nA + nB;

  // Gasto do mês nas campanhas DIAGNOSTICO (mês inteiro — a planilha já traz o mês todo).
  const investido = useMemo(() => {
    return dias
      .filter((x) => {
        const dt = new Date(x.data + "T12:00:00");
        const nome = String(x.campaign_name).toUpperCase();
        return dt.getMonth() === idx && dt.getFullYear() === ANO
          && FUNIS_SCORE.some((f) => nome.includes(f));
      })
      .reduce((s, x) => s + Number(x.investimento || 0), 0);
  }, [dias, idx]);

  const custoPor = (qtd: number) => (qtd > 0 ? investido / qtd : 0);

  const tiers = [
    { key: "A", label: "Lead A", n: nA, ring: "bg-[hsl(var(--success)/0.16)] border-[hsl(var(--success)/0.5)]", dot: "bg-[hsl(var(--success))]", txt: "text-[hsl(var(--success))]" },
    { key: "B", label: "Lead B", n: nB, ring: "bg-amber-500/16 border-amber-500/50", dot: "bg-amber-500", txt: "text-amber-500" },
    { key: "C", label: "Lead C", n: nC, ring: "bg-blue-500/16 border-blue-500/50", dot: "bg-blue-500", txt: "text-blue-400" },
    { key: "D", label: "Desqualificado", n: nD, ring: "bg-destructive/16 border-destructive/50", dot: "bg-destructive", txt: "text-destructive" },
  ];

  // Etapas do funil de QUALIDADE (só até MQL — agendamento fica no funil de Growth/Diário).
  const etapas = [
    { nome: "Leads", valor: leadsTotal, bar: "bg-slate-400 dark:bg-slate-500", sub: leadsTotal > 0 ? `CPL ${brl(investido / leadsTotal)}` : "—" },
    { nome: "Pontuados", valor: scored, bar: "bg-blue-500", sub: "com nota" },
    { nome: "MQL (A+B)", valor: mql, bar: "bg-[hsl(var(--success))]", sub: mql > 0 ? `${brl(investido / mql)}/MQL` : "—" },
  ];
  const conv = (i: number) => (etapas[i].valor > 0 ? Math.round((etapas[i + 1].valor / etapas[i].valor) * 100) : 0);
  const legenda = ["viram nota", "qualificam"];

  // Geometria do funil SVG (forma contínua que afina; adapta ao nº de etapas).
  const nSt = etapas.length;
  const maxV = Math.max(...etapas.map((e) => e.valor), 1);
  const CY = 20, MAXH = 17;
  const xc = etapas.map((_, i) => (100 / (2 * nSt)) * (2 * i + 1));
  const hh = etapas.map((e) => Math.max(0.6, (e.valor / maxV) * MAXH));
  const edgePts: [number, number][] = [[0, hh[0]], ...xc.map((x, i) => [x, hh[i]] as [number, number]), [100, hh[nSt - 1]]];
  const funnelPath =
    "M " + edgePts.map(([x, h]) => `${x},${(CY - h).toFixed(2)}`).join(" L ") +
    " L " + edgePts.slice().reverse().map(([x, h]) => `${x},${(CY + h).toFixed(2)}`).join(" L ") + " Z";

  return (
    <div className="dashboard-card p-4 sm:p-6 border-2 border-primary/20 mb-4 md:mb-6">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Target className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">🎯 Qualidade dos Leads · MQL por Score <span className="text-xs font-normal text-muted-foreground">· Diagnóstico + Consultoria</span></h3>
            <p className="text-xs text-muted-foreground">
              Leads do mês por tier A/B/C/Desqualificado (score do quiz) + agendamentos, com o custo real de cada. MQL = A + B.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {aoVivo === true && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[hsl(var(--success))] bg-[hsl(var(--success)/0.1)] rounded-full px-2 py-1">
              <RefreshCw className="w-3 h-3" /> Atualiza sozinho
            </span>
          )}
          {aoVivo === false && (
            <span className="text-[10px] text-muted-foreground bg-muted/40 rounded-full px-2 py-1" title="Não consegui ler ao vivo agora; mostrando o último valor salvo.">último salvo</span>
          )}
          <select value={mes} onChange={(e) => setMes(e.target.value)} className="input-field w-auto">
            {MESES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Chips de topo: investido + custo/MQL */}
      <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
        <span className="rounded-md border border-border bg-muted/60 px-2.5 py-1"><span className="text-muted-foreground">Investido:</span> <strong className="text-foreground">{brl(investido)}</strong></span>
        <span className="rounded-md border border-primary/50 bg-primary/20 px-2.5 py-1"><span className="text-primary">Custo/MQL:</span> <strong className="text-primary">{mql > 0 ? brl(investido / mql) : "—"}</strong></span>
      </div>

      {/* FUNIL em forma (SVG que afina) — estilo do funil da Meta */}
      <div className="rounded-xl border border-border bg-card/40 px-3 pt-2 pb-2 mb-3">
        {/* nomes das etapas */}
        <div className="grid grid-cols-3 mb-1">
          {etapas.map((e, i) => (
            <div key={e.nome} className={`text-[10px] uppercase tracking-wider text-center truncate ${i === etapas.length - 1 ? "text-[hsl(var(--success))] font-bold" : "text-muted-foreground"}`}>{e.nome}</div>
          ))}
        </div>
        {/* forma do funil + pílulas de conversão */}
        <div className="relative" style={{ height: 128 }}>
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
            <defs>
              <linearGradient id="mqlFunGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(var(--gold))" stopOpacity="0.6" />
                <stop offset="100%" stopColor="hsl(var(--gold))" stopOpacity="0.2" />
              </linearGradient>
            </defs>
            <path d={funnelPath} fill="url(#mqlFunGrad)" stroke="hsl(var(--gold))" strokeOpacity="0.55" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </svg>
          {etapas.slice(0, -1).map((_, i) => (
            <div key={i} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card px-2 py-1 text-center shadow-sm" style={{ left: `${(xc[i] + xc[i + 1]) / 2}%` }}>
              <div className="text-[8px] uppercase tracking-wider text-muted-foreground leading-none whitespace-nowrap">{legenda[i]}</div>
              <div className="text-sm font-bold text-foreground leading-tight">{conv(i)}%</div>
            </div>
          ))}
        </div>
        {/* números + custo de cada etapa (aterrados em cartões com a cor da etapa) */}
        <div className="grid grid-cols-3 gap-2 mt-1">
          {etapas.map((e, i) => (
            <div key={e.nome} className="rounded-lg bg-muted/25 border border-border/60 overflow-hidden text-center">
              <div className={`h-1 ${e.bar}`} />
              <div className="px-2 py-1.5">
                <div className={`text-xl font-bold leading-none ${i === etapas.length - 1 ? "text-primary" : "text-foreground"}`}>{e.valor}</div>
                <div className="text-[10px] text-muted-foreground truncate mt-1">{e.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detalhe dos pontuados: tiers A/B/C/Desqualificado + barra de proporção */}
      {scored > 0 && (
        <div className="flex h-1.5 rounded-full overflow-hidden mb-2 bg-muted/40">
          <div className="bg-[hsl(var(--success))]" style={{ width: `${(nA / scored) * 100}%` }} />
          <div className="bg-amber-500" style={{ width: `${(nB / scored) * 100}%` }} />
          <div className="bg-blue-500" style={{ width: `${(nC / scored) * 100}%` }} />
          <div className="bg-destructive" style={{ width: `${(nD / scored) * 100}%` }} />
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {tiers.map((t) => (
          <div key={t.key} className={`rounded-lg border ${t.ring} px-3 py-2.5`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-6 h-6 shrink-0 rounded-full ${t.dot} text-white text-xs font-bold flex items-center justify-center`}>{t.key === "D" ? "✕" : t.key}</span>
              <span className={`text-xs font-bold ${t.txt} truncate`}>{t.label}</span>
              <span className="ml-auto text-2xl font-bold text-foreground leading-none">{t.n}</span>
            </div>
            <div className={`flex items-center justify-between rounded-md px-2 py-1 ${t.ring}`}>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Custo/lead</span>
              <span className={`text-sm font-bold ${t.txt}`}>{custoPor(t.n) > 0 ? brl(custoPor(t.n)) : "—"}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
        🔄 Lido <strong>ao vivo</strong> da sua planilha (Diagnóstico + Consultoria). Funil: Leads → Pontuados (com nota) → MQL (A+B) → Agendou, com a conversão entre cada etapa. Custo = gasto das campanhas ÷ leads.
      </p>
    </div>
  );
};
