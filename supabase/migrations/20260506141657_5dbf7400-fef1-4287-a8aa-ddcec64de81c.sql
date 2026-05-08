-- Admin ban / unban user RPCs with audit logging.
-- Both check admin role via has_role(); inserting a row into user_bans
-- triggers downstream policies (Users can't create orders/builds/tickets).

CREATE OR REPLACE FUNCTION public.admin_ban_user(
  _user_id uuid,
  _reason text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin uuid := auth.uid();
  _email text;
BEGIN
  IF NOT has_role(_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  INSERT INTO public.user_bans (user_id, banned_by, reason)
  VALUES (_user_id, _admin, COALESCE(_reason, ''))
  ON CONFLICT (user_id) DO UPDATE
    SET banned_by = EXCLUDED.banned_by,
        reason    = EXCLUDED.reason,
        banned_at = now();

  SELECT email INTO _email FROM auth.users WHERE id = _admin;

  INSERT INTO public.activity_logs (
    actor_id, actor_email, actor_role,
    action, target_type, target_id,
    summary, severity, metadata
  ) VALUES (
    _admin, _email, 'admin',
    'user.ban', 'user', _user_id::text,
    'Admin banned user' ||
      CASE WHEN _reason <> '' THEN ' — ' || _reason ELSE '' END,
    'critical',
    jsonb_build_object('reason', _reason)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unban_user(
  _user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin uuid := auth.uid();
  _email text;
BEGIN
  IF NOT has_role(_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.user_bans WHERE user_id = _user_id;

  SELECT email INTO _email FROM auth.users WHERE id = _admin;

  INSERT INTO public.activity_logs (
    actor_id, actor_email, actor_role,
    action, target_type, target_id,
    summary, severity
  ) VALUES (
    _admin, _email, 'admin',
    'user.unban', 'user', _user_id::text,
    'Admin removed ban from user',
    'warn'
  );
END;
$$;

-- Add unique constraint so ON CONFLICT works (idempotent ban)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_bans_user_id_unique'
  ) THEN
    -- Only add if not already unique. user_bans currently has no PK on user_id.
    BEGIN
      ALTER TABLE public.user_bans ADD CONSTRAINT user_bans_user_id_unique UNIQUE (user_id);
    EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
    END;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_ban_user(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_unban_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unban_user(uuid) TO authenticated;