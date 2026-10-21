-- RT Meet — como o lead chegou até a reunião (pedido do Allan depois da 1ª reunião).
--
-- Muda toda a conversa: no inbound o lead pediu (pergunte o que motivou); no
-- outbound fomos nós que procuramos (é preciso criar interesse). O Coach lê
-- este campo a cada dica. Pode ser escolhido no agendamento ou dentro da sala.
ALTER TABLE public.reunioes_salas
  ADD COLUMN IF NOT EXISTS abordagem text
  CHECK (abordagem IN ('inbound', 'outbound', 'indicacao', 'cliente'));

-- Quem agendou pelo site preencheu o diagnóstico: é inbound.
UPDATE public.reunioes_salas SET abordagem = 'inbound'
WHERE abordagem IS NULL AND origem ILIKE '%site%';
