-- 1. Feature flags table (owner-only opt-in)
CREATE TABLE public.feature_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_key TEXT NOT NULL,
  user_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (flag_key, user_id)
);

CREATE INDEX idx_feature_flags_user_key ON public.feature_flags(user_id, flag_key) WHERE enabled = true;

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage feature flags"
ON public.feature_flags FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users view own flags"
ON public.feature_flags FOR SELECT
USING (auth.uid() = user_id);

-- 2. Agent runs (V2 orchestrator top-level execution)
CREATE TABLE public.agent_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  parent_message_id UUID,
  mode TEXT NOT NULL DEFAULT 'edit',
  status TEXT NOT NULL DEFAULT 'pending',
  plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  plan_approved BOOLEAN NOT NULL DEFAULT false,
  model TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  context_summary TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_runs_user_project ON public.agent_runs(user_id, project_id, created_at DESC);
CREATE INDEX idx_agent_runs_status ON public.agent_runs(status) WHERE status IN ('pending', 'running');

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own agent runs"
ON public.agent_runs FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users create own agent runs"
ON public.agent_runs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own agent runs"
ON public.agent_runs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins manage agent runs"
ON public.agent_runs FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Agent run steps (sub-agent / tool calls within a run)
CREATE TABLE public.agent_run_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  step_index INTEGER NOT NULL,
  step_type TEXT NOT NULL,
  agent_name TEXT NOT NULL DEFAULT 'main',
  tool_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  parent_step_id UUID REFERENCES public.agent_run_steps(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_run_steps_run ON public.agent_run_steps(run_id, step_index);
CREATE INDEX idx_agent_run_steps_user ON public.agent_run_steps(user_id, created_at DESC);

ALTER TABLE public.agent_run_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own steps"
ON public.agent_run_steps FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users create own steps"
ON public.agent_run_steps FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own steps"
ON public.agent_run_steps FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins manage steps"
ON public.agent_run_steps FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. updated_at triggers
CREATE TRIGGER trg_feature_flags_updated_at
BEFORE UPDATE ON public.feature_flags
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_agent_runs_updated_at
BEFORE UPDATE ON public.agent_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Helper function: check if user has a feature flag enabled
CREATE OR REPLACE FUNCTION public.has_feature_flag(_user_id UUID, _flag_key TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.feature_flags
    WHERE user_id = _user_id
      AND flag_key = _flag_key
      AND enabled = true
  );
$$;

-- 6. Auto-enable orchestrator_v2 for all current admin users (owner included)
INSERT INTO public.feature_flags (flag_key, user_id, enabled, metadata)
SELECT 'orchestrator_v2', ur.user_id, true, '{"auto_enabled": true, "reason": "admin_owner"}'::jsonb
FROM public.user_roles ur
WHERE ur.role = 'admin'
ON CONFLICT (flag_key, user_id) DO NOTHING;