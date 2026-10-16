-- RT Meet — Fase 1: salas de reunião próprias (vídeo por LiveKit).
--
-- Cada linha é UMA reunião marcada: quem é o lead, com qual SDR, quando, e o
-- endereço curto da sala (slug) que vira o link https://…/sala/<slug>.
--
-- Segurança: o lead NÃO lê esta tabela. Ele só conversa com a edge function
-- `sala-token`, que roda com a chave de serviço e devolve o mínimo necessário.
-- Por isso o papel `anon` não recebe nenhum acesso aqui — igual ao que a
-- migration 20261012120000 fez com as tabelas comerciais.

-- Gera um endereço curto, fácil de ditar no telefone, sem caracteres ambíguos
-- (sem 0/O e 1/l/I). 10 caracteres ≈ 6e15 combinações: não dá para adivinhar.
CREATE OR REPLACE FUNCTION public.gera_slug_sala()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  alfabeto constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  saida text := '';
  i int;
BEGIN
  FOR i IN 1..10 LOOP
    saida := saida || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
  END LOOP;
  RETURN saida;
END;
$$;

CREATE TABLE IF NOT EXISTS public.reunioes_salas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE DEFAULT public.gera_slug_sala(),

  titulo        text NOT NULL DEFAULT 'Reunião de diagnóstico',
  lead_nome     text NOT NULL,
  lead_email    text NOT NULL,
  sdr           text NOT NULL,                  -- mesma lista de `pessoa` das outras tabelas
  origem        text,                           -- mesma lista de ORIGENS_LEAD

  inicio        timestamptz NOT NULL,
  duracao_min   int NOT NULL DEFAULT 60 CHECK (duracao_min BETWEEN 5 AND 600),

  -- agendada → ao_vivo (alguém entrou) → encerrada. cancelada é manual.
  status        text NOT NULL DEFAULT 'agendada'
                CHECK (status IN ('agendada', 'ao_vivo', 'encerrada', 'cancelada')),
  gravar        boolean NOT NULL DEFAULT true,

  -- preenchidos sozinhos quando a reunião roda (viram o dado do funil)
  entrou_em     timestamptz,
  encerrada_em  timestamptz,
  lead_entrou   boolean NOT NULL DEFAULT false,

  observacoes   text,
  criado_por    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- O e-mail é a chave de busca do lead: sempre em minúsculo e sem espaço.
CREATE OR REPLACE FUNCTION public.normaliza_sala()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.lead_email := lower(btrim(NEW.lead_email));
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normaliza_sala ON public.reunioes_salas;
CREATE TRIGGER trg_normaliza_sala
  BEFORE INSERT OR UPDATE ON public.reunioes_salas
  FOR EACH ROW EXECUTE FUNCTION public.normaliza_sala();

CREATE INDEX IF NOT EXISTS idx_reunioes_salas_email  ON public.reunioes_salas (lead_email);
CREATE INDEX IF NOT EXISTS idx_reunioes_salas_inicio ON public.reunioes_salas (inicio DESC);
CREATE INDEX IF NOT EXISTS idx_reunioes_salas_sdr    ON public.reunioes_salas (sdr);

ALTER TABLE public.reunioes_salas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized editors can view reunioes_salas"
  ON public.reunioes_salas FOR SELECT TO authenticated USING (public.is_authorized_editor());
CREATE POLICY "Authorized editors can insert reunioes_salas"
  ON public.reunioes_salas FOR INSERT TO authenticated WITH CHECK (public.is_authorized_editor());
CREATE POLICY "Authorized editors can update reunioes_salas"
  ON public.reunioes_salas FOR UPDATE TO authenticated USING (public.is_authorized_editor());
CREATE POLICY "Authorized editors can delete reunioes_salas"
  ON public.reunioes_salas FOR DELETE TO authenticated USING (public.is_authorized_editor());

-- O site público (chave anon) não enxerga nada desta tabela.
REVOKE ALL ON public.reunioes_salas FROM anon;
