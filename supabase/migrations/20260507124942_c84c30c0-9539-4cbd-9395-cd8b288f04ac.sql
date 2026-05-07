
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view app_settings"
  ON public.app_settings FOR SELECT
  USING (true);

CREATE POLICY "Authorized editors can insert app_settings"
  ON public.app_settings FOR INSERT
  WITH CHECK (public.is_authorized_editor());

CREATE POLICY "Authorized editors can update app_settings"
  ON public.app_settings FOR UPDATE
  USING (public.is_authorized_editor());

CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_settings (key, value)
VALUES ('sdr_names', '["SDR 1","SDR 2","SDR 3"]'::jsonb)
ON CONFLICT (key) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;

CREATE OR REPLACE FUNCTION public.rename_sdr(old_name text, new_name text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
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
