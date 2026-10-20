// Pages Function: dispara a sincronização com a Meta na hora (botão "Sincronizar agora").
// Guarda o segredo do lado do servidor (Pages secret SYNC_SECRET) — nunca vai pro navegador.
// Chama a mesma edge function que o cron das 01:00 usa.

const EDGE_URL = "https://qqthjtnphbycondztgwr.supabase.co/functions/v1/sync-meta?days=7";

export async function onRequestPost(context) {
  try {
    const secret = context.env.SYNC_SECRET;
    if (!secret) return json({ ok: false, error: "SYNC_SECRET não configurado" }, 500);
    const r = await fetch(EDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sync-secret": secret },
    });
    const data = await r.json().catch(() => ({}));
    return json(data, r.ok ? 200 : 502);
  } catch (e) {
    return json({ ok: false, error: String(e && e.message ? e.message : e) }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
