
-- Helper function: checks if current user is an authorized editor
CREATE OR REPLACE FUNCTION public.is_authorized_editor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (auth.jwt() ->> 'email') IN (
    'contato@allancatao.com.br',
    'parceiros@reproduzindotalentos.com.br',
    'comercial@reproduzindotalentos.com.br'
  );
$$;

-- agendamentos
DROP POLICY IF EXISTS "Authorized editor can insert agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "Authorized editor can update agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "Authorized editor can delete agendamentos" ON public.agendamentos;
CREATE POLICY "Authorized editors can insert agendamentos" ON public.agendamentos FOR INSERT WITH CHECK (public.is_authorized_editor());
CREATE POLICY "Authorized editors can update agendamentos" ON public.agendamentos FOR UPDATE USING (public.is_authorized_editor());
CREATE POLICY "Authorized editors can delete agendamentos" ON public.agendamentos FOR DELETE USING (public.is_authorized_editor());

-- dados_realizados
DROP POLICY IF EXISTS "Authorized editor can insert dados_realizados" ON public.dados_realizados;
DROP POLICY IF EXISTS "Authorized editor can update dados_realizados" ON public.dados_realizados;
CREATE POLICY "Authorized editors can insert dados_realizados" ON public.dados_realizados FOR INSERT WITH CHECK (public.is_authorized_editor());
CREATE POLICY "Authorized editors can update dados_realizados" ON public.dados_realizados FOR UPDATE USING (public.is_authorized_editor());

-- dados_trafego
DROP POLICY IF EXISTS "Authorized editor can insert dados_trafego" ON public.dados_trafego;
DROP POLICY IF EXISTS "Authorized editor can update dados_trafego" ON public.dados_trafego;
CREATE POLICY "Authorized editors can insert dados_trafego" ON public.dados_trafego FOR INSERT WITH CHECK (public.is_authorized_editor());
CREATE POLICY "Authorized editors can update dados_trafego" ON public.dados_trafego FOR UPDATE USING (public.is_authorized_editor());

-- historico_alteracoes
DROP POLICY IF EXISTS "Authorized editor can insert historico_alteracoes" ON public.historico_alteracoes;
CREATE POLICY "Authorized editors can insert historico_alteracoes" ON public.historico_alteracoes FOR INSERT WITH CHECK (public.is_authorized_editor());

-- reunioes_entries
DROP POLICY IF EXISTS "Authorized editor can insert reunioes_entries" ON public.reunioes_entries;
DROP POLICY IF EXISTS "Authorized editor can update reunioes_entries" ON public.reunioes_entries;
DROP POLICY IF EXISTS "Authorized editor can delete reunioes_entries" ON public.reunioes_entries;
CREATE POLICY "Authorized editors can insert reunioes_entries" ON public.reunioes_entries FOR INSERT TO authenticated WITH CHECK (public.is_authorized_editor());
CREATE POLICY "Authorized editors can update reunioes_entries" ON public.reunioes_entries FOR UPDATE TO authenticated USING (public.is_authorized_editor());
CREATE POLICY "Authorized editors can delete reunioes_entries" ON public.reunioes_entries FOR DELETE TO authenticated USING (public.is_authorized_editor());

-- vendas_unitarias
DROP POLICY IF EXISTS "Authorized editor can insert vendas_unitarias" ON public.vendas_unitarias;
DROP POLICY IF EXISTS "Authorized editor can update vendas_unitarias" ON public.vendas_unitarias;
DROP POLICY IF EXISTS "Authorized editor can delete vendas_unitarias" ON public.vendas_unitarias;
DROP POLICY IF EXISTS "Authorized editor can view vendas_unitarias" ON public.vendas_unitarias;
CREATE POLICY "Authorized editors can insert vendas_unitarias" ON public.vendas_unitarias FOR INSERT WITH CHECK (public.is_authorized_editor());
CREATE POLICY "Authorized editors can update vendas_unitarias" ON public.vendas_unitarias FOR UPDATE USING (public.is_authorized_editor());
CREATE POLICY "Authorized editors can delete vendas_unitarias" ON public.vendas_unitarias FOR DELETE USING (public.is_authorized_editor());

-- Update rename_sdr authorization
CREATE OR REPLACE FUNCTION public.rename_sdr(old_name text, new_name text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  affected integer;
BEGIN
  IF NOT public.is_authorized_editor() THEN
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
$function$;
