import { useEffect, useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { Megaphone, X, ExternalLink, Sparkles, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type Announcement = {
  id: string;
  title: string;
  body: string;
  variant: "info" | "success" | "warning" | "promo" | "danger" | string;
  link_url: string | null;
  link_label: string | null;
  starts_at: string;
  expires_at: string | null;
};

const VARIANT_STYLE: Record<string, { wrap: string; icon: JSX.Element; accent: string }> = {
  info: {
    wrap: "from-sky-500/15 to-blue-500/10 border-sky-500/30 text-sky-100",
    icon: <Info size={16} className="text-sky-300" />,
    accent: "text-sky-300",
  },
  success: {
    wrap: "from-emerald-500/15 to-green-500/10 border-emerald-500/30 text-emerald-100",
    icon: <CheckCircle2 size={16} className="text-emerald-300" />,
    accent: "text-emerald-300",
  },
  warning: {
    wrap: "from-amber-500/15 to-yellow-500/10 border-amber-500/30 text-amber-100",
    icon: <AlertTriangle size={16} className="text-amber-300" />,
    accent: "text-amber-300",
  },
  danger: {
    wrap: "from-red-500/15 to-rose-500/10 border-red-500/30 text-red-100",
    icon: <AlertTriangle size={16} className="text-red-300" />,
    accent: "text-red-300",
  },
  promo: {
    wrap: "from-fuchsia-500/20 via-purple-500/15 to-primary/15 border-fuchsia-500/30 text-fuchsia-50",
    icon: <Sparkles size={16} className="text-fuchsia-300" />,
    accent: "text-fuchsia-300",
  },
};

const DISMISS_KEY = "dismissed_announcements_v1";

function getDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]");
  } catch {
    return [];
  }
}

function addDismissed(id: string) {
  const arr = Array.from(new Set([...getDismissed(), id]));
  localStorage.setItem(DISMISS_KEY, JSON.stringify(arr));
}

export const AnnouncementsBar = () => {
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(getDismissed());

  useEffect(() => {
    const load = async () => {
      const nowIso = new Date().toISOString();
      const { data } = await (supabase as any)
        .from("announcements")
        .select("id,title,body,variant,link_url,link_label,starts_at,expires_at")
        .eq("is_active", true)
        .lte("starts_at", nowIso)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      setItems((data ?? []) as Announcement[]);
    };
    load();

    const channel = (supabase as any)
      .channel(`announcements-public-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, load)
      .subscribe();
    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, []);

  const visible = items.filter((a) => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 mb-8">
      <AnimatePresence initial={false}>
        {visible.map((a) => {
          const v = VARIANT_STYLE[a.variant] ?? VARIANT_STYLE.info;
          return (
            <m.div
              key={a.id}
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className={`relative overflow-hidden rounded-xl border bg-gradient-to-r ${v.wrap} backdrop-blur-sm`}
            >
              <div className="flex items-start gap-3 p-4 sm:p-5">
                <div className="mt-0.5 shrink-0">
                  <div className="w-8 h-8 rounded-lg bg-background/30 grid place-items-center">
                    {a.variant === "promo" ? <Megaphone size={16} className={v.accent} /> : v.icon}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold tracking-tight text-foreground">{a.title}</div>
                  {a.body && (
                    <div className="mt-1 text-sm text-foreground/80 whitespace-pre-wrap">{a.body}</div>
                  )}
                  {a.link_url && (
                    <a
                      href={a.link_url}
                      target={a.link_url.startsWith("http") ? "_blank" : undefined}
                      rel="noreferrer"
                      className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${v.accent} hover:underline`}
                    >
                      {a.link_label || "Learn more"}
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                <button
                  onClick={() => {
                    addDismissed(a.id);
                    setDismissed(getDismissed());
                  }}
                  aria-label="Dismiss"
                  className="shrink-0 w-7 h-7 grid place-items-center rounded-md hover:bg-background/30 text-foreground/60 hover:text-foreground"
                >
                  <X size={14} />
                </button>
              </div>
            </m.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
