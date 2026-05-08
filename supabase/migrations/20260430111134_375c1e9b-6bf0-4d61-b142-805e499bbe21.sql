ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS chat_mode text NOT NULL DEFAULT 'agent'
  CHECK (chat_mode IN ('agent', 'plan'));