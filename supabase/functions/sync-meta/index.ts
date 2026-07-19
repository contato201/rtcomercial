// Sincroniza dados da Meta Ads (conta + campanhas + conjuntos + anúncios) para as
// tabelas growth_diario, growth_campanha_diario, growth_conjunto_diario e
// growth_anuncio_diario. Chamada diariamente pelo cron (01:00). Puxa os últimos
// N dias (?days=, padrão 14, máx 90) e faz upsert (preserva agendamentos manuais).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const META_TOKEN = Deno.env.get("META_ACCESS_TOKEN") ?? "";
const META_ACC = Deno.env.get("META_AD_ACCOUNT") ?? "";
const SYNC_SECRET = Deno.env.get("SYNC_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GV = "v24.0";

const fmt = (d: Date) => d.toISOString().slice(0, 10);
const leadsOf = (actions: any[]) => {
  const l = (actions ?? []).find((a) => a.action_type === "lead");
  return l ? parseInt(l.value) || 0 : 0;
};

async function fetchAll(url: string) {
  let out: any[] = [];
  let next: string | null = url;
  while (next) {
    const r = await fetch(next);
    const j = await r.json();
    if (j.error) throw new Error(j.error.message);
    out = out.concat(j.data ?? []);
    next = j.paging?.next ?? null;
  }
  return out;
}

const baseRow = (r: any) => ({
  data: r.date_start,
  investimento: Number(r.spend ?? 0),
  leads: leadsOf(r.actions),
  impressoes: Number(r.impressions ?? 0),
  cliques: Number(r.clicks ?? 0),
});

Deno.serve(async (req) => {
  // Proteção simples por segredo compartilhado
  const url = new URL(req.url);
  const secret = req.headers.get("x-sync-secret") ?? url.searchParams.get("secret");
  if (SYNC_SECRET && secret !== SYNC_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401 });
  }

  try {
    if (!META_TOKEN || !META_ACC) throw new Error("META_ACCESS_TOKEN / META_AD_ACCOUNT não configurados");
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get("days") ?? "14", 10) || 14));
    const until = new Date();
    const since = new Date();
    since.setDate(since.getDate() - days);
    const tr = encodeURIComponent(JSON.stringify({ since: fmt(since), until: fmt(until) }));
    const base = `https://graph.facebook.com/${GV}/${META_ACC}/insights`;
    const common = `time_increment=1&time_range=${tr}&access_token=${META_TOKEN}`;

    // Conta (diário)
    const accRows = await fetchAll(`${base}?fields=spend,impressions,clicks,actions&${common}&limit=100`);
    const accData = accRows.map(baseRow);
    if (accData.length) {
      const { error } = await supabase.from("growth_diario").upsert(accData, { onConflict: "data" });
      if (error) throw error;
    }

    // Campanhas (diário)
    const campRows = await fetchAll(
      `${base}?level=campaign&fields=campaign_id,campaign_name,spend,impressions,clicks,actions&${common}&limit=300`,
    );
    const campData = campRows.map((r) => ({ ...baseRow(r), campaign_id: r.campaign_id, campaign_name: r.campaign_name }));
    if (campData.length) {
      const { error } = await supabase.from("growth_campanha_diario").upsert(campData, { onConflict: "data,campaign_id" });
      if (error) throw error;
    }

    // Conjuntos (diário)
    const adsetRows = await fetchAll(
      `${base}?level=adset&fields=adset_id,adset_name,campaign_name,spend,impressions,clicks,actions&${common}&limit=500`,
    );
    const adsetData = adsetRows.map((r) => ({
      ...baseRow(r),
      adset_id: r.adset_id,
      adset_name: r.adset_name ?? "",
      campaign_name: r.campaign_name ?? "",
    }));
    if (adsetData.length) {
      const { error } = await supabase.from("growth_conjunto_diario").upsert(adsetData, { onConflict: "data,adset_id" });
      if (error) throw error;
    }

    // Anúncios (diário)
    const adRows = await fetchAll(
      `${base}?level=ad&fields=ad_id,ad_name,adset_name,campaign_name,spend,impressions,clicks,actions&${common}&limit=500`,
    );
    const adData = adRows.map((r) => ({
      ...baseRow(r),
      ad_id: r.ad_id,
      ad_name: r.ad_name ?? "",
      adset_name: r.adset_name ?? "",
      campaign_name: r.campaign_name ?? "",
    }));
    if (adData.length) {
      const { error } = await supabase.from("growth_anuncio_diario").upsert(adData, { onConflict: "data,ad_id" });
      if (error) throw error;
    }

    // Entidades (nome + status ativo/pausado) — para o "gerenciador" do dashboard
    const entBase = `https://graph.facebook.com/${GV}/${META_ACC}`;
    const [entCamps, entAdsets, entAds] = await Promise.all([
      fetchAll(`${entBase}/campaigns?fields=id,name,effective_status&limit=500&access_token=${META_TOKEN}`),
      fetchAll(`${entBase}/adsets?fields=id,name,effective_status,campaign{name}&limit=500&access_token=${META_TOKEN}`),
      fetchAll(`${entBase}/ads?fields=id,name,effective_status,campaign{name},adset{name}&limit=500&access_token=${META_TOKEN}`),
    ]);
    const entData = [
      ...entCamps.map((c: any) => ({
        entity_id: c.id, tipo: "campanha", nome: c.name ?? "", status: c.effective_status ?? "",
        campaign_name: c.name ?? "", adset_name: "", updated_at: new Date().toISOString(),
      })),
      ...entAdsets.map((s: any) => ({
        entity_id: s.id, tipo: "conjunto", nome: s.name ?? "", status: s.effective_status ?? "",
        campaign_name: s.campaign?.name ?? "", adset_name: s.name ?? "", updated_at: new Date().toISOString(),
      })),
      ...entAds.map((a: any) => ({
        entity_id: a.id, tipo: "anuncio", nome: a.name ?? "", status: a.effective_status ?? "",
        campaign_name: a.campaign?.name ?? "", adset_name: a.adset?.name ?? "", updated_at: new Date().toISOString(),
      })),
    ];
    if (entData.length) {
      const { error } = await supabase.from("meta_entidades").upsert(entData, { onConflict: "entity_id" });
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        dias: accData.length,
        campanha_dias: campData.length,
        conjunto_dias: adsetData.length,
        anuncio_dias: adData.length,
        entidades: entData.length,
        ate: fmt(until),
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message ?? e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
