-- Enums
CREATE TYPE public.support_ticket_status AS ENUM ('open', 'pending', 'resolved', 'closed');
CREATE TYPE public.support_ticket_priority AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE public.support_sender_type AS ENUM ('user', 'admin', 'system');

-- Tickets table
CREATE TABLE public.support_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  subject text NOT NULL,
  status public.support_ticket_status NOT NULL DEFAULT 'open',
  priority public.support_ticket_priority NOT NULL DEFAULT 'normal',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text NOT NULL DEFAULT '',
  last_sender public.support_sender_type NOT NULL DEFAULT 'user',
  user_unread_count int NOT NULL DEFAULT 0,
  admin_unread_count int NOT NULL DEFAULT 0,
  message_count int NOT NULL DEFAULT 0,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tickets_user ON public.support_tickets(user_id, last_message_at DESC);
CREATE INDEX idx_tickets_status ON public.support_tickets(status, last_message_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own tickets" ON public.support_tickets
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create own tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id
    AND NOT EXISTS (SELECT 1 FROM public.user_bans WHERE user_id = auth.uid()));

CREATE POLICY "Admins update tickets" ON public.support_tickets
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users update own tickets limited" ON public.support_tickets
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins delete tickets" ON public.support_tickets
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Messages table
CREATE TABLE public.support_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid,
  sender_type public.support_sender_type NOT NULL,
  sender_email text,
  body text NOT NULL,
  attachment_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_msgs_ticket ON public.support_messages(ticket_id, created_at);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view ticket messages" ON public.support_messages
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
  );

CREATE POLICY "Users post on own tickets" ON public.support_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND sender_type = 'user'
    AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid() AND t.status <> 'closed')
    AND NOT EXISTS (SELECT 1 FROM public.user_bans WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins post on any ticket" ON public.support_messages
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND sender_id = auth.uid()
    AND sender_type = 'admin'
  );

CREATE POLICY "Admins delete messages" ON public.support_messages
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Trigger: update ticket on new message
CREATE OR REPLACE FUNCTION public.support_on_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.support_tickets%ROWTYPE;
  preview text;
  admin_rec record;
BEGIN
  SELECT * INTO t FROM public.support_tickets WHERE id = NEW.ticket_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;

  preview := left(regexp_replace(NEW.body, E'[\\r\\n]+', ' ', 'g'), 140);

  IF NEW.sender_type = 'user' THEN
    UPDATE public.support_tickets
    SET last_message_at = NEW.created_at,
        last_message_preview = preview,
        last_sender = 'user',
        admin_unread_count = admin_unread_count + 1,
        message_count = message_count + 1,
        status = CASE WHEN status IN ('resolved','closed') THEN 'open' ELSE 'open' END,
        updated_at = now()
    WHERE id = NEW.ticket_id;

    -- notify all admins
    FOR admin_rec IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      PERFORM public.send_notification(
        admin_rec.user_id,
        'New support message',
        COALESCE(t.subject,'Ticket') || ': ' || preview,
        'info',
        '/admin/shop'
      );
    END LOOP;

  ELSIF NEW.sender_type = 'admin' THEN
    UPDATE public.support_tickets
    SET last_message_at = NEW.created_at,
        last_message_preview = preview,
        last_sender = 'admin',
        user_unread_count = user_unread_count + 1,
        message_count = message_count + 1,
        status = CASE WHEN status = 'closed' THEN 'closed' ELSE 'pending' END,
        updated_at = now()
    WHERE id = NEW.ticket_id;

    PERFORM public.send_notification(
      t.user_id,
      'Support replied',
      COALESCE(t.subject,'Ticket') || ': ' || preview,
      'info',
      '/profile?tab=support'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_support_new_message
AFTER INSERT ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.support_on_new_message();

-- updated_at trigger
CREATE TRIGGER trg_support_tickets_updated
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC: create ticket with first message
CREATE OR REPLACE FUNCTION public.create_support_ticket(_subject text, _body text, _priority public.support_ticket_priority DEFAULT 'normal')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  new_id uuid;
  uemail text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_bans WHERE user_id = uid) THEN
    RAISE EXCEPTION 'banned';
  END IF;
  IF length(trim(coalesce(_subject,''))) < 2 THEN RAISE EXCEPTION 'subject required'; END IF;
  IF length(trim(coalesce(_body,''))) < 1 THEN RAISE EXCEPTION 'message required'; END IF;

  SELECT email::text INTO uemail FROM auth.users WHERE id = uid;

  INSERT INTO public.support_tickets (user_id, subject, priority)
  VALUES (uid, left(_subject, 200), COALESCE(_priority,'normal'))
  RETURNING id INTO new_id;

  INSERT INTO public.support_messages (ticket_id, sender_id, sender_type, sender_email, body)
  VALUES (new_id, uid, 'user', uemail, _body);

  RETURN new_id;
