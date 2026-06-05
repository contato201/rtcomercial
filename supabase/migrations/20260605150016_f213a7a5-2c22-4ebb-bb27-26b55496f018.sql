REVOKE ALL ON FUNCTION public.sync_dados_realizados_for_month(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_dados_realizados_from_unit_sales() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_dados_realizados_from_reunioes() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.sync_dados_realizados_for_month(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_dados_realizados_from_unit_sales() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_dados_realizados_from_reunioes() TO service_role;