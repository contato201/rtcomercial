-- RT Meet — Fase 5: gravação do vídeo da reunião no Supabase Storage.
--
-- O LiveKit grava a sala (todos os vídeos e áudios numa tela só) e manda o
-- arquivo MP4 direto para o armazém `gravacoes`, que é privado: só a equipe
-- assiste, por um link que vale 1 hora.

-- 1) Gravar automaticamente passa a ser opção, desligada por padrão: no plano
--    grátis do Supabase (1 GB) cabem só umas 2 horas de vídeo.
ALTER TABLE public.reunioes_salas ALTER COLUMN gravar SET DEFAULT false;

-- 2) Uma linha por gravação. Uma reunião pode ter várias (o anfitrião parou e
--    gravou de novo).
CREATE TABLE IF NOT EXISTS public.reunioes_gravacoes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id    uuid NOT NULL REFERENCES public.reunioes_salas(id) ON DELETE CASCADE,
  egress_id  text NOT NULL UNIQUE,       -- o id da gravação no LiveKit
  arquivo    text NOT NULL,              -- caminho dentro do armazém `gravacoes`
  status     text NOT NULL DEFAULT 'gravando' CHECK (status IN ('gravando', 'concluida', 'falhou')),
  inicio     timestamptz NOT NULL DEFAULT now(),
  fim        timestamptz
);
CREATE INDEX IF NOT EXISTS idx_reunioes_gravacoes_sala ON public.reunioes_gravacoes (sala_id, inicio);

ALTER TABLE public.reunioes_gravacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authorized editors can view reunioes_gravacoes"
  ON public.reunioes_gravacoes FOR SELECT TO authenticated USING (public.is_authorized_editor());
REVOKE ALL ON public.reunioes_gravacoes FROM anon;

-- 3) O armazém, privado. Quem escreve é o LiveKit (pelas chaves S3 do cofre);
--    quem lê é a equipe, por link assinado.
INSERT INTO storage.buckets (id, name, public)
VALUES ('gravacoes', 'gravacoes', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Equipe assiste as gravacoes"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'gravacoes' AND public.is_authorized_editor());
