-- Fecha a leitura dos dados comerciais para quem não é da equipe.
--
-- Antes: "Visitors can view ... TO anon, authenticated USING (true)" — qualquer
-- sessão autenticada lia tudo. Como o link mágico criava conta sozinho, bastava
-- pedir um link para ver nomes de leads, clientes e valores de venda.
-- Nenhuma página do app é pública (todas passam por RequireAuth), então restringir
-- a leitura aos editores autorizados não tira nada de ninguém.

DROP POLICY IF EXISTS "Visitors can view dados_realizados"   ON public.dados_realizados;
DROP POLICY IF EXISTS "Visitors can view vendas_unitarias"   ON public.vendas_unitarias;
DROP POLICY IF EXISTS "Visitors can view agendamentos"       ON public.agendamentos;
DROP POLICY IF EXISTS "Visitors can view reunioes_entries"   ON public.reunioes_entries;
DROP POLICY IF EXISTS "Anyone can read planejamento"         ON public.planejamento_mensal;

CREATE POLICY "Authorized editors can view dados_realizados"
  ON public.dados_realizados FOR SELECT TO authenticated USING (public.is_authorized_editor());
CREATE POLICY "Authorized editors can view vendas_unitarias"
  ON public.vendas_unitarias FOR SELECT TO authenticated USING (public.is_authorized_editor());
CREATE POLICY "Authorized editors can view agendamentos"
  ON public.agendamentos FOR SELECT TO authenticated USING (public.is_authorized_editor());
CREATE POLICY "Authorized editors can view reunioes_entries"
  ON public.reunioes_entries FOR SELECT TO authenticated USING (public.is_authorized_editor());
CREATE POLICY "Authorized editors can view planejamento"
  ON public.planejamento_mensal FOR SELECT TO authenticated USING (public.is_authorized_editor());

-- Tira o acesso do papel anônimo (quem só tem a chave pública do site).
REVOKE SELECT ON public.dados_realizados   FROM anon;
REVOKE SELECT ON public.vendas_unitarias   FROM anon;
REVOKE SELECT ON public.agendamentos       FROM anon;
REVOKE SELECT ON public.reunioes_entries   FROM anon;
REVOKE SELECT ON public.planejamento_mensal FROM anon;
