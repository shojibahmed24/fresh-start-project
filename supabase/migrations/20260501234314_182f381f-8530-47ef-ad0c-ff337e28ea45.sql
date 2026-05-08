ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_chat_messages_project_created
  ON public.chat_messages (project_id, created_at);