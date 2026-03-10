
CREATE TABLE public.analises_perfil (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  business_type TEXT,
  page_type TEXT,
  page_url TEXT,
  pdf_name TEXT,
  scripts TEXT,
  analysis TEXT NOT NULL,
  prospect_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.analises_perfil ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analyses" ON public.analises_perfil
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analyses" ON public.analises_perfil
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own analyses" ON public.analises_perfil
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
