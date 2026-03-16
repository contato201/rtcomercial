-- Publicar leitura do dashboard para visitantes do site
-- Mantém escrita restrita ao editor autorizado

CREATE POLICY "Anyone can view agendamentos publicly"
ON public.agendamentos
FOR SELECT
TO public
USING (true);

CREATE POLICY "Anyone can view reunioes_entries publicly"
ON public.reunioes_entries
FOR SELECT
TO public
USING (true);

CREATE POLICY "Anyone can view vendas_unitarias publicly"
ON public.vendas_unitarias
FOR SELECT
TO public
USING (true);