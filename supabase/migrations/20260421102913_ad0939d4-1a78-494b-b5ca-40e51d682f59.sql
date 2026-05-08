
-- 1. Bans table
CREATE TABLE public.user_bans (
  user_id uuid PRIMARY KEY,
  reason text NOT NULL DEFAULT '',
  banned_by uuid NOT NULL,
  banned_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage bans" ON public.user_bans
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users see own ban" ON public.user_bans
  FOR SELECT USING (auth.uid() = user_id);

-- 2. Block banned users from creating orders (replace existing insert policy)
DROP POLICY IF EXISTS "Users create own orders" ON public.orders;
CREATE POLICY "Users create own orders" ON public.orders
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND NOT EXISTS (SELECT 1 FROM public.user_bans WHERE user_id = auth.uid())
  );

-- 3. List all users (admin only)
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz,
  is_admin boolean,
  is_banned boolean,
  ban_reason text,
  credit_balance int,
  total_purchased int,
  total_spent numeric,
  order_count int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::text AS email,
    p.display_name,
    p.avatar_url,
    u.created_at,
    EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'admin') AS is_admin,
    EXISTS (SELECT 1 FROM public.user_bans b WHERE b.user_id = u.id) AS is_banned,
    COALESCE((SELECT b.reason FROM public.user_bans b WHERE b.user_id = u.id), '') AS ban_reason,
    COALESCE(c.balance, 0) AS credit_balance,
    COALESCE(c.total_purchased, 0) AS total_purchased,
    COALESCE((SELECT SUM(o.amount) FROM public.orders o WHERE o.user_id = u.id AND o.status = 'approved'), 0) AS total_spent,
    COALESCE((SELECT COUNT(*)::int FROM public.orders o WHERE o.user_id = u.id), 0) AS order_count
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  LEFT JOIN public.user_credits c ON c.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

-- 4. Adjust credits (positive = add, negative = deduct)
CREATE OR REPLACE FUNCTION public.admin_adjust_credits(
  _user_id uuid,
  _delta int,
  _reason text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _delta = 0 THEN
    RAISE EXCEPTION 'delta must be non-zero';
  END IF;

  -- Ensure row exists
  INSERT INTO public.user_credits (user_id, balance, total_purchased)
  VALUES (_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO current_balance FROM public.user_credits WHERE user_id = _user_id;

  IF current_balance + _delta < 0 THEN
    RAISE EXCEPTION 'insufficient balance: % cannot deduct %', current_balance, _delta;
  END IF;

  UPDATE public.user_credits
  SET balance = balance + _delta,
      total_purchased = total_purchased + GREATEST(_delta, 0),
      updated_at = now()
  WHERE user_id = _user_id;

  -- Log the adjustment as an "approved" order so it shows in history
  INSERT INTO public.orders (
    user_id, package_id, package_name, amount, credits,
    payment_method, status, admin_notes, approved_at, transaction_id
  ) VALUES (
    _user_id,
    gen_random_uuid(),
    CASE WHEN _delta > 0 THEN 'Admin credit (+' || _delta || ')' ELSE 'Admin deduction (' || _delta || ')' END,
    0,
    _delta,
    'bkash', -- placeholder; not a real payment
    'approved',
    COALESCE(NULLIF(_reason, ''), 'Manual adjustment by admin'),
    now(),
    'ADMIN-' || substr(md5(random()::text), 1, 8)
  );
END;
$$;

-- 5. Set role (promote/demote)
CREATE OR REPLACE FUNCTION public.admin_set_role(
  _user_id uuid,
  _make_admin boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _user_id = auth.uid() AND NOT _make_admin THEN
    RAISE EXCEPTION 'cannot demote yourself';
  END IF;

  IF _make_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'admin';
    -- ensure they still have a 'user' role row
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END;
$$;

-- 6. Ban / unban
CREATE OR REPLACE FUNCTION public.admin_set_ban(
  _user_id uuid,
  _ban boolean,
  _reason text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _user_id = auth.uid() AND _ban THEN
    RAISE EXCEPTION 'cannot ban yourself';
  END IF;

  IF _ban THEN
    INSERT INTO public.user_bans (user_id, reason, banned_by)
    VALUES (_user_id, COALESCE(_reason, ''), auth.uid())
    ON CONFLICT (user_id) DO UPDATE SET reason = EXCLUDED.reason, banned_by = auth.uid(), banned_at = now();
  ELSE
    DELETE FROM public.user_bans WHERE user_id = _user_id;
  END IF;
END;
$$;
