CREATE OR REPLACE FUNCTION public.sync_dados_realizados_for_month(_month text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sales_count integer;
  sales_sum numeric;
  sales_avg numeric;
  primeira_count integer;
  segunda_count integer;
  has_sales boolean;
  has_primeira boolean;
  has_segunda boolean;
BEGIN
  IF _month IS NULL OR length(trim(_month)) = 0 THEN
    RETURN;
  END IF;

  SELECT count(*) > 0, count(*)::integer, COALESCE(sum(valor), 0), COALESCE(avg(valor), 2700)
  INTO has_sales, sales_count, sales_sum, sales_avg
  FROM public.vendas_unitarias
  WHERE month = _month;

  SELECT COALESCE(sum(quantidade), 0)::integer, count(*) > 0
  INTO primeira_count, has_primeira
  FROM public.reunioes_entries
  WHERE month = _month AND tipo = 'primeira';

  SELECT COALESCE(sum(quantidade), 0)::integer, count(*) > 0
  INTO segunda_count, has_segunda
  FROM public.reunioes_entries
  WHERE month = _month AND tipo = 'segunda';

  UPDATE public.dados_realizados
  SET
    realizado_vendas = CASE WHEN has_sales THEN sales_count ELSE realizado_vendas END,
    realizado_faturamento = CASE WHEN has_sales THEN sales_sum ELSE realizado_faturamento END,
    ticket_realizado = CASE WHEN has_sales THEN sales_avg ELSE ticket_realizado END,
    realizado_primeira_reuniao = CASE WHEN has_primeira THEN primeira_count ELSE realizado_primeira_reuniao END,
    realizado_segunda_reuniao = CASE WHEN has_segunda THEN segunda_count ELSE realizado_segunda_reuniao END,
    updated_at = now()
  WHERE month = _month;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_dados_realizados_from_unit_sales()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_dados_realizados_for_month(COALESCE(NEW.month, OLD.month));
  IF TG_OP = 'UPDATE' AND NEW.month IS DISTINCT FROM OLD.month THEN
    PERFORM public.sync_dados_realizados_for_month(OLD.month);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_dados_realizados_from_reunioes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_dados_realizados_for_month(COALESCE(NEW.month, OLD.month));
  IF TG_OP = 'UPDATE' AND NEW.month IS DISTINCT FROM OLD.month THEN
    PERFORM public.sync_dados_realizados_for_month(OLD.month);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_dados_realizados_after_unit_sales ON public.vendas_unitarias;
CREATE TRIGGER sync_dados_realizados_after_unit_sales
AFTER INSERT OR UPDATE OR DELETE ON public.vendas_unitarias
FOR EACH ROW EXECUTE FUNCTION public.sync_dados_realizados_from_unit_sales();

DROP TRIGGER IF EXISTS sync_dados_realizados_after_reunioes ON public.reunioes_entries;
CREATE TRIGGER sync_dados_realizados_after_reunioes
AFTER INSERT OR UPDATE OR DELETE ON public.reunioes_entries
FOR EACH ROW EXECUTE FUNCTION public.sync_dados_realizados_from_reunioes();

DO $$
DECLARE
  m text;
BEGIN
  FOREACH m IN ARRAY ARRAY['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'] LOOP
    PERFORM public.sync_dados_realizados_for_month(m);
  END LOOP;
END;
$$;