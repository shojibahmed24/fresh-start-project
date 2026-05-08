CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.agent_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, key)
);

CREATE INDEX idx_agent_memory_project ON public.agent_memory(project_id);

ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read their project memory"
ON public.agent_memory FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = agent_memory.project_id AND p.user_id = auth.uid())
);

CREATE POLICY "Owners can insert project memory"
ON public.agent_memory FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = agent_memory.project_id AND p.user_id = auth.uid())
);

CREATE POLICY "Owners can update project memory"
ON public.agent_memory FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = agent_memory.project_id AND p.user_id = auth.uid())
);

CREATE POLICY "Owners can delete project memory"
ON public.agent_memory FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = agent_memory.project_id AND p.user_id = auth.uid())
);

CREATE TRIGGER agent_memory_set_updated_at
BEFORE UPDATE ON public.agent_memory
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();