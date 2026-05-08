
-- ============================================================
-- #5 REFUND MANAGEMENT
-- ============================================================

-- Add 'refunded' to order_status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'refunded' AND enumtypid = 'public.order_status'::regtype) THEN
    ALTER TYPE public.order_status ADD VALUE 'refunded';
  END IF;
END$$;

-- Add 'refund' to credit_source enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'refund' AND enumtypid = 'public.credit_source'::regtype) THEN
    -- already exists from earlier migration, no-op
    NULL;
  END IF;
END$$;

-- Add refund tracking columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_reason text DEFAULT '',
  ADD COLUMN IF NOT EXISTS refunded_credits int DEFAULT 0;

-- Refund function
CREATE OR REPLACE FUNCTION public.admin_refund_order(_order_id uuid, _reason text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders%ROWTYPE;
  curr_balance int;
  to_deduct int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF o.status <> 'approved' THEN RAISE EXCEPTION 'only approved orders can be refunded'; END IF;

  SELECT balance INTO curr_balance FROM public.user_credits WHERE user_id = o.user_id FOR UPDATE;
  curr_balance := COALESCE(curr_balance, 0);

  to_deduct := LEAST(o.credits + COALESCE(o.promo_bonus_credits, 0), curr_balance);

  IF to_deduct > 0 THEN
    UPDATE public.user_credits
    SET balance = balance - to_deduct, updated_at = now()
    WHERE user_id = o.user_id;
  END IF;

  UPDATE public.orders
  SET status = 'refunded',
      refunded_at = now(),
      refund_reason = COALESCE(_reason, ''),
      refunded_credits = to_deduct,
      updated_at = now()
  WHERE id = _order_id;

  PERFORM public.log_credit_tx(
    o.user_id,
    -to_deduct,
    'refund'::public.credit_source,
    'Refund order ' || _order_id::text || CASE WHEN _reason <> '' THEN ' — ' || _reason ELSE '' END,
    _order_id,
    auth.uid()
  );
END;
$$;

-- ============================================================
-- #6 BULK ACTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_bulk_approve_orders(_order_ids uuid[])
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.orders
  SET status = 'approved', updated_at = now()
  WHERE id = ANY(_order_ids) AND status = 'pending';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_bulk_reject_orders(_order_ids uuid[], _reason text DEFAULT '')
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.orders
  SET status = 'rejected',
      admin_notes = COALESCE(NULLIF(_reason, ''), admin_notes),
      updated_at = now()
  WHERE id = ANY(_order_ids) AND status = 'pending';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_bulk_set_package_active(_package_ids uuid[], _active boolean)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.packages SET is_active = _active, updated_at = now()
  WHERE id = ANY(_package_ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_bulk_adjust_prices(
  _package_ids uuid[],
  _percent numeric DEFAULT NULL,
  _flat_delta numeric DEFAULT NULL,
  _round_to numeric DEFAULT 1
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
  ids uuid[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _round_to IS NULL OR _round_to <= 0 THEN _round_to := 1; END IF;

  IF _package_ids IS NULL OR array_length(_package_ids, 1) IS NULL THEN
    SELECT array_agg(id) INTO ids FROM public.packages;
  ELSE
    ids := _package_ids;
  END IF;

  UPDATE public.packages
  SET price = GREATEST(
        round(((price + COALESCE(_flat_delta, 0)) * (1 + COALESCE(_percent, 0)/100.0)) / _round_to) * _round_to,
        0
      ),
      updated_at = now()
  WHERE id = ANY(ids);

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- ============================================================
-- #7 NOTIFICATION SYSTEM
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'info', -- info | success | warning | error | order | credit | system
  link text DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id) WHERE read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
CREATE POLICY "Users view own notifications" ON public.notifications
FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications" ON public.notifications
FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own notifications" ON public.notifications;
CREATE POLICY "Users delete own notifications" ON public.notifications
FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage notifications" ON public.notifications;
CREATE POLICY "Admins manage notifications" ON public.notifications
FOR ALL USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Helper: send notification (SECURITY DEFINER; bypasses RLS for system-generated notifs)
CREATE OR REPLACE FUNCTION public.send_notification(
  _user_id uuid, _title text, _body text DEFAULT '', _type text DEFAULT 'info', _link text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE nid uuid;
BEGIN
  INSERT INTO public.notifications (user_id, title, body, type, link)
  VALUES (_user_id, _title, COALESCE(_body, ''), COALESCE(_type, 'info'), COALESCE(_link, ''))
  RETURNING id INTO nid;
  RETURN nid;
END;
$$;

-- Mark all read for current user
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  UPDATE public.notifications SET read = true WHERE user_id = auth.uid() AND read = false;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- Trigger: notify admins on new pending order
CREATE OR REPLACE FUNCTION public.notify_admins_on_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  IF NEW.status = 'pending' THEN
    FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      PERFORM public.send_notification(
        r.user_id,
        'New pending order',
        'Order for ' || NEW.package_name || ' (৳' || NEW.amount || ') awaiting review.',
        'order',
        '/admin/shop'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_on_new_order ON public.orders;
CREATE TRIGGER trg_notify_admins_on_new_order
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_new_order();

-- Trigger: notify user on order status change (approved / rejected / refunded)
CREATE OR REPLACE FUNCTION public.notify_user_on_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN
      PERFORM public.send_notification(
        NEW.user_id,
        'Order approved 🎉',
        'Your order for ' || NEW.package_name || ' has been approved. ' || NEW.credits || ' credits added.',
        'success',
        '/shop'
      );
    ELSIF NEW.status = 'rejected' THEN
      PERFORM public.send_notification(
        NEW.user_id,
        'Order rejected',
        'Your order for ' || NEW.package_name || ' was rejected.' ||
          CASE WHEN COALESCE(NEW.admin_notes,'') <> '' THEN ' Reason: ' || NEW.admin_notes ELSE '' END,
        'error',
        '/shop'
      );
    ELSIF NEW.status = 'refunded' THEN
      PERFORM public.send_notification(
        NEW.user_id,
        'Order refunded',
        'Your order for ' || NEW.package_name || ' has been refunded.' ||
          CASE WHEN COALESCE(NEW.refund_reason,'') <> '' THEN ' Reason: ' || NEW.refund_reason ELSE '' END,
        'warning',
        '/shop'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_user_on_order_status ON public.orders;
CREATE TRIGGER trg_notify_user_on_order_status
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_user_on_order_status();

-- Trigger: low-balance reminder (when balance crosses below 50)
CREATE OR REPLACE FUNCTION public.notify_low_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.balance < 50 AND (OLD.balance IS NULL OR OLD.balance >= 50) THEN
    PERFORM public.send_notification(
      NEW.user_id,
      'Low credit balance',
      'You have only ' || NEW.balance || ' credits left. Top up to keep building.',
      'warning',
      '/shop'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_low_balance ON public.user_credits;
CREATE TRIGGER trg_notify_low_balance
AFTER UPDATE ON public.user_credits
FOR EACH ROW EXECUTE FUNCTION public.notify_low_balance();

-- ============================================================
-- #8 MANUAL ORDER CREATION
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_create_manual_order(
  _user_id uuid,
  _package_id uuid,
  _credits int,
  _amount numeric DEFAULT 0,
  _package_name text DEFAULT 'Manual order',
  _payment_method payment_method_type DEFAULT 'bkash',
  _notes text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _credits <= 0 THEN RAISE EXCEPTION 'credits must be positive'; END IF;

  INSERT INTO public.orders (
    user_id, package_id, package_name, credits, amount,
    payment_method, status, admin_notes, transaction_id
  ) VALUES (
    _user_id,
    COALESCE(_package_id, gen_random_uuid()),
    COALESCE(NULLIF(_package_name,''), 'Manual order'),
    _credits,
    COALESCE(_amount, 0),
    _payment_method,
    'approved',
    COALESCE(_notes, 'Created by admin'),
    'MANUAL-' || to_char(now(),'YYYYMMDDHH24MISS')
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;
