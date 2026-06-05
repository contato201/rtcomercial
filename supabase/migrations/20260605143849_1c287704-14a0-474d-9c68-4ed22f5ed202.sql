DROP POLICY IF EXISTS "Authorized editors can view dados_realizados" ON public.dados_realizados;
DROP POLICY IF EXISTS "Authorized editors can view vendas_unitarias" ON public.vendas_unitarias;
DROP POLICY IF EXISTS "Authorized editors can view agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "Authorized editors can view reunioes_entries" ON public.reunioes_entries;

CREATE POLICY "Visitors can view dados_realizados"
ON public.dados_realizados
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Visitors can view vendas_unitarias"
ON public.vendas_unitarias
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Visitors can view agendamentos"
ON public.agendamentos
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Visitors can view reunioes_entries"
ON public.reunioes_entries
FOR SELECT
TO anon, authenticated
USING (true);

GRANT SELECT ON public.dados_realizados TO anon, authenticated;
GRANT SELECT ON public.vendas_unitarias TO anon, authenticated;
GRANT SELECT ON public.agendamentos TO anon, authenticated;
GRANT SELECT ON public.reunioes_entries TO anon, authenticated;
GRANT ALL ON public.dados_realizados TO service_role;
GRANT ALL ON public.vendas_unitarias TO service_role;
GRANT ALL ON public.agendamentos TO service_role;
GRANT ALL ON public.reunioes_entries TO service_role;