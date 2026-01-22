-- Tabela para dados de tráfego (vindos do Sheets + calculados)
CREATE TABLE public.dados_trafego (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month TEXT NOT NULL,
  investimento NUMERIC NOT NULL DEFAULT 0,
  impressoes INTEGER NOT NULL DEFAULT 0,
  cliques INTEGER NOT NULL DEFAULT 0,
  cpc NUMERIC NOT NULL DEFAULT 0,
  leads_total INTEGER NOT NULL DEFAULT 0,
  leads_qualificados INTEGER NOT NULL DEFAULT 0, -- MQL (manual)
  reunioes_agendadas INTEGER NOT NULL DEFAULT 0, -- manual
  vendas_fechadas INTEGER NOT NULL DEFAULT 0, -- manual
  valor_vendas NUMERIC NOT NULL DEFAULT 0, -- manual
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(month)
);

-- Enable RLS
ALTER TABLE public.dados_trafego ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Anyone can view dados_trafego" 
ON public.dados_trafego 
FOR SELECT 
USING (true);

CREATE POLICY "Authorized editor can insert dados_trafego" 
ON public.dados_trafego 
FOR INSERT 
WITH CHECK ((auth.jwt() ->> 'email'::text) = 'contato@allancatao.com.br'::text);

CREATE POLICY "Authorized editor can update dados_trafego" 
ON public.dados_trafego 
FOR UPDATE 
USING ((auth.jwt() ->> 'email'::text) = 'contato@allancatao.com.br'::text);

-- Trigger para updated_at
CREATE TRIGGER update_dados_trafego_updated_at
BEFORE UPDATE ON public.dados_trafego
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.dados_trafego;