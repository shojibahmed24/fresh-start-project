-- =========================================================
-- FRAUD DETECTION
-- =========================================================

-- Track submission origin on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS device_fingerprint text,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS risk_score int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_orders_transaction_id ON public.orders (transaction_id) WHERE transaction_id IS NOT NULL AND transaction_id <> '';
CREATE INDEX IF NOT EXISTS idx_orders_sender_account ON public.orders (sender_account) WHERE sender_account IS NOT NULL AND sender_account <> '';
CREATE INDEX IF NOT EXISTS idx_orders_ip_address ON public.orders (ip_address) WHERE ip_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_needs_review ON public.orders (needs_review) WHERE needs_review = true;

-- Flag types enum
DO $$ BEGIN
  CREATE TYPE public.fraud_flag_type AS ENUM (
    'duplicate_txid', 'repeat_account', 'repeat_ip', 'velocity',
    'banned_user', 'mismatched_account', 'high_risk_score'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Flags table
CREATE TABLE IF NOT EXISTS public.order_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  user_id uuid NOT NULL,
  flag_type public.fraud_flag_type NOT NULL,
  severity public.activity_severity NOT NULL DEFAULT 'warn',
  reason text NOT NULL DEFAULT '',
  details jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_flags_order ON public.order_flags (order_id);
CREATE INDEX IF NOT EXISTS idx_order_flags_user ON public.order_flags (user_id);
CREATE INDEX IF NOT EXISTS idx_order_flags_resolved ON public.order_flags (resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_flags_type ON public.order_flags (flag_type);

ALTER TABLE public.order_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view flags" ON public.order_flags;
CREATE POLICY "Admins view flags"
  ON public.order_flags FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update flags" ON public.order_flags;
CREATE POLICY "Admins update flags"
  ON public.order_flags FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Inserts happen via SECURITY DEFINER trigger, no insert policy needed for clients

-- =========================================================
-- TRIGGER: detect_order_fraud (BEFORE INSERT)
-- =========================================================
CREATE OR REPLACE FUNCTION public.detect_order_fraud()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  dup_count int;
  account_count int;
  ip_count int;
  velocity_count int;
  is_banned boolean;
  score int := 0;
  flags_added int := 0;
BEGIN
  -- 1. Banned user check
  SELECT EXISTS(SELECT 1 FROM public.user_bans WHERE user_id = NEW.user_id) INTO is_banned;
  IF is_banned THEN
    score := score + 100;
    NEW.needs_review := true;
  END IF;

  -- 2. Duplicate transaction_id (across ALL orders, regardless of user)
  IF NEW.transaction_id IS NOT NULL AND NEW.transaction_id <> '' THEN
    SELECT count(*) INTO dup_count
    FROM public.orders
    WHERE transaction_id = NEW.transaction_id;
    IF dup_count > 0 THEN
      score := score + 80;
      NEW.needs_review := true;
    END IF;
  END IF;

  -- 3. Same sender_account: 3+ orders in 24h
  IF NEW.sender_account IS NOT NULL AND NEW.sender_account <> '' THEN
    SELECT count(*) INTO account_count
    FROM public.orders
    WHERE sender_account = NEW.sender_account
      AND created_at > now() - interval '24 hours';
    IF account_count >= 3 THEN
      score := score + 30;
      NEW.needs_review := true;
    END IF;
  END IF;

  -- 4. Same IP: 5+ orders in 24h across users
  IF NEW.ip_address IS NOT NULL AND NEW.ip_address <> '' THEN
    SELECT count(DISTINCT user_id) INTO ip_count
    FROM public.orders
    WHERE ip_address = NEW.ip_address
      AND created_at > now() - interval '24 hours';
    IF ip_count >= 3 THEN
      score := score + 40;
      NEW.needs_review := true;
    END IF;
  END IF;

  -- 5. Velocity: same user 5+ orders in 1h
  SELECT count(*) INTO velocity_count
  FROM public.orders
  WHERE user_id = NEW.user_id
    AND created_at > now() - interval '1 hour';
  IF velocity_count >= 5 THEN
    score := score + 25;
    NEW.needs_review := true;
  END IF;

  NEW.risk_score := score;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_detect_order_fraud ON public.orders;
CREATE TRIGGER trg_detect_order_fraud
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.detect_order_fraud();

-- =========================================================
-- TRIGGER: create_order_flags (AFTER INSERT)
-- =========================================================
CREATE OR REPLACE FUNCTION public.create_order_flags()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  dup_count int;
  account_count int;
  ip_count int;
  velocity_count int;
  is_banned boolean;
  prev_order_id uuid;
BEGIN
  -- Banned user
  SELECT EXISTS(SELECT 1 FROM public.user_bans WHERE user_id = NEW.user_id) INTO is_banned;
  IF is_banned THEN
    INSERT INTO public.order_flags (order_id, user_id, flag_type, severity, reason)
    VALUES (NEW.id, NEW.user_id, 'banned_user', 'critical',
      'Banned user attempted to place order');
  END IF;

  -- Duplicate txid
  IF NEW.transaction_id IS NOT NULL AND NEW.transaction_id <> '' THEN
    SELECT count(*) INTO dup_count FROM public.orders
    WHERE transaction_id = NEW.transaction_id AND id <> NEW.id;
    IF dup_count > 0 THEN
      SELECT id INTO prev_order_id FROM public.orders
      WHERE transaction_id = NEW.transaction_id AND id <> NEW.id
      ORDER BY created_at DESC LIMIT 1;
      INSERT INTO public.order_flags (order_id, user_id, flag_type, severity, reason, details)
      VALUES (NEW.id, NEW.user_id, 'duplicate_txid', 'critical',
        'Transaction ID "' || NEW.transaction_id || '" already used in ' || dup_count || ' other order(s)',
        jsonb_build_object('previous_order_id', prev_order_id, 'duplicate_count', dup_count));
    END IF;
  END IF;

  -- Repeat account
  IF NEW.sender_account IS NOT NULL AND NEW.sender_account <> '' THEN
    SELECT count(*) INTO account_count FROM public.orders
    WHERE sender_account = NEW.sender_account
      AND created_at > now() - interval '24 hours' AND id <> NEW.id;
    IF account_count >= 2 THEN
      INSERT INTO public.order_flags (order_id, user_id, flag_type, severity, reason, details)
      VALUES (NEW.id, NEW.user_id, 'repeat_account', 'warn',
        'Sender account ' || NEW.sender_account || ' used in ' || (account_count + 1) || ' orders in 24h',
        jsonb_build_object('sender_account', NEW.sender_account, 'count_24h', account_count + 1));
    END IF;
  END IF;

  -- Repeat IP across users
  IF NEW.ip_address IS NOT NULL AND NEW.ip_address <> '' THEN
    SELECT count(DISTINCT user_id) INTO ip_count FROM public.orders
    WHERE ip_address = NEW.ip_address
      AND created_at > now() - interval '24 hours';
    IF ip_count >= 3 THEN
      INSERT INTO public.order_flags (order_id, user_id, flag_type, severity, reason, details)
      VALUES (NEW.id, NEW.user_id, 'repeat_ip', 'warn',
        'IP ' || NEW.ip_address || ' used by ' || ip_count || ' different users in 24h',
        jsonb_build_object('ip', NEW.ip_address, 'distinct_users_24h', ip_count));
    END IF;
  END IF;

  -- Velocity
  SELECT count(*) INTO velocity_count FROM public.orders
  WHERE user_id = NEW.user_id
    AND created_at > now() - interval '1 hour' AND id <> NEW.id;
  IF velocity_count >= 4 THEN
    INSERT INTO public.order_flags (order_id, user_id, flag_type, severity, reason, details)
    VALUES (NEW.id, NEW.user_id, 'velocity', 'warn',
      'User submitted ' || (velocity_count + 1) || ' orders in 1 hour',
      jsonb_build_object('count_1h', velocity_count + 1));
  END IF;

  -- High composite risk
  IF NEW.risk_score >= 80 THEN
    INSERT INTO public.order_flags (order_id, user_id, flag_type, severity, reason, details)
    VALUES (NEW.id, NEW.user_id, 'high_risk_score', 'critical',
      'High risk score: ' || NEW.risk_score,
      jsonb_build_object('risk_score', NEW.risk_score));
  END IF;

  -- Mirror to activity log + notify admins if any flag was raised
  IF NEW.needs_review THEN
    PERFORM public.log_activity(
      'order.flagged', 'order', NEW.id::text,
      'Order flagged for review (risk ' || NEW.risk_score || ') — ' || NEW.package_name || ' ৳' || NEW.amount,
      NULL,
      jsonb_build_object('risk_score', NEW.risk_score, 'amount', NEW.amount, 'user_id', NEW.user_id),
      CASE WHEN NEW.risk_score >= 80 THEN 'critical'::activity_severity ELSE 'warn'::activity_severity END,
      jsonb_build_object('ip', NEW.ip_address, 'transaction_id', NEW.transaction_id)
    );

    -- Notify admins
    INSERT INTO public.notifications (user_id, title, body, type, link)
    SELECT r.user_id,
      '🚨 Order flagged for review',
      'Order ' || NEW.package_name || ' (৳' || NEW.amount || ') flagged. Risk score: ' || NEW.risk_score,
      'warning',
      '/admin/activity'
    FROM public.user_roles r WHERE r.role = 'admin';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_order_flags ON public.orders;
CREATE TRIGGER trg_create_order_flags
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.create_order_flags();

-- =========================================================
-- RPC: admin_list_flagged_orders
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_list_flagged_orders(
  _resolved boolean DEFAULT false,
  _limit int DEFAULT 200
)
RETURNS TABLE (
  order_id uuid,
  user_id uuid,
  user_email text,
  display_name text,
  package_name text,
  amount numeric,
  status order_status,
  payment_method payment_method_type,
  sender_account text,
  transaction_id text,
  ip_address text,
  risk_score int,
  needs_review boolean,
  created_at timestamptz,
  flag_count bigint,
  flag_types text[],
  max_severity activity_severity,
  flags jsonb
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  RETURN QUERY
  SELECT
    o.id, o.user_id, u.email::text, p.display_name,
    o.package_name, o.amount, o.status, o.payment_method,
    o.sender_account, o.transaction_id, o.ip_address,
    o.risk_score, o.needs_review, o.created_at,
    count(f.id) AS flag_count,
    array_agg(f.flag_type::text ORDER BY f.created_at) AS flag_types,
    max(f.severity)::activity_severity AS max_severity,
    jsonb_agg(jsonb_build_object(
      'id', f.id,
      'type', f.flag_type,
      'severity', f.severity,
      'reason', f.reason,
      'details', f.details,
      'resolved', f.resolved,
      'resolved_at', f.resolved_at,
      'resolution_note', f.resolution_note,
      'created_at', f.created_at
    ) ORDER BY f.created_at) AS flags
  FROM public.orders o
  JOIN public.order_flags f ON f.order_id = o.id
  LEFT JOIN auth.users u ON u.id = o.user_id
  LEFT JOIN public.profiles p ON p.user_id = o.user_id
  WHERE (CASE WHEN _resolved THEN true
              ELSE EXISTS(SELECT 1 FROM public.order_flags f2 WHERE f2.order_id = o.id AND f2.resolved = false)
         END)
  GROUP BY o.id, u.email, p.display_name
  ORDER BY o.created_at DESC
  LIMIT COALESCE(_limit, 200);
END;
$$;

-- =========================================================
-- RPC: admin_resolve_flag
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_resolve_flag(
  _flag_id uuid,
  _note text DEFAULT ''
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  oid uuid;
  remaining int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.order_flags
  SET resolved = true, resolved_at = now(), resolved_by = auth.uid(),
      resolution_note = COALESCE(_note, '')
  WHERE id = _flag_id
  RETURNING order_id INTO oid;

  IF oid IS NULL THEN RAISE EXCEPTION 'flag not found'; END IF;

  -- If no unresolved flags left, clear needs_review on order
  SELECT count(*) INTO remaining FROM public.order_flags
  WHERE order_id = oid AND resolved = false;

  IF remaining = 0 THEN
    UPDATE public.orders SET needs_review = false WHERE id = oid;
  END IF;

  PERFORM public.log_activity(
    'flag.resolved', 'order', oid::text,
    'Resolved fraud flag' || CASE WHEN _note <> '' THEN ' — ' || _note ELSE '' END,
    NULL, jsonb_build_object('flag_id', _flag_id, 'note', _note),
    'info', NULL
  );
END;
$$;

-- =========================================================
-- RPC: admin_resolve_all_flags_for_order
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_resolve_order_flags(
  _order_id uuid,
  _note text DEFAULT ''
) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.order_flags
  SET resolved = true, resolved_at = now(), resolved_by = auth.uid(),
      resolution_note = COALESCE(_note, '')
  WHERE order_id = _order_id AND resolved = false;
  GET DIAGNOSTICS n = ROW_COUNT;

  UPDATE public.orders SET needs_review = false WHERE id = _order_id;

  PERFORM public.log_activity(
    'flag.bulk_resolved', 'order', _order_id::text,
    'Resolved all flags (' || n || ')' || CASE WHEN _note <> '' THEN ' — ' || _note ELSE '' END,
    NULL, jsonb_build_object('count', n, 'note', _note),
    'info', NULL
  );
  RETURN n;
END;
$$;

-- =========================================================
-- RPC: admin_fraud_stats
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_fraud_stats()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT jsonb_build_object(
    'pending_review', (SELECT count(*) FROM public.orders WHERE needs_review = true),
    'total_flags_open', (SELECT count(*) FROM public.order_flags WHERE resolved = false),
    'total_flags_resolved', (SELECT count(*) FROM public.order_flags WHERE resolved = true),
    'flags_24h', (SELECT count(*) FROM public.order_flags WHERE created_at > now() - interval '24 hours'),
    'by_type', COALESCE((
      SELECT jsonb_object_agg(flag_type, c) FROM (
        SELECT flag_type, count(*) AS c FROM public.order_flags
        WHERE resolved = false GROUP BY flag_type
      ) t
    ), '{}'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;