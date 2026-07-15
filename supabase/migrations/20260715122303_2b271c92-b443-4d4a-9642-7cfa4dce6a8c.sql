
CREATE TABLE public.planejamento_mensal (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month_index SMALLINT NOT NULL UNIQUE CHECK (month_index BETWEEN 0 AND 11),
  meta_vendas INTEGER NOT NULL DEFAULT 0,
  meta_primeira_reuniao INTEGER NOT NULL DEFAULT 0,
  meta_segunda_reuniao INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.planejamento_mensal TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planejamento_mensal TO authenticated;
GRANT ALL ON public.planejamento_mensal TO service_role;

ALTER TABLE public.planejamento_mensal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read planejamento" ON public.planejamento_mensal
  FOR SELECT USING (true);
CREATE POLICY "Editors can insert planejamento" ON public.planejamento_mensal
  FOR INSERT WITH CHECK (public.is_authorized_editor());
CREATE POLICY "Editors can update planejamento" ON public.planejamento_mensal
  FOR UPDATE USING (public.is_authorized_editor()) WITH CHECK (public.is_authorized_editor());
CREATE POLICY "Editors can delete planejamento" ON public.planejamento_mensal
  FOR DELETE USING (public.is_authorized_editor());

CREATE TRIGGER trg_planejamento_mensal_updated
  BEFORE UPDATE ON public.planejamento_mensal
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed com os valores atuais de METAS_FIXAS
INSERT INTO public.planejamento_mensal (month_index, meta_vendas, meta_primeira_reuniao, meta_segunda_reuniao) VALUES
  (0, 10, 86, 29),
  (1, 12, 103, 35),
  (2, 14, 121, 41),
  (3, 10, 86, 29),
  (4, 18, 153, 52),
  (5, 14, 121, 41),
  (6, 24, 203, 69),
  (7, 25, 212, 72),
  (8, 22, 189, 64),
  (9, 24, 203, 69),
  (10, 30, 256, 87),
  (11, 26, 221, 75);

-- Parâmetros globais em app_settings
INSERT INTO public.app_settings (key, value) VALUES
  ('ticket_medio', '2700'::jsonb),
  ('taxa_comparecimento', '0.6'::jsonb)
ON CONFLICT (key) DO NOTHING;
