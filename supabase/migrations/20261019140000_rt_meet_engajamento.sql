-- RT Meet — Fase 4: engajamento pelo rosto.
--
-- A análise roda no navegador do anfitrião (MediaPipe). Nenhuma imagem sai de
-- lá nem é guardada: o banco recebe só números por minuto (quanto a pessoa
-- ficou olhando para a tela e quanto sorriu).
--
-- Rosto é dado biométrico (LGPD art. 11), então o consentimento é próprio:
-- o lead lê o aviso que cita "expressões do rosto" e clica em Entrar.

-- 1) Quando o lead concordou com a análise do rosto.
ALTER TABLE public.reunioes_salas
  ADD COLUMN IF NOT EXISTS consentimento_rosto_em timestamptz;

-- 2) Quem pediu para entrar pela sala de espera também leva o "sim" junto.
ALTER TABLE public.reunioes_pedidos
  ADD COLUMN IF NOT EXISTS consentiu_rosto boolean NOT NULL DEFAULT false;

-- 3) O engajamento, uma linha por pessoa por minuto.
CREATE TABLE IF NOT EXISTS public.reunioes_engajamento (
  sala_id   uuid NOT NULL REFERENCES public.reunioes_salas(id) ON DELETE CASCADE,
  quem      text NOT NULL,
  minuto    integer NOT NULL CHECK (minuto >= 0),
  atencao   smallint NOT NULL CHECK (atencao BETWEEN 0 AND 100),  -- % do minuto olhando para a tela
  sorriso   smallint NOT NULL CHECK (sorriso BETWEEN 0 AND 100),  -- % do minuto sorrindo
  amostras  smallint NOT NULL DEFAULT 0,
  PRIMARY KEY (sala_id, quem, minuto)
);

ALTER TABLE public.reunioes_engajamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authorized editors can view reunioes_engajamento"
  ON public.reunioes_engajamento FOR SELECT TO authenticated USING (public.is_authorized_editor());
CREATE POLICY "Authorized editors can insert reunioes_engajamento"
  ON public.reunioes_engajamento FOR INSERT TO authenticated WITH CHECK (public.is_authorized_editor());
CREATE POLICY "Authorized editors can update reunioes_engajamento"
  ON public.reunioes_engajamento FOR UPDATE TO authenticated USING (public.is_authorized_editor());
REVOKE ALL ON public.reunioes_engajamento FROM anon;
