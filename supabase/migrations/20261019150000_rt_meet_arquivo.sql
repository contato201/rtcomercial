-- RT Meet — Arquivo de reuniões: um resumo por reunião para o painel.
--
-- Em vez de o site baixar todas as falas e gravações só para contar, o banco
-- já devolve as contas prontas. `security_invoker` faz a visão respeitar as
-- mesmas regras de acesso das tabelas (só a equipe autorizada vê).

CREATE OR REPLACE VIEW public.reunioes_arquivo
WITH (security_invoker = on) AS
SELECT
  s.id AS sala_id,
  (SELECT count(*) FROM public.reunioes_transcricao t WHERE t.sala_id = s.id)::int AS falas,
  (SELECT count(*) FROM public.reunioes_gravacoes g WHERE g.sala_id = s.id)::int AS gravacoes,
  (SELECT coalesce(sum(extract(epoch FROM (g.fim - g.inicio))), 0)
     FROM public.reunioes_gravacoes g
    WHERE g.sala_id = s.id AND g.fim IS NOT NULL)::int AS segundos_gravados,
  (SELECT round(avg(e.atencao)) FROM public.reunioes_engajamento e WHERE e.sala_id = s.id)::int AS atencao_media,
  c.nota,
  (c.relatorio IS NOT NULL) AS tem_relatorio
FROM public.reunioes_salas s
LEFT JOIN public.reunioes_coach c ON c.sala_id = s.id;

REVOKE ALL ON public.reunioes_arquivo FROM anon;
GRANT SELECT ON public.reunioes_arquivo TO authenticated;
