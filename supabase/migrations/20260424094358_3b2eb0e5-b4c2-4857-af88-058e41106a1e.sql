-- 1. AI response cache (service-role only)
CREATE TABLE public.ai_response_cache (
  cache_key text PRIMARY KEY,
  model text NOT NULL,
  response jsonb NOT NULL,
  hit_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_hit_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX idx_ai_cache_expires ON public.ai_response_cache(expires_at);

ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;
-- No policies = no client access. Edge functions use service role to bypass RLS.

-- 2. Project memory (per-project lessons learned)
CREATE TABLE public.project_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'preference',
  content text NOT NULL,
  source text NOT NULL DEFAULT 'auto',
  weight integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_memory_project ON public.project_memory(project_id, created_at DESC);
CREATE UNIQUE INDEX idx_project_memory_dedup ON public.project_memory(project_id, lower(content));

ALTER TABLE public.project_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own project memory"
  ON public.project_memory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users insert own project memory"
  ON public.project_memory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own project memory"
  ON public.project_memory FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "users delete own project memory"
  ON public.project_memory FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER project_memory_touch
  BEFORE UPDATE ON public.project_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cleanup function for expired cache entries (cron-safe, idempotent)
CREATE OR REPLACE FUNCTION public.cleanup_ai_cache()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  DELETE FROM public.ai_response_cache WHERE expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;