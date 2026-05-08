-- Backend continuation state for the AI agent.
CREATE TABLE public.agent_turn_continuations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  model TEXT NOT NULL,
  conversation JSONB NOT NULL,
  files_changed JSONB NOT NULL DEFAULT '[]'::jsonb,
  attempt INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_turn_continuations_project ON public.agent_turn_continuations(project_id, created_at DESC);
CREATE INDEX idx_agent_turn_continuations_user ON public.agent_turn_continuations(user_id, created_at DESC);

ALTER TABLE public.agent_turn_continuations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own continuations"
  ON public.agent_turn_continuations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own continuations"
  ON public.agent_turn_continuations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own continuations"
  ON public.agent_turn_continuations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_agent_turn_continuations_updated_at
  BEFORE UPDATE ON public.agent_turn_continuations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per-event stream so the client can subscribe via Realtime instead of SSE.
CREATE TABLE public.agent_turn_events (
  id BIGSERIAL PRIMARY KEY,
  continuation_id UUID NOT NULL REFERENCES public.agent_turn_continuations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  seq INTEGER NOT NULL,
  event JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_turn_events_continuation ON public.agent_turn_events(continuation_id, seq);

ALTER TABLE public.agent_turn_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own turn events"
  ON public.agent_turn_events FOR SELECT
  USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_turn_events;
ALTER TABLE public.agent_turn_events REPLICA IDENTITY FULL;