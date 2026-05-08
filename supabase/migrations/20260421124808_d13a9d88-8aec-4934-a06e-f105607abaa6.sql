-- =========================================================
-- ACTIVITY LOG / AUDIT TRAIL
-- =========================================================

-- Severity enum
DO $$ BEGIN
  CREATE TYPE public.activity_severity AS ENUM ('info', 'warn', 'critical');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Main table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  actor_role text,
  action text NOT NULL,
  target_type text,
  target_id text,
  summary text NOT NULL DEFAULT '',
  old_values jsonb,
  new_values jsonb,
  severity public.activity_severity NOT NULL DEFAULT 'info',
  ip_address text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.activity_logs (action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON public.activity_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_severity ON public.activity_logs (severity);
CREATE INDEX IF NOT EXISTS idx_activity_logs_target ON public.activity_logs (target_type, target_id);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view activity" ON public.activity_logs;
CREATE POLICY "Admins view activity"
  ON public.activity_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins insert activity" ON public.activity_logs;
CREATE POLICY "Admins insert activity"
  ON public.activity_logs FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
-- No UPDATE/DELETE policies = immutable

-- =========================================================
-- HELPER: log_activity
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_activity(
  _action text,
  _target_type text DEFAULT NULL,
  _target_id text DEFAULT NULL,
  _summary text DEFAULT '',
  _old jsonb DEFAULT NULL,
  _new jsonb DEFAULT NULL,
  _severity public.activity_severity DEFAULT 'info',
  _metadata jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  uid uuid := auth.uid();
  uemail text;
  is_admin_actor boolean := false;
BEGIN
  IF uid IS NOT NULL THEN
    SELECT email::text INTO uemail FROM auth.users WHERE id = uid;
    is_admin_actor := public.has_role(uid, 'admin');
  END IF;

  INSERT INTO public.activity_logs (
    actor_id, actor_email, actor_role, action, target_type, target_id,
    summary, old_values, new_values, severity, metadata
  ) VALUES (
    uid, uemail,
    CASE WHEN is_admin_actor THEN 'admin' ELSE 'user' END,
    _action, _target_type, _target_id,
    COALESCE(_summary, ''), _old, _new, COALESCE(_severity, 'info'), _metadata
  ) RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- =========================================================
-- TRIGGER: orders status change
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sev public.activity_severity := 'info';
  act text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    act := 'order.' || NEW.status::text;
    IF NEW.status = 'refunded' THEN sev := 'warn';
    ELSIF NEW.status = 'rejected' THEN sev := 'warn';
    END IF;

    PERFORM public.log_activity(
      act, 'order', NEW.id::text,
      'Order ' || NEW.package_name || ' (৳' || NEW.amount || ') → ' || NEW.status::text,
      jsonb_build_object('status', OLD.status, 'admin_notes', OLD.admin_notes, 'refund_reason', OLD.refund_reason),
      jsonb_build_object('status', NEW.status, 'admin_notes', NEW.admin_notes, 'refund_reason', NEW.refund_reason, 'amount', NEW.amount, 'credits', NEW.credits, 'user_id', NEW.user_id),
      sev, NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_order_status ON public.orders;
CREATE TRIGGER trg_log_order_status
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();

-- =========================================================
-- TRIGGER: packages CRUD
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_package_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  changes jsonb := '{}'::jsonb;
  old_vals jsonb := '{}'::jsonb;
  new_vals jsonb := '{}'::jsonb;
  s text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity(
      'package.created', 'package', NEW.id::text,
      'Created package: ' || NEW.name || ' (৳' || NEW.price || ' / ' || NEW.credits || ' cr)',
      NULL,
      to_jsonb(NEW),
      'info', NULL
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_activity(
      'package.deleted', 'package', OLD.id::text,
      'Deleted package: ' || OLD.name,
      to_jsonb(OLD), NULL, 'warn', NULL
    );
    RETURN OLD;
  ELSE
    IF NEW.price IS DISTINCT FROM OLD.price THEN
      old_vals := old_vals || jsonb_build_object('price', OLD.price);
      new_vals := new_vals || jsonb_build_object('price', NEW.price);
    END IF;
    IF NEW.credits IS DISTINCT FROM OLD.credits THEN
      old_vals := old_vals || jsonb_build_object('credits', OLD.credits);
      new_vals := new_vals || jsonb_build_object('credits', NEW.credits);
    END IF;
    IF NEW.name IS DISTINCT FROM OLD.name THEN
      old_vals := old_vals || jsonb_build_object('name', OLD.name);
      new_vals := new_vals || jsonb_build_object('name', NEW.name);
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      old_vals := old_vals || jsonb_build_object('is_active', OLD.is_active);
      new_vals := new_vals || jsonb_build_object('is_active', NEW.is_active);
    END IF;
    IF NEW.is_popular IS DISTINCT FROM OLD.is_popular THEN
      old_vals := old_vals || jsonb_build_object('is_popular', OLD.is_popular);
      new_vals := new_vals || jsonb_build_object('is_popular', NEW.is_popular);
    END IF;

    IF old_vals <> '{}'::jsonb THEN
      s := 'Updated package: ' || NEW.name;
      PERFORM public.log_activity(
        'package.updated', 'package', NEW.id::text, s,
        old_vals, new_vals, 'info', NULL
      );
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_packages ON public.packages;
CREATE TRIGGER trg_log_packages
  AFTER INSERT OR UPDATE OR DELETE ON public.packages
  FOR EACH ROW EXECUTE FUNCTION public.log_package_changes();

-- =========================================================
-- TRIGGER: credit transactions (admin actions)
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_credit_transaction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sev public.activity_severity := 'info';
  act text;
BEGIN
  -- Only log admin-initiated transactions
  IF NEW.source IN ('admin_gift', 'admin_deduct', 'refund') THEN
    act := 'credits.' || NEW.source::text;
    IF abs(NEW.delta) >= 1000 THEN sev := 'warn'; END IF;

    PERFORM public.log_activity(
      act, 'user', NEW.user_id::text,
      CASE WHEN NEW.delta > 0 THEN 'Granted ' ELSE 'Deducted ' END
        || abs(NEW.delta) || ' credits — ' || COALESCE(NEW.reason, ''),
      NULL,
      jsonb_build_object('delta', NEW.delta, 'balance_after', NEW.balance_after, 'reason', NEW.reason, 'source', NEW.source),
      sev, NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_credit_tx ON public.credit_transactions;
CREATE TRIGGER trg_log_credit_tx
  AFTER INSERT ON public.credit_transactions
  FOR EACH ROW EXECUTE FUNCTION public.log_credit_transaction();

-- =========================================================
-- TRIGGER: user_roles changes
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.role = 'admin' THEN
    PERFORM public.log_activity(
      'role.admin_granted', 'user', NEW.user_id::text,
      'Granted admin role',
      NULL, jsonb_build_object('role', NEW.role), 'critical', NULL
    );
  ELSIF TG_OP = 'DELETE' AND OLD.role = 'admin' THEN
    PERFORM public.log_activity(
      'role.admin_revoked', 'user', OLD.user_id::text,
      'Revoked admin role',
      jsonb_build_object('role', OLD.role), NULL, 'critical', NULL
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_roles ON public.user_roles;
CREATE TRIGGER trg_log_roles
  AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_role_change();

-- =========================================================
-- TRIGGER: user_bans
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_user_ban()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity(
      'user.banned', 'user', NEW.user_id::text,
      'User banned' || CASE WHEN NEW.reason <> '' THEN ' — ' || NEW.reason ELSE '' END,
      NULL, jsonb_build_object('reason', NEW.reason, 'banned_by', NEW.banned_by),
      'warn', NULL
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_activity(
      'user.unbanned', 'user', OLD.user_id::text,
      'User unbanned',
      jsonb_build_object('reason', OLD.reason), NULL, 'info', NULL
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_bans ON public.user_bans;
CREATE TRIGGER trg_log_bans
  AFTER INSERT OR DELETE ON public.user_bans
  FOR EACH ROW EXECUTE FUNCTION public.log_user_ban();

-- =========================================================
-- TRIGGER: app_settings update
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_settings_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  old_vals jsonb := '{}'::jsonb;
  new_vals jsonb := '{}'::jsonb;
BEGIN
  IF NEW.maintenance_mode IS DISTINCT FROM OLD.maintenance_mode THEN
    old_vals := old_vals || jsonb_build_object('maintenance_mode', OLD.maintenance_mode);
    new_vals := new_vals || jsonb_build_object('maintenance_mode', NEW.maintenance_mode);
  END IF;
  IF NEW.vat_percent IS DISTINCT FROM OLD.vat_percent THEN
    old_vals := old_vals || jsonb_build_object('vat_percent', OLD.vat_percent);
    new_vals := new_vals || jsonb_build_object('vat_percent', NEW.vat_percent);
  END IF;
  IF NEW.site_name IS DISTINCT FROM OLD.site_name THEN
    old_vals := old_vals || jsonb_build_object('site_name', OLD.site_name);
    new_vals := new_vals || jsonb_build_object('site_name', NEW.site_name);
  END IF;
  IF NEW.contact_email IS DISTINCT FROM OLD.contact_email THEN
    old_vals := old_vals || jsonb_build_object('contact_email', OLD.contact_email);
    new_vals := new_vals || jsonb_build_object('contact_email', NEW.contact_email);
  END IF;
  IF NEW.invoice_prefix IS DISTINCT FROM OLD.invoice_prefix THEN
    old_vals := old_vals || jsonb_build_object('invoice_prefix', OLD.invoice_prefix);
    new_vals := new_vals || jsonb_build_object('invoice_prefix', NEW.invoice_prefix);
  END IF;
  IF NEW.order_auto_reject_days IS DISTINCT FROM OLD.order_auto_reject_days THEN
    old_vals := old_vals || jsonb_build_object('order_auto_reject_days', OLD.order_auto_reject_days);
    new_vals := new_vals || jsonb_build_object('order_auto_reject_days', NEW.order_auto_reject_days);
  END IF;

  IF old_vals <> '{}'::jsonb THEN
    PERFORM public.log_activity(
      'settings.updated', 'settings', 'app_settings',
      'App settings updated',
      old_vals, new_vals, 'warn', NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_settings ON public.app_settings;
CREATE TRIGGER trg_log_settings
  AFTER UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.log_settings_update();

-- =========================================================
-- TRIGGER: promo_codes
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_promo_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity(
      'promo.created', 'promo', NEW.id::text,
      'Created promo: ' || NEW.code,
      NULL, to_jsonb(NEW), 'info', NULL
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_activity(
      'promo.deleted', 'promo', OLD.id::text,
      'Deleted promo: ' || OLD.code,
      to_jsonb(OLD), NULL, 'warn', NULL
    );
    RETURN OLD;
  ELSE
    IF NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.discount_value IS DISTINCT FROM OLD.discount_value
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
      PERFORM public.log_activity(
        'promo.updated', 'promo', NEW.id::text,
        'Updated promo: ' || NEW.code,
        jsonb_build_object('is_active', OLD.is_active, 'discount_value', OLD.discount_value, 'expires_at', OLD.expires_at),
        jsonb_build_object('is_active', NEW.is_active, 'discount_value', NEW.discount_value, 'expires_at', NEW.expires_at),
        'info', NULL
      );
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_promos ON public.promo_codes;
CREATE TRIGGER trg_log_promos
  AFTER INSERT OR UPDATE OR DELETE ON public.promo_codes
  FOR EACH ROW EXECUTE FUNCTION public.log_promo_changes();

-- =========================================================
-- RPC: admin_list_activity (with filters)
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_list_activity(
  _action text DEFAULT NULL,
  _severity public.activity_severity DEFAULT NULL,
  _actor_id uuid DEFAULT NULL,
  _target_type text DEFAULT NULL,
  _target_id text DEFAULT NULL,
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL,
  _search text DEFAULT NULL,
  _limit int DEFAULT 200
)
RETURNS TABLE (
  id uuid,
  actor_id uuid,
  actor_email text,
  actor_role text,
  action text,
  target_type text,
  target_id text,
  summary text,
  old_values jsonb,
  new_values jsonb,
  severity public.activity_severity,
  ip_address text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  RETURN QUERY
  SELECT a.id, a.actor_id, a.actor_email, a.actor_role, a.action, a.target_type,
         a.target_id, a.summary, a.old_values, a.new_values, a.severity,
         a.ip_address, a.user_agent, a.metadata, a.created_at
  FROM public.activity_logs a
  WHERE (_action IS NULL OR a.action = _action)
    AND (_severity IS NULL OR a.severity = _severity)
    AND (_actor_id IS NULL OR a.actor_id = _actor_id)
    AND (_target_type IS NULL OR a.target_type = _target_type)
    AND (_target_id IS NULL OR a.target_id = _target_id)
    AND (_from IS NULL OR a.created_at >= _from)
    AND (_to IS NULL OR a.created_at <= _to)
    AND (_search IS NULL OR a.summary ILIKE '%' || _search || '%' OR a.actor_email ILIKE '%' || _search || '%')
  ORDER BY a.created_at DESC
  LIMIT COALESCE(_limit, 200);
END;
$$;

-- =========================================================
-- RPC: admin_get_activity_alerts (suspicious patterns)
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_get_activity_alerts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  alerts jsonb := '[]'::jsonb;
  rec record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  -- 1. Mass refunds (>3 in last 24h)
  FOR rec IN
    SELECT actor_email, count(*) AS c
    FROM public.activity_logs
    WHERE action = 'order.refunded' AND created_at > now() - interval '24 hours'
    GROUP BY actor_email HAVING count(*) >= 3
  LOOP
    alerts := alerts || jsonb_build_object(
      'type', 'mass_refunds', 'severity', 'warn',
      'message', rec.actor_email || ' issued ' || rec.c || ' refunds in 24h',
      'count', rec.c
    );
  END LOOP;

  -- 2. Bulk price changes (>5 package updates in 1h)
  FOR rec IN
    SELECT actor_email, count(*) AS c
    FROM public.activity_logs
    WHERE action = 'package.updated' AND created_at > now() - interval '1 hour'
    GROUP BY actor_email HAVING count(*) >= 5
  LOOP
    alerts := alerts || jsonb_build_object(
      'type', 'bulk_price_change', 'severity', 'warn',
      'message', rec.actor_email || ' modified ' || rec.c || ' packages in 1h',
      'count', rec.c
    );
  END LOOP;

  -- 3. Critical events in last 7 days (admin role grants/revokes)
  FOR rec IN
    SELECT count(*) AS c
    FROM public.activity_logs
    WHERE severity = 'critical' AND created_at > now() - interval '7 days'
  LOOP
    IF rec.c > 0 THEN
      alerts := alerts || jsonb_build_object(
        'type', 'critical_events', 'severity', 'critical',
        'message', rec.c || ' critical event(s) in last 7 days (role changes)',
        'count', rec.c
      );
    END IF;
  END LOOP;

  -- 4. Off-hours admin activity (between 1am-5am Asia/Dhaka, last 7d)
  FOR rec IN
    SELECT actor_email, count(*) AS c
    FROM public.activity_logs
    WHERE actor_role = 'admin'
      AND created_at > now() - interval '7 days'
      AND extract(hour from created_at AT TIME ZONE 'Asia/Dhaka') BETWEEN 1 AND 5
    GROUP BY actor_email HAVING count(*) >= 5
  LOOP
    alerts := alerts || jsonb_build_object(
      'type', 'off_hours', 'severity', 'info',
      'message', rec.actor_email || ' had ' || rec.c || ' actions during 1–5am',
      'count', rec.c
    );
  END LOOP;

  -- 5. Large credit deductions
  FOR rec IN
    SELECT count(*) AS c
    FROM public.activity_logs
    WHERE action = 'credits.admin_deduct'
      AND created_at > now() - interval '24 hours'
      AND (new_values->>'delta')::int <= -1000
  LOOP
    IF rec.c > 0 THEN
      alerts := alerts || jsonb_build_object(
        'type', 'large_deduction', 'severity', 'warn',
        'message', rec.c || ' large credit deduction(s) (≥1000) in 24h',
        'count', rec.c
      );
    END IF;
  END LOOP;

  result := jsonb_build_object(
    'alerts', alerts,
    'totals', jsonb_build_object(
      'last_24h', (SELECT count(*) FROM public.activity_logs WHERE created_at > now() - interval '24 hours'),
      'last_7d', (SELECT count(*) FROM public.activity_logs WHERE created_at > now() - interval '7 days'),
      'critical_7d', (SELECT count(*) FROM public.activity_logs WHERE severity = 'critical' AND created_at > now() - interval '7 days'),
      'warn_7d', (SELECT count(*) FROM public.activity_logs WHERE severity = 'warn' AND created_at > now() - interval '7 days')
    )
  );
  RETURN result;
END;
$$;

-- =========================================================
-- RPC: admin_log_auth_event (for client-side auth tracking)
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_auth_event(
  _action text,
  _email text DEFAULT NULL,
  _success boolean DEFAULT true,
  _metadata jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  sev public.activity_severity := 'info';
BEGIN
  IF NOT _success THEN sev := 'warn'; END IF;

  INSERT INTO public.activity_logs (
    actor_id, actor_email, actor_role, action, target_type, target_id,
    summary, severity, metadata
  ) VALUES (
    auth.uid(), COALESCE(_email, (SELECT email::text FROM auth.users WHERE id = auth.uid())),
    'user', 'auth.' || _action, 'auth', _email,
    CASE WHEN _success THEN 'Auth: ' || _action ELSE 'Failed: ' || _action || ' (' || COALESCE(_email,'unknown') || ')' END,
    sev, _metadata
  ) RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- Allow any authenticated/anon user to log their own auth attempts
GRANT EXECUTE ON FUNCTION public.log_auth_event(text, text, boolean, jsonb) TO anon, authenticated;