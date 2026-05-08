
-- 1. Roles enum + user_roles table (security best practice: roles in separate table)
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-promote first user to admin so shop can be configured
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count int;
BEGIN
  SELECT count(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_default_role();

-- Backfill: make existing users 'user', and the oldest one 'admin'
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user' FROM auth.users
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users ORDER BY created_at ASC LIMIT 1
ON CONFLICT DO NOTHING;

-- 2. Packages table
CREATE TABLE public.packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  credits int NOT NULL CHECK (credits >= 0),
  is_popular boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated views active packages" ON public.packages
  FOR SELECT TO authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage packages" ON public.packages
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_packages_updated_at
  BEFORE UPDATE ON public.packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Payment methods config (bKash/Nagad/Rocket numbers, crypto wallet)
CREATE TYPE public.payment_method_type AS ENUM ('bkash', 'nagad', 'rocket', 'crypto');

CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type payment_method_type NOT NULL,
  label text NOT NULL,
  account_number text NOT NULL,
  instructions text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view active methods" ON public.payment_methods
  FOR SELECT TO authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage methods" ON public.payment_methods
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Orders
CREATE TYPE public.order_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  package_id uuid NOT NULL,
  package_name text NOT NULL,
  amount numeric(10,2) NOT NULL,
  credits int NOT NULL,
  payment_method payment_method_type NOT NULL,
  sender_account text DEFAULT '',
  transaction_id text DEFAULT '',
  crypto_currency text DEFAULT '',
  status order_status NOT NULL DEFAULT 'pending',
  admin_notes text DEFAULT '',
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own orders" ON public.orders
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create own orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins update orders" ON public.orders
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete orders" ON public.orders
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. User credits
CREATE TABLE public.user_credits (
  user_id uuid PRIMARY KEY,
  balance int NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_purchased int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own credits" ON public.user_credits
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage credits" ON public.user_credits
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_user_credits_updated_at
  BEFORE UPDATE ON public.user_credits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Auto credit on order approval
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
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_order_approved
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.credit_on_approval();

-- 7. Seed sample packages and a placeholder payment method so admin sees something immediately
INSERT INTO public.packages (name, description, price, credits, is_popular, sort_order) VALUES
  ('Starter', '100 credits to try out the AI builder', 200, 100, false, 1),
  ('Pro', '500 credits — best value for regular users', 800, 500, true, 2),
  ('Business', '1500 credits for power users and teams', 2000, 1500, false, 3),
  ('Enterprise', '5000 credits with priority support', 6000, 5000, false, 4);

INSERT INTO public.payment_methods (type, label, account_number, instructions) VALUES
  ('bkash', 'bKash Personal', '01XXXXXXXXX', 'Send Money kore transaction ID submit korun'),
  ('nagad', 'Nagad Personal', '01XXXXXXXXX', 'Send Money kore transaction ID submit korun'),
  ('rocket', 'Rocket Personal', '01XXXXXXXXX-X', 'Send Money kore transaction ID submit korun'),
  ('crypto', 'USDT (TRC20)', 'TXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 'USDT TRC20 network e pathaben, TX hash submit korun');
