CREATE TABLE IF NOT EXISTS public.project_error_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_path text NOT NULL DEFAULT '',
  error_message text NOT NULL DEFAULT '',
  error_stack text NOT NULL DEFAULT '',
  fix_summary text NOT NULL DEFAULT '',
  fix_kind text NOT NULL DEFAULT 'auto-heal',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_error_history_project_idx
  ON public.project_error_history (project_id, created_at DESC);

ALTER TABLE public.project_error_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own error history"
  ON public.project_error_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own error history"
  ON public.project_error_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users delete own error history"
  ON public.project_error_history FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.record_project_error(
  _project_id uuid,
  _file_path text,
  _error_message text,
  _error_stack text,
  _fix_summary text,
  _fix_kind text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _new_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = _project_id AND user_id = _uid) THEN
    RAISE EXCEPTION 'project not owned';
  END IF;

  INSERT INTO public.project_error_history(
    project_id, user_id, file_path, error_message, error_stack, fix_summary, fix_kind
  ) VALUES (
    _project_id, _uid,
    COALESCE(_file_path, ''),
    LEFT(COALESCE(_error_message, ''), 1000),
    LEFT(COALESCE(_error_stack, ''), 2000),
    LEFT(COALESCE(_fix_summary, ''), 500),
    COALESCE(_fix_kind, 'auto-heal')
  )
  RETURNING id INTO _new_id;

  DELETE FROM public.project_error_history
  WHERE project_id = _project_id
    AND id NOT IN (
      SELECT id FROM public.project_error_history
      WHERE project_id = _project_id
      ORDER BY created_at DESC
      LIMIT 10
    );

  RETURN _new_id;
END;
$$;