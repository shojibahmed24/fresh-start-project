ALTER TABLE public.project_plans
  ADD COLUMN IF NOT EXISTS run_id text,
  ADD COLUMN IF NOT EXISTS run_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS pending_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS completed_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_completed_path text,
  ADD COLUMN IF NOT EXISTS last_checkpoint_at timestamptz;

CREATE INDEX IF NOT EXISTS project_plans_run_status_idx ON public.project_plans(run_status);