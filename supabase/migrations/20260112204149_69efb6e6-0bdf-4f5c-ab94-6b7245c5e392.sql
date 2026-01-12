-- Create table for storing realized monthly data
CREATE TABLE public.dados_realizados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month TEXT NOT NULL UNIQUE,
  realizado_vendas INTEGER NOT NULL DEFAULT 0,
  realizado_faturamento NUMERIC NOT NULL DEFAULT 0,
  realizado_primeira_reuniao INTEGER NOT NULL DEFAULT 0,
  realizado_segunda_reuniao INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.dados_realizados ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (anyone can view)
CREATE POLICY "Anyone can view dados_realizados" 
ON public.dados_realizados 
FOR SELECT 
USING (true);

-- Create policy for public insert access
CREATE POLICY "Anyone can insert dados_realizados" 
ON public.dados_realizados 
FOR INSERT 
WITH CHECK (true);

-- Create policy for public update access
CREATE POLICY "Anyone can update dados_realizados" 
ON public.dados_realizados 
FOR UPDATE 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_dados_realizados_updated_at
BEFORE UPDATE ON public.dados_realizados
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for the table
ALTER PUBLICATION supabase_realtime ADD TABLE public.dados_realizados;

-- Insert initial data for all months
INSERT INTO public.dados_realizados (month, realizado_vendas, realizado_faturamento, realizado_primeira_reuniao, realizado_segunda_reuniao)
VALUES 
  ('Janeiro', 0, 0, 0, 0),
  ('Fevereiro', 0, 0, 0, 0),
  ('Março', 0, 0, 0, 0),
  ('Abril', 0, 0, 0, 0),
  ('Maio', 0, 0, 0, 0),
  ('Junho', 0, 0, 0, 0),
  ('Julho', 0, 0, 0, 0),
  ('Agosto', 0, 0, 0, 0),
  ('Setembro', 0, 0, 0, 0),
  ('Outubro', 0, 0, 0, 0),
  ('Novembro', 0, 0, 0, 0),
  ('Dezembro', 0, 0, 0, 0)
ON CONFLICT (month) DO NOTHING;