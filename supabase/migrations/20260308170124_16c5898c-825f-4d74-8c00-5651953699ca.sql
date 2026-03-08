
-- 1. Add cliente column to vendas_unitarias
ALTER TABLE public.vendas_unitarias ADD COLUMN cliente text NOT NULL DEFAULT '';

-- 2. Create reunioes_entries table for incremental reunion tracking
CREATE TABLE public.reunioes_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month text NOT NULL,
  tipo text NOT NULL,
  quantidade integer NOT NULL DEFAULT 0,
  data_lancamento date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Add validation trigger instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_reuniao_tipo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tipo NOT IN ('primeira', 'segunda') THEN
    RAISE EXCEPTION 'tipo must be primeira or segunda';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_reuniao_tipo
  BEFORE INSERT OR UPDATE ON public.reunioes_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_reuniao_tipo();

-- 4. Add updated_at trigger
CREATE TRIGGER update_reunioes_entries_updated_at
  BEFORE UPDATE ON public.reunioes_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Enable RLS
ALTER TABLE public.reunioes_entries ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies
CREATE POLICY "Anyone can view reunioes_entries"
  ON public.reunioes_entries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authorized editor can insert reunioes_entries"
  ON public.reunioes_entries FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email'::text) = 'contato@allancatao.com.br'::text);

CREATE POLICY "Authorized editor can delete reunioes_entries"
  ON public.reunioes_entries FOR DELETE
  TO authenticated
  USING ((auth.jwt() ->> 'email'::text) = 'contato@allancatao.com.br'::text);

CREATE POLICY "Authorized editor can update reunioes_entries"
  ON public.reunioes_entries FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'email'::text) = 'contato@allancatao.com.br'::text);

-- 7. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.reunioes_entries;
