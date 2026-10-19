-- RT Meet — Fase 3: transcrição e Coach IA.
--
-- Tudo aditivo. O lead não lê nada daqui: as três tabelas são só da equipe.

-- 1) Dois campos novos no agendamento — o Coach lê os dois antes de começar.
ALTER TABLE public.reunioes_salas
  -- 1 = Consultoria/Diagnóstico, 2 = Plano de Ação/Proposta (seções 3 e 4 do processo)
  ADD COLUMN IF NOT EXISTS tipo_reuniao smallint NOT NULL DEFAULT 1 CHECK (tipo_reuniao IN (1, 2)),
  -- o que o SDR já descobriu, para o closer não perguntar de novo
  ADD COLUMN IF NOT EXISTS notas_sdr text;

-- 2) A transcrição, um trecho por fala. O id vem do transcritor: se o mesmo
--    trecho chegar duas vezes, não duplica.
CREATE TABLE IF NOT EXISTS public.reunioes_transcricao (
  id         uuid PRIMARY KEY,
  sala_id    uuid NOT NULL REFERENCES public.reunioes_salas(id) ON DELETE CASCADE,
  quem       text NOT NULL,
  papel      text,
  texto      text NOT NULL,
  falado_em  timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reunioes_transcricao_sala ON public.reunioes_transcricao (sala_id, falado_em);

ALTER TABLE public.reunioes_transcricao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authorized editors can view reunioes_transcricao"
  ON public.reunioes_transcricao FOR SELECT TO authenticated USING (public.is_authorized_editor());
CREATE POLICY "Authorized editors can insert reunioes_transcricao"
  ON public.reunioes_transcricao FOR INSERT TO authenticated WITH CHECK (public.is_authorized_editor());
REVOKE ALL ON public.reunioes_transcricao FROM anon;

-- 3) O Coach: o estado ao vivo (ficha, roteiro, dicas — é daqui que o
--    observador acompanha) e o relatório do fim da reunião.
CREATE TABLE IF NOT EXISTS public.reunioes_coach (
  sala_id      uuid PRIMARY KEY REFERENCES public.reunioes_salas(id) ON DELETE CASCADE,
  estado       jsonb NOT NULL DEFAULT '{}'::jsonb,
  relatorio    text,
  nota         smallint CHECK (nota BETWEEN 0 AND 10),
  relatorio_em timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reunioes_coach ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authorized editors can view reunioes_coach"
  ON public.reunioes_coach FOR SELECT TO authenticated USING (public.is_authorized_editor());
CREATE POLICY "Authorized editors can insert reunioes_coach"
  ON public.reunioes_coach FOR INSERT TO authenticated WITH CHECK (public.is_authorized_editor());
CREATE POLICY "Authorized editors can update reunioes_coach"
  ON public.reunioes_coach FOR UPDATE TO authenticated USING (public.is_authorized_editor());
REVOKE ALL ON public.reunioes_coach FROM anon;
