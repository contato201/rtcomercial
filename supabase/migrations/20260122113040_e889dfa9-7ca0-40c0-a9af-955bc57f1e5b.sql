-- Tabela para registrar vendas unitárias (valores diferentes por venda)
CREATE TABLE IF NOT EXISTS public.vendas_unitarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Atualização automática do updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_vendas_unitarias_updated_at'
  ) THEN
    CREATE TRIGGER update_vendas_unitarias_updated_at
    BEFORE UPDATE ON public.vendas_unitarias
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Índice para buscas por mês
CREATE INDEX IF NOT EXISTS idx_vendas_unitarias_month ON public.vendas_unitarias (month);

-- RLS
ALTER TABLE public.vendas_unitarias ENABLE ROW LEVEL SECURITY;

-- Apenas o email autorizado pode ver/alterar as vendas unitárias
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendas_unitarias' AND policyname='Authorized editor can view vendas_unitarias'
  ) THEN
    CREATE POLICY "Authorized editor can view vendas_unitarias"
    ON public.vendas_unitarias
    FOR SELECT
    USING ( (auth.jwt() ->> 'email') = 'contato@allancatao.com.br' );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendas_unitarias' AND policyname='Authorized editor can insert vendas_unitarias'
  ) THEN
    CREATE POLICY "Authorized editor can insert vendas_unitarias"
    ON public.vendas_unitarias
    FOR INSERT
    WITH CHECK ( (auth.jwt() ->> 'email') = 'contato@allancatao.com.br' );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendas_unitarias' AND policyname='Authorized editor can update vendas_unitarias'
  ) THEN
    CREATE POLICY "Authorized editor can update vendas_unitarias"
    ON public.vendas_unitarias
    FOR UPDATE
    USING ( (auth.jwt() ->> 'email') = 'contato@allancatao.com.br' );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendas_unitarias' AND policyname='Authorized editor can delete vendas_unitarias'
  ) THEN
    CREATE POLICY "Authorized editor can delete vendas_unitarias"
    ON public.vendas_unitarias
    FOR DELETE
    USING ( (auth.jwt() ->> 'email') = 'contato@allancatao.com.br' );
  END IF;
END $$;