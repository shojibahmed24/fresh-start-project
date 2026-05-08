update public.agent_runs
set status = 'error',
    error_message = 'Run stopped because the previous V2 worker hit the Edge Function time limit before the timeout fix was deployed.',
    finished_at = now(),
    updated_at = now()
where status = 'running'
  and created_at < now() - interval '2 minutes';