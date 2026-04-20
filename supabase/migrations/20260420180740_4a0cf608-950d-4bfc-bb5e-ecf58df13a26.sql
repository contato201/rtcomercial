-- Drop any check constraint on pessoa if it exists (safe if absent)
DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.agendamentos'::regclass
      AND contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.agendamentos DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

-- Function to rename an SDR across all agendamentos
CREATE OR REPLACE FUNCTION public.rename_sdr(old_name text, new_name text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  -- Authorization check
  IF (auth.jwt() ->> 'email') <> 'contato@allancatao.com.br' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF new_name IS NULL OR length(trim(new_name)) = 0 THEN
    RAISE EXCEPTION 'new_name cannot be empty';
  END IF;

  UPDATE public.agendamentos
  SET pessoa = trim(new_name),
      updated_at = now()
  WHERE pessoa = old_name;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;