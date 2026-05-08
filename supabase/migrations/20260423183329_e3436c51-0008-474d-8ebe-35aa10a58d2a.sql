
-- Build status enum
CREATE TYPE public.build_status AS ENUM ('queued','preparing','building','uploading','ready','failed','cancelled');
CREATE TYPE public.build_platform AS ENUM ('android','ios');

-- Main builds table
CREATE TABLE public.app_builds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  platform public.build_platform NOT NULL DEFAULT 'android',
  status public.build_status NOT NULL DEFAULT 'queued',
  version_name text NOT NULL DEFAULT '1.0.0',
  version_code integer NOT NULL DEFAULT 1,
  app_name text NOT NULL DEFAULT 'My App',
  package_id text NOT NULL DEFAULT 'app.lovable.generated',
  github_run_id text,
  github_run_url text,
  download_url text,
  file_size_bytes bigint,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_builds_project ON public.app_builds(project_id, created_at DESC);
CREATE INDEX idx_app_builds_user ON public.app_builds(user_id, created_at DESC);
CREATE INDEX idx_app_builds_run ON public.app_builds(github_run_id);

-- Step-by-step log
CREATE TABLE public.app_build_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id uuid NOT NULL REFERENCES public.app_builds(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending|running|done|failed|skipped
  detail text,
  step_order integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_build_steps_build ON public.app_build_steps(build_id, step_order);
CREATE UNIQUE INDEX uq_app_build_steps ON public.app_build_steps(build_id, step_key);

-- RLS
ALTER TABLE public.app_builds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_build_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own builds"
  ON public.app_builds FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create own builds"
  ON public.app_builds FOR INSERT
  WITH CHECK (auth.uid() = user_id AND NOT EXISTS (SELECT 1 FROM public.user_bans WHERE user_id = auth.uid()));

CREATE POLICY "Admins manage builds"
  ON public.app_builds FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own build steps"
  ON public.app_build_steps FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.app_builds b WHERE b.id = build_id AND (b.user_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
  );

CREATE POLICY "Admins manage build steps"
  ON public.app_build_steps FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_app_builds_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_app_builds_touch
BEFORE UPDATE ON public.app_builds
FOR EACH ROW EXECUTE FUNCTION public.touch_app_builds_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_builds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_build_steps;
ALTER TABLE public.app_builds REPLICA IDENTITY FULL;
ALTER TABLE public.app_build_steps REPLICA IDENTITY FULL;
