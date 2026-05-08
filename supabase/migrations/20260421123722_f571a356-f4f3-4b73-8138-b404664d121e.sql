-- Cron-safe version of auto_reject_stale_orders (no admin check, runs as definer)
CREATE OR REPLACE FUNCTION public.auto_reject_stale_orders_cron()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s public.app_settings%ROWTYPE;
  n int;
BEGIN
  SELECT * INTO s FROM public.app_settings WHERE id = true;
  IF COALESCE(s.order_auto_reject_days, 0) <= 0 THEN
    RETURN 0;
  END IF;
  UPDATE public.orders
  SET status = 'rejected',
      admin_notes = COALESCE(NULLIF(admin_notes,''), 'Auto-rejected: not approved within ' || s.order_auto_reject_days || ' days'),
      updated_at = now()
  WHERE status = 'pending'
    AND created_at < now() - (s.order_auto_reject_days || ' days')::interval;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$function$;

-- Unschedule if it already exists, then schedule daily at 20:00 UTC = 2:00 AM Bangladesh time
DO $$
BEGIN
  PERFORM cron.unschedule('auto-reject-stale-orders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'auto-reject-stale-orders',
  '0 20 * * *',
  $$SELECT public.auto_reject_stale_orders_cron()$$
);