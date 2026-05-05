
-- Restrict business metrics to authenticated users
DROP POLICY IF EXISTS "Anyone can view dados_realizados" ON public.dados_realizados;
CREATE POLICY "Authenticated users can view dados_realizados"
  ON public.dados_realizados FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can view historico_alteracoes" ON public.historico_alteracoes;
CREATE POLICY "Authenticated users can view historico_alteracoes"
  ON public.historico_alteracoes FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Restrict other operational tables to authenticated users
DROP POLICY IF EXISTS "Anyone can view agendamentos publicly" ON public.agendamentos;
DROP POLICY IF EXISTS "Anyone can view reunioes_entries publicly" ON public.reunioes_entries;
DROP POLICY IF EXISTS "Anyone can view vendas_unitarias publicly" ON public.vendas_unitarias;

CREATE POLICY "Authenticated users can view vendas_unitarias"
  ON public.vendas_unitarias FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Allow authorized editors to delete traffic data
CREATE POLICY "Authorized editors can delete dados_trafego"
  ON public.dados_trafego FOR DELETE
  USING (is_authorized_editor());
