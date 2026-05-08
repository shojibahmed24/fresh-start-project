-- =========================================
-- 1. CREDIT TRANSACTIONS LOG
-- =========================================
CREATE TYPE public.credit_source AS ENUM ('purchase', 'admin_gift', 'admin_deduct', 'refund', 'ai_usage', 'promo_bonus', 'signup_bonus');

CREATE TABLE public.credit_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  source public.credit_source NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  reference_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_tx_user ON public.credit_transactions(user_id, created_at DESC);
CREATE INDEX idx_credit_tx_source ON public.credit_transactions(source);
CREATE INDEX idx_credit_tx_created ON public.credit_transactions(created_at DESC);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own transactions"
ON public.credit_transactions FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage transactions"
ON public.credit_transactions FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Helper: log a credit transaction (called from triggers/functions)
CREATE OR REPLACE FUNCTION public.log_credit_tx(
  _user_id UUID,
  _delta INTEGER,
  _source public.credit_source,
  _reason TEXT DEFAULT '',
  _reference_id UUID DEFAULT NULL,
  _created_by UUID DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  SELECT balance INTO new_balance FROM public.user_credits WHERE user_id = _user_id;
  INSERT INTO public.credit_transactions (user_id, delta, balance_after, source, reason, reference_id, created_by)
  VALUES (_user_id, _delta, COALESCE(new_balance, 0), _source, COALESCE(_reason, ''), _reference_id, _created_by);
END;
$$;

-- Update credit_on_approval trigger to log
CREATE OR REPLACE FUNCTION public.credit_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    NEW.approved_at := now();
    INSERT INTO public.user_credits (user_id, balance, total_purchased)
    VALUES (NEW.user_id, NEW.credits, NEW.credits)
    ON CONFLICT (user_id) DO UPDATE
      SET balance = public.user_credits.balance + NEW.credits,
          total_purchased = public.user_credits.total_purchased + NEW.credits,
          updated_at = now();
    -- Log transaction
    PERFORM public.log_credit_tx(
      NEW.user_id,
      NEW.credits,
      CASE WHEN NEW.package_name LIKE 'Admin %' THEN 'admin_gift'::public.credit_source ELSE 'purchase'::public.credit_source END,
      'Order ' || NEW.id::text,
      NEW.id,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Update admin_adjust_credits to log
CREATE OR REPLACE FUNCTION public.admin_adjust_credits(_user_id uuid, _delta integer, _reason text DEFAULT ''::text)
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

  -- Log directly (skip the placeholder order insert to avoid double-logging via trigger)
  PERFORM public.log_credit_tx(
    _user_id,
    _delta,
    CASE WHEN _delta > 0 THEN 'admin_gift'::public.credit_source ELSE 'admin_deduct'::public.credit_source END,
    COALESCE(NULLIF(_reason, ''), 'Manual adjustment by admin'),
    NULL,
    auth.uid()
  );
END;
$$;

-- AI usage deduction (callable from edge functions / app)
CREATE OR REPLACE FUNCTION public.consume_credits(_amount integer, _reason text DEFAULT 'AI usage')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance int;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;

  SELECT balance INTO current_balance FROM public.user_credits WHERE user_id = uid FOR UPDATE;
  IF current_balance IS NULL OR current_balance < _amount THEN
    RAISE EXCEPTION 'insufficient credits';
  END IF;

  UPDATE public.user_credits
  SET balance = balance - _amount, updated_at = now()
  WHERE user_id = uid;

  PERFORM public.log_credit_tx(uid, -_amount, 'ai_usage'::public.credit_source, _reason, NULL, uid);
  RETURN current_balance - _amount;
END;
$$;

-- =========================================
-- 2. PROMO CODES
-- =========================================
CREATE TYPE public.promo_discount_type AS ENUM ('percent', 'flat');

CREATE TABLE public.promo_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  discount_type public.promo_discount_type NOT NULL,
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
  min_amount NUMERIC NOT NULL DEFAULT 0,
  max_discount NUMERIC,
  usage_limit INTEGER,
  per_user_limit INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  applicable_package_ids UUID[] NOT NULL DEFAULT '{}',
  bonus_credits INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_promo_code ON public.promo_codes(code);
CREATE INDEX idx_promo_active ON public.promo_codes(is_active, expires_at);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated views active promos"
ON public.promo_codes FOR SELECT
TO authenticated
USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage promos"
ON public.promo_codes FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_promo_codes_updated_at
BEFORE UPDATE ON public.promo_codes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Promo redemptions (per-user tracking)
CREATE TABLE public.promo_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promo_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  order_id UUID,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  bonus_credits INTEGER NOT NULL DEFAULT 0,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_promo_red_user ON public.promo_redemptions(user_id);
CREATE INDEX idx_promo_red_promo ON public.promo_redemptions(promo_id);

ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own redemptions"
ON public.promo_redemptions FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage redemptions"
ON public.promo_redemptions FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add promo fields to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS promo_code TEXT,
  ADD COLUMN IF NOT EXISTS promo_discount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_bonus_credits INTEGER NOT NULL DEFAULT 0;

-- Validate & compute promo (read-only check)
CREATE OR REPLACE FUNCTION public.validate_promo(_code TEXT, _package_id UUID, _amount NUMERIC)
RETURNS TABLE(
  promo_id UUID,
  discount_amount NUMERIC,
  bonus_credits INTEGER,
  final_amount NUMERIC,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.promo_codes%ROWTYPE;
  uid uuid := auth.uid();
  user_uses INTEGER;
  disc NUMERIC := 0;
BEGIN
  IF uid IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, 0::numeric, 0, _amount, 'Login required'::text; RETURN;
  END IF;

  SELECT * INTO p FROM public.promo_codes WHERE upper(code) = upper(_code);
  IF NOT FOUND OR NOT p.is_active THEN
    RETURN QUERY SELECT NULL::uuid, 0::numeric, 0, _amount, 'Invalid code'::text; RETURN;
  END IF;

  IF p.starts_at > now() THEN
    RETURN QUERY SELECT NULL::uuid, 0::numeric, 0, _amount, 'Code not yet active'::text; RETURN;
  END IF;
  IF p.expires_at IS NOT NULL AND p.expires_at < now() THEN
    RETURN QUERY SELECT NULL::uuid, 0::numeric, 0, _amount, 'Code expired'::text; RETURN;
  END IF;
  IF p.usage_limit IS NOT NULL AND p.used_count >= p.usage_limit THEN
    RETURN QUERY SELECT NULL::uuid, 0::numeric, 0, _amount, 'Code usage limit reached'::text; RETURN;
  END IF;
  IF _amount < p.min_amount THEN
    RETURN QUERY SELECT NULL::uuid, 0::numeric, 0, _amount, 'Minimum amount ৳' || p.min_amount || ' required'; RETURN;
  END IF;
  IF array_length(p.applicable_package_ids, 1) > 0 AND NOT (_package_id = ANY(p.applicable_package_ids)) THEN
    RETURN QUERY SELECT NULL::uuid, 0::numeric, 0, _amount, 'Code not applicable for this package'::text; RETURN;
  END IF;

  SELECT COUNT(*) INTO user_uses FROM public.promo_redemptions WHERE promo_id = p.id AND user_id = uid;
  IF user_uses >= p.per_user_limit THEN
    RETURN QUERY SELECT NULL::uuid, 0::numeric, 0, _amount, 'You have already used this code'::text; RETURN;
  END IF;

  IF p.discount_type = 'percent' THEN
    disc := round(_amount * (p.discount_value / 100.0), 2);
  ELSE
    disc := p.discount_value;
  END IF;

  IF p.max_discount IS NOT NULL AND disc > p.max_discount THEN
    disc := p.max_discount;
  END IF;
  IF disc > _amount THEN disc := _amount; END IF;

  RETURN QUERY SELECT p.id, disc, p.bonus_credits, GREATEST(_amount - disc, 0), 'Applied'::text;
END;
$$;

-- Redeem promo (called when admin approves an order with a promo)
CREATE OR REPLACE FUNCTION public.redeem_promo_for_order(_order_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders%ROWTYPE;
  p public.promo_codes%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id;
  IF NOT FOUND OR o.promo_code IS NULL OR o.promo_code = '' THEN RETURN; END IF;

  SELECT * INTO p FROM public.promo_codes WHERE upper(code) = upper(o.promo_code);
  IF NOT FOUND THEN RETURN; END IF;

  -- Insert redemption (idempotent guard)
  IF NOT EXISTS (SELECT 1 FROM public.promo_redemptions WHERE order_id = _order_id) THEN
    INSERT INTO public.promo_redemptions (promo_id, user_id, order_id, discount_amount, bonus_credits)
    VALUES (p.id, o.user_id, o.id, o.promo_discount, o.promo_bonus_credits);

    UPDATE public.promo_codes SET used_count = used_count + 1 WHERE id = p.id;

    -- Award bonus credits if any
    IF o.promo_bonus_credits > 0 THEN
      UPDATE public.user_credits
      SET balance = balance + o.promo_bonus_credits,
          total_purchased = total_purchased + o.promo_bonus_credits,
          updated_at = now()
      WHERE user_id = o.user_id;
      PERFORM public.log_credit_tx(o.user_id, o.promo_bonus_credits, 'promo_bonus'::public.credit_source,
        'Promo ' || p.code || ' bonus', o.id, NULL);
    END IF;
  END IF;
END;
$$;

-- Trigger: on order approval, redeem promo
CREATE OR REPLACE FUNCTION public.promo_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved')
     AND NEW.promo_code IS NOT NULL AND NEW.promo_code <> '' THEN
    PERFORM public.redeem_promo_for_order(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promo_on_approval ON public.orders;
CREATE TRIGGER trg_promo_on_approval
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.promo_on_approval();

-- Admin: list transactions with filters
CREATE OR REPLACE FUNCTION public.admin_list_credit_transactions(
  _user_id UUID DEFAULT NULL,
  _source public.credit_source DEFAULT NULL,
  _from TIMESTAMPTZ DEFAULT NULL,
  _to TIMESTAMPTZ DEFAULT NULL,
  _limit INTEGER DEFAULT 500
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  email TEXT,
  display_name TEXT,
  delta INTEGER,
  balance_after INTEGER,
  source public.credit_source,
  reason TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT t.id, t.user_id, u.email::text, p.display_name, t.delta, t.balance_after,
         t.source, t.reason, t.reference_id, t.created_at
  FROM public.credit_transactions t
  LEFT JOIN auth.users u ON u.id = t.user_id
  LEFT JOIN public.profiles p ON p.user_id = t.user_id
  WHERE (_user_id IS NULL OR t.user_id = _user_id)
    AND (_source IS NULL OR t.source = _source)
    AND (_from IS NULL OR t.created_at >= _from)
    AND (_to IS NULL OR t.created_at <= _to)
  ORDER BY t.created_at DESC
  LIMIT COALESCE(_limit, 500);
END;
$$;