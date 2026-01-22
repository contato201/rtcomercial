-- Fix PUBLIC_DATA_EXPOSURE on agendamentos table
-- Drop the public read policy
DROP POLICY IF EXISTS "Anyone can view agendamentos" ON public.agendamentos;

-- Create authenticated-only policy (matches the project's permission model)
CREATE POLICY "Authenticated users can view agendamentos"
ON public.agendamentos
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Fix PUBLIC_DATA_EXPOSURE on dados_trafego table
-- Drop the public read policy  
DROP POLICY IF EXISTS "Anyone can view dados_trafego" ON public.dados_trafego;

-- Create authenticated-only policy
CREATE POLICY "Authenticated users can view dados_trafego"
ON public.dados_trafego
FOR SELECT
USING (auth.uid() IS NOT NULL);