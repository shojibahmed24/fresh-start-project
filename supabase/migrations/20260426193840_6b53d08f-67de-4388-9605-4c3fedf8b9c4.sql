UPDATE public.agent_runs
SET status = 'error',
    error_message = COALESCE(error_message, 'Run stopped because the previous executor stream stalled before this fix was deployed.'),
    finished_at = COALESCE(finished_at, now()),
    updated_at = now()
WHERE status = 'running'
  AND started_at < now() - interval '5 minutes';