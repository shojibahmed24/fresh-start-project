-- ============================================================
-- 1) PROMO CODES — hide internal fields from regular users
-- ============================================================
-- Drop existing public/authenticated SELECT policies
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'public.promo_codes'::regclass AND polcmd = 'r'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.promo_codes', pol.polname);
  END LOOP;
END$$;

-- Only admins can read the full promo_codes table
CREATE POLICY "Admins can view all promo codes"
  ON public.promo_codes
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Regular users apply codes via public.validate_promo() (SECURITY DEFINER)
-- which already exists and only returns discount + final_amount, never internal fields.

-- ============================================================
-- 2) REALTIME — restrict channel subscriptions to ticket owners
-- ============================================================
-- Enable RLS on realtime.messages (idempotent)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop any prior policies we created (idempotent)
DROP POLICY IF EXISTS "Users can subscribe to their own support channels" ON realtime.messages;
DROP POLICY IF EXISTS "Admins can subscribe to all channels" ON realtime.messages;

-- Users can subscribe to channels named "support:<their-uuid>"
-- and to ticket-specific channels for tickets they own.
CREATE POLICY "Users can subscribe to their own support channels"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    -- Personal user channel
    (realtime.topic() = ('support:' || auth.uid()::text))
    OR
    -- Ticket-specific channels for tickets they own
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.user_id = auth.uid()
        AND realtime.topic() = ('ticket:' || t.id::text)
    )
  );

-- Admins can subscribe to any channel
CREATE POLICY "Admins can subscribe to all channels"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 3) Document payment_methods exposure as intentional
-- ============================================================
COMMENT ON COLUMN public.payment_methods.account_number IS
  'Intentionally readable by authenticated users — required for checkout to display merchant payment account (bKash/Nagad/Rocket numbers users must send money to).';