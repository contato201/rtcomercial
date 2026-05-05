ALTER TABLE public.reunioes_entries ADD COLUMN IF NOT EXISTS pessoa text NOT NULL DEFAULT '';

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.agendamentos; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.dados_realizados; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.vendas_unitarias; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.reunioes_entries REPLICA IDENTITY FULL;
ALTER TABLE public.agendamentos REPLICA IDENTITY FULL;
ALTER TABLE public.dados_realizados REPLICA IDENTITY FULL;
ALTER TABLE public.vendas_unitarias REPLICA IDENTITY FULL;