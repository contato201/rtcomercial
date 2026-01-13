-- Adicionar coluna ticket_realizado na tabela dados_realizados
ALTER TABLE public.dados_realizados 
ADD COLUMN IF NOT EXISTS ticket_realizado NUMERIC DEFAULT 2700;