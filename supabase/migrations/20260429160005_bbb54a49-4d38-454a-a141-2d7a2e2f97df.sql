ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS projects_pinned_updated_idx ON public.projects (pinned DESC, updated_at DESC);