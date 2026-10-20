-- 2ª reunião: rastrear de qual funil de tráfego pago o lead veio e registrar
-- a situação dele em texto livre, atualizável ao longo da negociação.
--
-- funil casa com orcamento_funil.funil (mesma convenção em MAIÚSCULAS),
-- para permitir custo por reunião e por venda em cada funil.
ALTER TABLE public.reunioes_entries
  ADD COLUMN IF NOT EXISTS funil text,
  ADD COLUMN IF NOT EXISTS comentario text;

COMMENT ON COLUMN public.reunioes_entries.funil IS
  'Funil de tráfego pago de origem do lead. Casa com orcamento_funil.funil. Só preenchido quando origem = Tráfego Pago.';
COMMENT ON COLUMN public.reunioes_entries.comentario IS
  'Situação atual do lead, texto livre, editável após o lançamento.';
