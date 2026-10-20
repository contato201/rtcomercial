-- 1ª reunião: marcar se o lead saiu qualificado ou desqualificado.
-- Texto livre em vez de enum para seguir o padrão de origem/funil e permitir
-- novos status sem migration. Vazio = ainda não avaliado.
ALTER TABLE public.reunioes_entries
  ADD COLUMN IF NOT EXISTS qualificacao text;

COMMENT ON COLUMN public.reunioes_entries.qualificacao IS
  'Resultado da 1ª reunião: Qualificado ou Desqualificado. Nulo quando ainda não avaliado.';
