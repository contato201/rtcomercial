import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Nível de análise do tráfego pago (Meta): campanha, conjunto de anúncios ou anúncio.
export type NivelTrafego = "campanha" | "conjunto" | "anuncio";

export const NIVEIS: { value: NivelTrafego; label: string; plural: string }[] = [
  { value: "campanha", label: "Campanha", plural: "campanha(s)" },
  { value: "conjunto", label: "Conjunto", plural: "conjunto(s)" },
  { value: "anuncio", label: "Anúncio", plural: "anúncio(s)" },
];

// Linha diária normalizada, independente do nível.
// `nome` é o que aparece na tela; `busca` concatena campanha+conjunto+anúncio
// pra o filtro "contém" achar mesmo quando o texto está no nome da campanha.
export interface TrafegoRow {
  data: string; // YYYY-MM-DD
  entityId: string; // id da campanha/conjunto/anúncio na Meta
  nome: string;
  contexto: string; // onde vive: campanha (e conjunto) "pai", para exibição
  busca: string;
  investimento: number;
  leads: number;
  impressoes: number;
  cliques: number;
}

const TABELAS: Record<NivelTrafego, { tabela: string; campos: string }> = {
  campanha: { tabela: "growth_campanha_diario", campos: "data,campaign_id,campaign_name,investimento,leads,impressoes,cliques" },
  conjunto: { tabela: "growth_conjunto_diario", campos: "data,adset_id,adset_name,campaign_name,investimento,leads,impressoes,cliques" },
  anuncio: { tabela: "growth_anuncio_diario", campos: "data,ad_id,ad_name,adset_name,campaign_name,investimento,leads,impressoes,cliques" },
};

const normaliza = (nivel: NivelTrafego, r: any): TrafegoRow => {
  const nome = nivel === "campanha" ? r.campaign_name : nivel === "conjunto" ? r.adset_name : r.ad_name;
  const entityId = nivel === "campanha" ? r.campaign_id : nivel === "conjunto" ? r.adset_id : r.ad_id;
  const contexto =
    nivel === "campanha" ? "" : nivel === "conjunto" ? String(r.campaign_name ?? "") : [r.campaign_name, r.adset_name].filter(Boolean).join(" · ");
  const busca = [r.campaign_name, r.adset_name, r.ad_name].filter(Boolean).join(" · ").toUpperCase();
  return {
    data: String(r.data),
    entityId: String(entityId ?? ""),
    nome: String(nome ?? ""),
    contexto,
    busca,
    investimento: Number(r.investimento || 0),
    leads: r.leads || 0,
    impressoes: r.impressoes || 0,
    cliques: r.cliques || 0,
  };
};

export const useTrafegoDiario = (nivel: NivelTrafego) => {
  const [rows, setRows] = useState<TrafegoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    (async () => {
      setLoading(true);
      const { tabela, campos } = TABELAS[nivel];
      // O Supabase devolve no máximo 1000 linhas por consulta — busca em páginas
      // até acabar (a tabela de anúncios passa fácil de 1000 linhas).
      const PAGINA = 1000;
      let todas: any[] = [];
      for (let from = 0; ; from += PAGINA) {
        const { data, error } = await (supabase as any)
          .from(tabela)
          .select(campos)
          .order("data", { ascending: true })
          .range(from, from + PAGINA - 1);
        if (error || !Array.isArray(data)) break;
        todas = todas.concat(data);
        if (data.length < PAGINA) break;
      }
      if (ativo) {
        setRows(todas.map((r: any) => normaliza(nivel, r)));
        setLoading(false);
      }
    })();
    return () => { ativo = false; };
  }, [nivel]);

  return { rows, loading };
};