END;
$$;

-- RPC: post message
CREATE OR REPLACE FUNCTION public.post_support_message(_ticket_id uuid, _body text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  is_admin boolean;
  t public.support_tickets%ROWTYPE;
  s public.support_sender_type;
  uemail text;
  new_msg uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF length(trim(coalesce(_body,''))) < 1 THEN RAISE EXCEPTION 'empty message'; END IF;

  SELECT * INTO t FROM public.support_tickets WHERE id = _ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket not found'; END IF;

  is_admin := public.has_role(uid, 'admin');
  IF is_admin THEN
    s := 'admin';
  ELSE
    IF t.user_id <> uid THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF t.status = 'closed' THEN RAISE EXCEPTION 'ticket closed'; END IF;
    IF EXISTS (SELECT 1 FROM public.user_bans WHERE user_id = uid) THEN RAISE EXCEPTION 'banned'; END IF;
    s := 'user';
  END IF;

  SELECT email::text INTO uemail FROM auth.users WHERE id = uid;

  INSERT INTO public.support_messages (ticket_id, sender_id, sender_type, sender_email, body)
  VALUES (_ticket_id, uid, s, uemail, _body)
  RETURNING id INTO new_msg;

  RETURN new_msg;
END;
$$;

-- RPC: mark ticket read
CREATE OR REPLACE FUNCTION public.mark_ticket_read(_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  is_admin boolean;
  t public.support_tickets%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO t FROM public.support_tickets WHERE id = _ticket_id;
  IF NOT FOUND THEN RETURN; END IF;
  is_admin := public.has_role(uid, 'admin');
  IF is_admin THEN
    UPDATE public.support_tickets SET admin_unread_count = 0 WHERE id = _ticket_id;
  ELSIF t.user_id = uid THEN
    UPDATE public.support_tickets SET user_unread_count = 0 WHERE id = _ticket_id;
  END IF;
END;
$$;

-- RPC: set status (admin or user closing own)
CREATE OR REPLACE FUNCTION public.set_ticket_status(_ticket_id uuid, _status public.support_ticket_status)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  is_admin boolean;
  t public.support_tickets%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO t FROM public.support_tickets WHERE id = _ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  is_admin := public.has_role(uid, 'admin');
  IF NOT is_admin AND t.user_id <> uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT is_admin AND _status NOT IN ('resolved','closed') THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.support_tickets
  SET status = _status,
      closed_at = CASE WHEN _status IN ('closed','resolved') THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = _ticket_id;
END;
$$;

-- Admin list
CREATE OR REPLACE FUNCTION public.admin_list_tickets(_status public.support_ticket_status DEFAULT NULL, _limit int DEFAULT 200)
RETURNS TABLE(
  id uuid, user_id uuid, user_email text, display_name text,
  subject text, status public.support_ticket_status, priority public.support_ticket_priority,
  last_message_at timestamptz, last_message_preview text, last_sender public.support_sender_type,
  admin_unread_count int, user_unread_count int, message_count int,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT t.id, t.user_id, u.email::text, p.display_name,
         t.subject, t.status, t.priority,
         t.last_message_at, t.last_message_preview, t.last_sender,
         t.admin_unread_count, t.user_unread_count, t.message_count,
         t.created_at
  FROM public.support_tickets t
  LEFT JOIN auth.users u ON u.id = t.user_id
  LEFT JOIN public.profiles p ON p.user_id = t.user_id
  WHERE (_status IS NULL OR t.status = _status)
  ORDER BY t.last_message_at DESC
  LIMIT COALESCE(_limit, 200);
END;
$$;

-- Admin stats
CREATE OR REPLACE FUNCTION public.admin_support_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'open', (SELECT count(*) FROM public.support_tickets WHERE status='open'),
    'pending', (SELECT count(*) FROM public.support_tickets WHERE status='pending'),
    'resolved', (SELECT count(*) FROM public.support_tickets WHERE status='resolved'),
    'closed', (SELECT count(*) FROM public.support_tickets WHERE status='closed'),
    'unread_admin', (SELECT COALESCE(SUM(admin_unread_count),0) FROM public.support_tickets),
    'awaiting_reply', (SELECT count(*) FROM public.support_tickets WHERE status='open' AND last_sender='user')
  ) INTO r;
  RETURN r;
END;
$$;

-- Realtime
ALTER TABLE public.support_tickets REPLICA IDENTITY FULL;
ALTER TABLE public.support_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;