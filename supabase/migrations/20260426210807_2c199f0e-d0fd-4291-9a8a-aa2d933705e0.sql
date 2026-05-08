UPDATE public.agent_runs
SET status = 'error',
    error_message = COALESCE(error_message, 'Stopped because the previous code-generation worker exceeded the Edge Function window before the timeout fixes were deployed.'),
    finished_at = now(),
    updated_at = now()
WHERE status = 'running'
  AND finished_at IS NULL
  AND started_at < now() - interval '10 minutes';