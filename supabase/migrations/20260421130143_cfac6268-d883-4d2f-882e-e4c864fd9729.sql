-- Announcements table
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  variant text NOT NULL DEFAULT 'info', -- info | success | warning | promo | danger
  link_url text DEFAULT '',
  link_label text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  sort_order int NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view active announcements"
ON public.announcements FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (is_active = true
      AND starts_at <= now()
      AND (expires_at IS NULL OR expires_at > now()))
);

CREATE POLICY "Admins manage announcements"
ON public.announcements FOR ALL TO public
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_announcements_updated_at
BEFORE UPDATE ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_announcements_active ON public.announcements (is_active, starts_at, expires_at, sort_order);

-- FAQ table
CREATE TABLE public.faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view active faqs"
ON public.faqs FOR SELECT TO authenticated
USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage faqs"
ON public.faqs FOR ALL TO public
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_faqs_updated_at
BEFORE UPDATE ON public.faqs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_faqs_active ON public.faqs (is_active, category, sort_order);

-- Activity logging triggers
CREATE OR REPLACE FUNCTION public.log_announcement_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('announcement.created', 'announcement', NEW.id::text,
      'Created announcement: ' || NEW.title, NULL, to_jsonb(NEW), 'info', NULL);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_activity('announcement.deleted', 'announcement', OLD.id::text,
      'Deleted announcement: ' || OLD.title, to_jsonb(OLD), NULL, 'warn', NULL);
    RETURN OLD;
  ELSE
    PERFORM public.log_activity('announcement.updated', 'announcement', NEW.id::text,
      'Updated announcement: ' || NEW.title,
      jsonb_build_object('title', OLD.title, 'is_active', OLD.is_active, 'expires_at', OLD.expires_at),
      jsonb_build_object('title', NEW.title, 'is_active', NEW.is_active, 'expires_at', NEW.expires_at),
      'info', NULL);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_log_announcements
AFTER INSERT OR UPDATE OR DELETE ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.log_announcement_changes();

CREATE OR REPLACE FUNCTION public.log_faq_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('faq.created', 'faq', NEW.id::text,
      'Created FAQ: ' || NEW.question, NULL, to_jsonb(NEW), 'info', NULL);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_activity('faq.deleted', 'faq', OLD.id::text,
      'Deleted FAQ: ' || OLD.question, to_jsonb(OLD), NULL, 'warn', NULL);
    RETURN OLD;
  ELSE
    PERFORM public.log_activity('faq.updated', 'faq', NEW.id::text,
      'Updated FAQ: ' || NEW.question, NULL, NULL, 'info', NULL);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_log_faqs
AFTER INSERT OR UPDATE OR DELETE ON public.faqs
FOR EACH ROW EXECUTE FUNCTION public.log_faq_changes();