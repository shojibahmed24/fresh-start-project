UPDATE public.agent_runs
SET status = 'error',
    error_message = COALESCE(error_message, 'Stuck during planner body read — fixed in ai-agent-v2 deployment'),
    finished_at = COALESCE(finished_at, now()),
    updated_at = now()
WHERE status = 'running'
  AND started_at < now() - interval '5 minutes';