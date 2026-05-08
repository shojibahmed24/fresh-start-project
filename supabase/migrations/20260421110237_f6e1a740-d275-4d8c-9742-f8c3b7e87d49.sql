
-- ============ APP SETTINGS ============
CREATE TABLE IF NOT EXISTS public.app_settings (
  id boolean PRIMARY KEY DEFAULT true,
  site_name text NOT NULL DEFAULT 'SmartApp',
  site_logo_url text NOT NULL DEFAULT '',
  contact_email text NOT NULL DEFAULT '',
  contact_phone text NOT NULL DEFAULT '',
  vat_percent numeric NOT NULL DEFAULT 0,
  invoice_prefix text NOT NULL DEFAULT 'INV',
  order_auto_reject_days integer NOT NULL DEFAULT 7,
  maintenance_mode boolean NOT NULL DEFAULT false,
  maintenance_message text NOT NULL DEFAULT 'We are doing scheduled maintenance. Please check back soon.',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = true)
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "Anyone authenticated reads settings" ON public.app_settings;
CREATE POLICY "Anyone authenticated reads settings"
  ON public.app_settings FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins update settings" ON public.app_settings;
CREATE POLICY "Admins update settings"
  ON public.app_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER app_settings_updated
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ INVOICES ============
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  invoice_number text NOT NULL UNIQUE,
  subtotal numeric NOT NULL DEFAULT 0,
  vat_percent numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BDT',
  issued_at timestamptz NOT NULL DEFAULT now(),
  pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own invoices" ON public.invoices;
CREATE POLICY "Users view own invoices"
  ON public.invoices FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage invoices" ON public.invoices;
CREATE POLICY "Admins manage invoices"
  ON public.invoices FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS invoices_user_id_idx ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS invoices_order_id_idx ON public.invoices(order_id);

-- Generate invoice on order approval
CREATE OR REPLACE FUNCTION public.create_invoice_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.app_settings%ROWTYPE;
  inv_no text;
  sub numeric;
  vat_amt numeric;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') AND NEW.amount > 0 THEN
    SELECT * INTO s FROM public.app_settings WHERE id = true;
    -- amount is treated as VAT-inclusive total; back-calc subtotal & vat
    IF COALESCE(s.vat_percent, 0) > 0 THEN
      sub := round(NEW.amount / (1 + s.vat_percent/100.0), 2);
      vat_amt := round(NEW.amount - sub, 2);
    ELSE
      sub := NEW.amount;
      vat_amt := 0;
    END IF;
    inv_no := COALESCE(NULLIF(s.invoice_prefix,''),'INV') || '-' || to_char(now(),'YYYYMMDD') || '-' || substr(replace(NEW.id::text,'-',''), 1, 6);

    INSERT INTO public.invoices (order_id, user_id, invoice_number, subtotal, vat_percent, vat_amount, total)
    VALUES (NEW.id, NEW.user_id, inv_no, sub, COALESCE(s.vat_percent, 0), vat_amt, NEW.amount)
    ON CONFLICT (order_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_invoice_after_order_approval ON public.orders;
CREATE TRIGGER create_invoice_after_order_approval
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.create_invoice_on_approval();

-- ============ AUTO REJECT STALE ORDERS ============
CREATE OR REPLACE FUNCTION public.auto_reject_stale_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.app_settings%ROWTYPE;
  n int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
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
$$;
