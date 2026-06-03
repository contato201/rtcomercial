ALTER TABLE public.reunioes_entries 
  ADD COLUMN IF NOT EXISTS lead_nome text,
  ADD COLUMN IF NOT EXISTS origem text;