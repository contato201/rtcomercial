-- Create table to store change history
CREATE TABLE public.historico_alteracoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dados_realizados_id UUID REFERENCES public.dados_realizados(id) ON DELETE CASCADE NOT NULL,
  month TEXT NOT NULL,
  campo_alterado TEXT NOT NULL,
  valor_anterior NUMERIC NOT NULL DEFAULT 0,
  valor_novo NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.historico_alteracoes ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (same as dados_realizados)
CREATE POLICY "Anyone can view historico_alteracoes" 
ON public.historico_alteracoes 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert historico_alteracoes" 
ON public.historico_alteracoes 
FOR INSERT 
WITH CHECK (true);

-- Enable realtime for history updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.historico_alteracoes;

-- Create index for faster queries
CREATE INDEX idx_historico_month ON public.historico_alteracoes(month);
CREATE INDEX idx_historico_created_at ON public.historico_alteracoes(created_at DESC);