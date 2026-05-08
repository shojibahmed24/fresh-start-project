ALTER TABLE public.chat_messages
DROP CONSTRAINT IF EXISTS chat_messages_mode_check;

ALTER TABLE public.chat_messages
ADD CONSTRAINT chat_messages_mode_check
CHECK (mode = ANY (ARRAY['plan'::text, 'agent'::text, 'generate'::text, 'edit'::text, 'chat'::text]));