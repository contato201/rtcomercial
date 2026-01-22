-- Restringe escrita (INSERT/UPDATE) para o email autorizado, mantendo leitura pública

-- dados_realizados
DROP POLICY IF EXISTS "Anyone can insert dados_realizados" ON public.dados_realizados;
DROP POLICY IF EXISTS "Anyone can update dados_realizados" ON public.dados_realizados;

CREATE POLICY "Authorized editor can insert dados_realizados"
ON public.dados_realizados
FOR INSERT
WITH CHECK ( (auth.jwt() ->> 'email') = 'contato@allancatao.com.br' );

CREATE POLICY "Authorized editor can update dados_realizados"
ON public.dados_realizados
FOR UPDATE
USING ( (auth.jwt() ->> 'email') = 'contato@allancatao.com.br' );

-- historico_alteracoes
DROP POLICY IF EXISTS "Anyone can insert historico_alteracoes" ON public.historico_alteracoes;

CREATE POLICY "Authorized editor can insert historico_alteracoes"
ON public.historico_alteracoes
FOR INSERT
WITH CHECK ( (auth.jwt() ->> 'email') = 'contato@allancatao.com.br' );