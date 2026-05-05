
-- Tighten SELECT to authorized editors only
DROP POLICY IF EXISTS "Authenticated users can view dados_realizados" ON public.dados_realizados;
CREATE POLICY "Authorized editors can view dados_realizados"
  ON public.dados_realizados FOR SELECT
  USING (is_authorized_editor());

DROP POLICY IF EXISTS "Authenticated users can view historico_alteracoes" ON public.historico_alteracoes;
CREATE POLICY "Authorized editors can view historico_alteracoes"
  ON public.historico_alteracoes FOR SELECT
  USING (is_authorized_editor());

DROP POLICY IF EXISTS "Authenticated users can view vendas_unitarias" ON public.vendas_unitarias;
CREATE POLICY "Authorized editors can view vendas_unitarias"
  ON public.vendas_unitarias FOR SELECT
  USING (is_authorized_editor());

DROP POLICY IF EXISTS "Authenticated users can view agendamentos" ON public.agendamentos;
CREATE POLICY "Authorized editors can view agendamentos"
  ON public.agendamentos FOR SELECT
  USING (is_authorized_editor());

DROP POLICY IF EXISTS "Authenticated users can view dados_trafego" ON public.dados_trafego;
CREATE POLICY "Authorized editors can view dados_trafego"
  ON public.dados_trafego FOR SELECT
  USING (is_authorized_editor());

DROP POLICY IF EXISTS "Anyone can view reunioes_entries" ON public.reunioes_entries;
CREATE POLICY "Authorized editors can view reunioes_entries"
  ON public.reunioes_entries FOR SELECT
  USING (is_authorized_editor());

-- Realtime: restrict channel subscriptions to authorized editors
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized editors can receive realtime" ON realtime.messages;
CREATE POLICY "Authorized editors can receive realtime"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (public.is_authorized_editor());
