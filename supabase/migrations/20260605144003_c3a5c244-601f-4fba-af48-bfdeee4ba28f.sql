CREATE OR REPLACE FUNCTION public.is_authorized_editor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT (auth.jwt() ->> 'email') IN (
    'contato@allancatao.com.br',
    'parceiros@reproduzindotalentos.com.br',
    'comercial@reproduzindotalentos.com.br'
  );
$function$;

CREATE OR REPLACE FUNCTION public.rename_sdr(old_name text, new_name text)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  affected integer;
  current_names jsonb;
  new_names jsonb;
  idx int;
BEGIN
  IF NOT public.is_authorized_editor() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF new_name IS NULL OR length(trim(new_name)) = 0 THEN
    RAISE EXCEPTION 'new_name cannot be empty';
  END IF;

  UPDATE public.agendamentos
  SET pessoa = trim(new_name), updated_at = now()
  WHERE pessoa = old_name;
  GET DIAGNOSTICS affected = ROW_COUNT;

  UPDATE public.reunioes_entries
  SET pessoa = trim(new_name), updated_at = now()
  WHERE pessoa = old_name;

  SELECT value INTO current_names FROM public.app_settings WHERE key = 'sdr_names';
  IF current_names IS NULL THEN
    current_names := '["SDR 1","SDR 2","SDR 3"]'::jsonb;
  END IF;

  new_names := '[]'::jsonb;
  FOR idx IN 0 .. jsonb_array_length(current_names) - 1 LOOP
    IF current_names->>idx = old_name THEN
      new_names := new_names || to_jsonb(trim(new_name));
    ELSE
      new_names := new_names || (current_names->idx);
    END IF;
  END LOOP;

  INSERT INTO public.app_settings (key, value)
  VALUES ('sdr_names', new_names)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  RETURN affected;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.is_authorized_editor() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rename_sdr(text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.rename_sdr(text, text) FROM anon, public;