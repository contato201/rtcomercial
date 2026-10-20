// Pages Function: lê AO VIVO a planilha de leads (Google Sheets, aba de scores) e devolve,
// por mês, quantos leads A/B/C (tier), desqualificados e o total. A planilha é pública e
// alimentada pelo rastreio do Allan — por isso tem o histórico completo (desde abril), ao
// contrário do banco D1 do quiz (que só começou 26/08). Sem token: fetch do CSV público.

const SHEET_ID = "1UlbWeQcUVmzDHkDoBgkP16j5V2_2wKvPF1x2MWyJ0Dg";
const SHEET_GID = "109089467"; // aba com data, qualificacao, tier, lead_score...
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

// Parser de CSV que respeita aspas (as respostas do quiz têm vírgulas dentro).
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (ch !== "\r") field += ch;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export async function onRequestGet() {
  try {
    const resp = await fetch(CSV_URL, { redirect: "follow" });
    if (!resp.ok) return json({ error: `planilha respondeu ${resp.status}` }, 502);
    const text = await resp.text();
    const rows = parseCSV(text);
    if (!rows.length) return json({ error: "planilha vazia" }, 502);

    const hdr = rows[0].map((h) => h.trim().toLowerCase());
    const iData = hdr.indexOf("data");
    const iEvento = hdr.indexOf("evento");
    const iQual = hdr.indexOf("qualificacao");
    const iTier = hdr.indexOf("tier");
    if (iData < 0 || iTier < 0) return json({ error: "colunas data/tier não encontradas" }, 502);

    const meses = {};
    const mes = (ym) => (meses[ym] ||= { a: 0, b: 0, c: 0, d: 0, leads: 0 });
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length <= iTier) continue;
      // Só conta LEAD de verdade — ignora 'contact', 'health_check', etc.
      if (iEvento >= 0 && String(row[iEvento] || "").trim().toLowerCase() !== "lead") continue;
      const p = String(row[iData] || "").split("/"); // dd/mm/yyyy
      if (p.length !== 3) continue;
      const ym = `${p[2]}-${p[1]}`;
      const tier = String(row[iTier] || "").trim().toUpperCase();
      const qual = String(iQual >= 0 ? row[iQual] : "").trim().toUpperCase();
      const m = mes(ym);
      m.leads++;
      if (tier === "A" || tier === "B" || tier === "C") m[tier.toLowerCase()]++;
      else if (qual.startsWith("DESQ") || qual.includes("NÃO QUALIF") || qual.includes("NAO QUALIF")) m.d++;
    }

    return json({ funil: "DIAGNOSTICO", fonte: "planilha", atualizado_em: new Date().toISOString(), meses });
  } catch (e) {
    return json({ error: String(e && e.message ? e.message : e) }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}
