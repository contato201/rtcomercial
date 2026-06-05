REVOKE EXECUTE ON FUNCTION public.is_authorized_editor() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.rename_sdr(text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.rename_sdr(text, text) TO authenticated;