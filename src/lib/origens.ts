// Origens de venda — fonte única usada no cadastro de vendas (UnitSalesEditor)
// e no funil de Growth (GrowthFunnelMeta). O valor é salvo no banco (coluna
// vendas_unitarias.origem); o label é o que aparece na tela.

export const ORIGEM_TRAFEGO = "trafego";

export const ORIGENS_VENDA = [
  { value: ORIGEM_TRAFEGO, label: "Tráfego pago (Meta)" },
  { value: "indicacao", label: "Indicação" },
  { value: "outbound", label: "Prospecção (Outbound)" },
  { value: "organico", label: "Orgânico / Inbound" },
] as const;

export type OrigemVenda = (typeof ORIGENS_VENDA)[number]["value"];

export const labelDaOrigem = (value?: string | null) =>
  ORIGENS_VENDA.find((o) => o.value === value)?.label ?? "";

export const isTrafego = (value?: string | null) => value === ORIGEM_TRAFEGO;
