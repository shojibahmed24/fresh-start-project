
-- 1) Harden send_notification: only admins (or trigger context with NULL uid) can call directly
CREATE OR REPLACE FUNCTION public.send_notification(
  _user_id uuid,
  _title text,
  _body text DEFAULT ''::text,
  _type text DEFAULT 'info'::text,
  _link text DEFAULT ''::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE nid uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO public.notifications (user_id, title, body, type, link)
  VALUES (_user_id, _title, COALESCE(_body, ''), COALESCE(_type, 'info'), COALESCE(_link, ''))
  RETURNING id INTO nid;
  RETURN nid;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.send_notification(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;

-- 2) Tighten profiles SELECT — drop world-readable policies, allow only own profile + admins
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3) Revoke anon EXECUTE on every public function (keep authenticated for user-facing ones)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, public', r.sig);
  END LOOP;
END $$;

-- Revoke EXECUTE from authenticated on admin-only / internal SECURITY DEFINER funcs
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND (
        p.proname LIKE 'admin\_%' ESCAPE '\'
        OR p.proname IN (
          'log_activity','log_auth_event','log_credit_tx','log_credit_transaction',
          'assign_default_role','handle_new_user','auto_reject_stale_orders',
          'auto_reject_stale_orders_cron','cleanup_ai_cache',
          'create_invoice_on_approval','create_order_flags','credit_on_approval',
          'detect_order_fraud','log_announcement_changes','log_faq_changes',
          'log_order_status_change','log_package_changes'
        )
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated, anon, public', r.sig);
  END LOOP;
END $$;

-- 4) ai_response_cache — RLS enabled but no policy; lock it down to deny all client access
CREATE POLICY "Deny all client access to ai_response_cache"
  ON public.ai_response_cache FOR SELECT TO authenticated, anon
  USING (false);

-- 5) Storage avatars bucket — drop broad listing policies; rely on bucket public-download URLs
DROP POLICY IF EXISTS "Avatar images are publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Avatars readable when path provided" ON storage.objects;

-- Owners can list/read their own avatar objects
CREATE POLICY "Users read own avatar objects"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);
