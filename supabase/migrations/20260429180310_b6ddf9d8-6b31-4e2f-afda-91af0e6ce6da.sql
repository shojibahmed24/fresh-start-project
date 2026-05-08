-- Admin preference: which agent version to use (v1 or v2).
-- Stored as a feature flag row with key 'prefer_agent_v2'.
-- Reuses the existing feature_flags table — no schema change needed.
-- We just seed/document the convention via this no-op migration block.

-- Helper RPC: set the current admin's agent version preference.
-- Non-admins cannot set it (RLS-style guard inside).
CREATE OR REPLACE FUNCTION public.set_agent_version_preference(_use_v2 boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  INSERT INTO public.feature_flags (user_id, flag_key, enabled, metadata)
  VALUES (uid, 'prefer_agent_v2', _use_v2, '{}'::jsonb)
  ON CONFLICT (user_id, flag_key)
  DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();
END;
$$;

-- Helper RPC: read current user's agent version preference.
-- Any authenticated user can call; non-admins always get false.
CREATE OR REPLACE FUNCTION public.get_agent_version_preference()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  pref boolean;
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  IF NOT public.has_role(uid, 'admin') THEN RETURN false; END IF;

  SELECT enabled INTO pref
  FROM public.feature_flags
  WHERE user_id = uid AND flag_key = 'prefer_agent_v2';

  RETURN COALESCE(pref, false);
END;
$$;