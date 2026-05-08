import type { Snippet } from "../types.ts";

export const KOKO_NOTIFICATION: Snippet = {
  name: "Notification list item with dot + actor + relative time",
  why: "Notifications need an actor avatar, an action verb, an optional thumbnail, and an unread dot.",
  uses: ["lucide-react: any verb icon"],
  code: `function NotificationItem({ n }) {
  // n: { id, actor: {name, avatar}, verb, target?, thumb?, time, unread }
  return (
    <li className={\`relative flex gap-3 px-4 py-3 hover:bg-muted/40 transition
      \${n.unread ? "bg-primary/5" : ""}\`}>
      {n.unread && <span className="absolute left-1.5 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />}
      <img src={n.actor.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          <span className="font-semibold">{n.actor.name}</span>{" "}
          <span className="text-muted-foreground">{n.verb}</span>
          {n.target && <span className="font-medium"> {n.target}</span>}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{n.time}</p>
      </div>
      {n.thumb && <img src={n.thumb} alt="" className="h-10 w-10 rounded-lg object-cover" />}
    </li>
  );
}`,
};

export const KOKO_TOAST: Snippet = {
  name: "Animated toast notification",
  why: "Feedback needs a slide-in toast with icon + message + dismiss, not a browser alert.",
  uses: ["framer-motion", "lucide-react: CheckCircle2, X"],
  code: `function Toast({ message, kind = "success", onDismiss }) {
  const tones = {
    success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    error:   "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
    info:    "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
      className={\`fixed top-4 inset-x-4 z-50 flex items-center gap-3 rounded-2xl border backdrop-blur
        px-4 py-3 shadow-lg \${tones[kind]}\`}>
      <CheckCircle2 className="h-5 w-5 shrink-0" />
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button onClick={onDismiss}><X className="h-4 w-4 opacity-70" /></button>
    </motion.div>
  );
}`,
};

export const KOKO_EMPTY_STATE: Snippet = {
  name: "Illustrated empty state with CTA",
  why: "Empty lists must be designed: icon-in-circle + headline + helper + primary action — never blank.",
  uses: ["lucide-react: any topic icon"],
  code: `function EmptyState({ Icon, title, body, ctaLabel, onCta }) {
  return (
    <div className="grid place-items-center py-16 px-6 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-base font-bold">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground leading-relaxed">{body}</p>
      {ctaLabel && (
        <button onClick={onCta}
          className="mt-5 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold
            hover:scale-[1.02] transition">
          {ctaLabel}
        </button>
      )}
    </div>
  );
}`,
};

export const KOKO_BOTTOM_SHEET: Snippet = {
  name: "Bottom sheet modal with drag handle",
  why: "Mobile actions/details should slide up from bottom with a handle — not a centered web modal.",
  uses: ["framer-motion"],
  code: `function BottomSheet({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-3xl bg-card
          border-t border-border shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.3)]">
        <div className="grid place-items-center pt-2.5 pb-1">
          <span className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        {title && <h3 className="px-5 py-3 text-base font-bold border-b border-border/50">{title}</h3>}
        <div className="p-5">{children}</div>
      </motion.div>
    </>
  );
}`,
};

