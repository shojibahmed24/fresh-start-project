-- Store user's connected Supabase accounts (encrypted OAuth tokens)
CREATE TABLE public.user_supabase_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  -- Encrypted OAuth tokens (AES-GCM via edge function)
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  -- Metadata about the connected account
  supabase_user_id TEXT,
  supabase_email TEXT,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.user_supabase_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own supabase connection"
ON public.user_supabase_connections
FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users delete own supabase connection"
ON public.user_supabase_connections
FOR DELETE
USING (auth.uid() = user_id);

-- INSERT/UPDATE only via edge function (service role) — no user policies for those.

CREATE TRIGGER update_user_supabase_connections_updated_at
BEFORE UPDATE ON public.user_supabase_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link a builder project to a specific Supabase project
CREATE TABLE public.project_supabase_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  supabase_project_ref TEXT NOT NULL,
  supabase_project_name TEXT NOT NULL DEFAULT '',
  supabase_org_id TEXT,
  supabase_region TEXT,
  -- Cached project keys (encrypted)
  anon_key_encrypted TEXT,
  service_role_key_encrypted TEXT,
  api_url TEXT,
  -- Cached schema introspection
  schema_cache JSONB NOT NULL DEFAULT '{}'::jsonb,
  schema_cached_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id)
);

ALTER TABLE public.project_supabase_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own project links"
ON public.project_supabase_links
FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users delete own project links"
ON public.project_supabase_links
FOR DELETE
USING (auth.uid() = user_id);

-- INSERT/UPDATE only via edge function (service role).

CREATE TRIGGER update_project_supabase_links_updated_at
BEFORE UPDATE ON public.project_supabase_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit log of operations performed on user's Supabase project via OAuth
CREATE TABLE public.supabase_operation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  supabase_project_ref TEXT,
  operation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  request_summary TEXT NOT NULL DEFAULT '',
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supabase_operation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own supabase op logs"
ON public.supabase_operation_logs
FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_supabase_operation_logs_user ON public.supabase_operation_logs(user_id, created_at DESC);
CREATE INDEX idx_supabase_operation_logs_project ON public.supabase_operation_logs(project_id, created_at DESC);
CREATE INDEX idx_project_supabase_links_user ON public.project_supabase_links(user_id);