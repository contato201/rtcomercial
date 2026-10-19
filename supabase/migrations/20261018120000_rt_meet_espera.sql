-- RT Meet — sala de espera, lista de convidados, closer e reunião instantânea.
--
-- Tudo aditivo: nenhuma coluna existente some, nenhum dado é apagado.

-- 1) Novos campos da reunião ────────────────────────────────────────────────
ALTER TABLE public.reunioes_salas
  -- quem ATENDE (o closer). O `sdr` continua sendo quem agendou.
  ADD COLUMN IF NOT EXISTS closer           text,
  -- e-mails que entram direto além do lead (o sócio, por exemplo)
  ADD COLUMN IF NOT EXISTS convidados       text[] NOT NULL DEFAULT '{}',
  -- 'convidados': só quem está na lista entra.
  -- 'espera'    : quem está na lista entra direto; os outros pedem e o anfitrião aceita.
  -- As reuniões que já existiam ficam como estavam (só convidados).
  ADD COLUMN IF NOT EXISTS acesso           text NOT NULL DEFAULT 'convidados'
                           CHECK (acesso IN ('convidados', 'espera')),
  -- aberta na hora pelo botão "Começar agora", sem lead cadastrado
  ADD COLUMN IF NOT EXISTS instantanea      boolean NOT NULL DEFAULT false,
  -- quando o lead concordou com transcrição e análise por IA (LGPD)
  ADD COLUMN IF NOT EXISTS consentimento_em timestamptz;

-- Reuniões novas nascem com sala de espera (o mais parecido com o Meet).
ALTER TABLE public.reunioes_salas ALTER COLUMN acesso SET DEFAULT 'espera';

-- Reunião instantânea não tem lead nem SDR quando é criada.
ALTER TABLE public.reunioes_salas
  ALTER COLUMN lead_nome  DROP NOT NULL,
  ALTER COLUMN lead_email DROP NOT NULL,
  ALTER COLUMN sdr        DROP NOT NULL;

-- E-mails sempre em minúsculo e sem espaço — no lead e na lista de convidados.
CREATE OR REPLACE FUNCTION public.normaliza_sala()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.lead_email := nullif(lower(btrim(NEW.lead_email)), '');
  NEW.convidados := coalesce(
    array(
      SELECT DISTINCT lower(btrim(e))
      FROM unnest(NEW.convidados) AS e
      WHERE btrim(e) <> ''
    ),
    '{}'
  );
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- 2) Pedidos para entrar (sala de espera) ───────────────────────────────────
-- Quem não está na lista pede para entrar e espera; o anfitrião aceita ou
-- recusa de dentro da sala. Só o porteiro (chave de serviço) escreve aqui.
CREATE TABLE IF NOT EXISTS public.reunioes_pedidos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id      uuid NOT NULL REFERENCES public.reunioes_salas(id) ON DELETE CASCADE,
  nome         text NOT NULL,
  email        text NOT NULL,
  -- segredo entregue só para quem pediu: é com ele que a pessoa acompanha o
  -- próprio pedido. Sem isso, qualquer um que soubesse o id pegaria o crachá.
  chave        uuid NOT NULL DEFAULT gen_random_uuid(),
  consentiu    boolean NOT NULL DEFAULT false,
  status       text NOT NULL DEFAULT 'pendente'
               CHECK (status IN ('pendente', 'aceito', 'recusado')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  decidido_em  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_reunioes_pedidos_sala ON public.reunioes_pedidos (sala_id, status);

ALTER TABLE public.reunioes_pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized editors can view reunioes_pedidos"
  ON public.reunioes_pedidos FOR SELECT TO authenticated USING (public.is_authorized_editor());

REVOKE ALL ON public.reunioes_pedidos FROM anon;
