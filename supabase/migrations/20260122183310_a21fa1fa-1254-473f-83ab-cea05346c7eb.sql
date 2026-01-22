-- Tabela para agendamentos realizados (diários, por pessoa)
CREATE TABLE public.agendamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month TEXT NOT NULL,
  pessoa TEXT NOT NULL CHECK (pessoa IN ('Tadeu', 'Nicole')),
  quantidade INTEGER NOT NULL DEFAULT 0,
  data_lancamento DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_agendamentos_month ON public.agendamentos(month);
CREATE INDEX idx_agendamentos_pessoa ON public.agendamentos(pessoa);
CREATE INDEX idx_agendamentos_data ON public.agendamentos(data_lancamento);

-- Enable RLS
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (mesmo padrão das outras tabelas)
CREATE POLICY "Anyone can view agendamentos" 
ON public.agendamentos 
FOR SELECT 
USING (true);

CREATE POLICY "Authorized editor can insert agendamentos" 
ON public.agendamentos 
FOR INSERT 
WITH CHECK ((auth.jwt() ->> 'email'::text) = 'contato@allancatao.com.br'::text);

CREATE POLICY "Authorized editor can update agendamentos" 
ON public.agendamentos 
FOR UPDATE 
USING ((auth.jwt() ->> 'email'::text) = 'contato@allancatao.com.br'::text);

CREATE POLICY "Authorized editor can delete agendamentos" 
ON public.agendamentos 
FOR DELETE 
USING ((auth.jwt() ->> 'email'::text) = 'contato@allancatao.com.br'::text);

-- Trigger para updated_at
CREATE TRIGGER update_agendamentos_updated_at
BEFORE UPDATE ON public.agendamentos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.agendamentos;