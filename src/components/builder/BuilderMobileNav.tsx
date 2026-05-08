// Mobile bottom navigation: Chat / Code / Preview tabs with animated indicator,
// glow, and haptic feedback. Pulled out of Builder.tsx for clarity.

import { m } from "framer-motion";
import { MessageSquare, FileCode, Eye } from "lucide-react";
import { haptic } from "@/lib/haptics";

export type MobileView = "chat" | "code" | "preview";

const TABS = [
  { key: "chat", icon: MessageSquare, label: "Chat" },
  { key: "code", icon: FileCode, label: "Code" },
  { key: "preview", icon: Eye, label: "Preview" },
] as const;

export const BuilderMobileNav = ({
  mobileView,
  setMobileView,
}: {
  mobileView: MobileView;
  setMobileView: (v: MobileView) => void;
}) => {
  return (
    <nav
      className="shrink-0 grid grid-cols-3 bg-[hsl(var(--bg-elevated))] border-t border-[hsl(0_0%_100%/0.08)] backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map(({ key, icon: Icon, label }) => {
        const active = mobileView === key;
        return (
          <button
            key={key}
            onClick={() => {
              if (mobileView !== key) haptic("light");
              setMobileView(key);
            }}
            className="relative flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[52px] transition-colors active:scale-95"
            aria-label={label}
            aria-current={active ? "page" : undefined}
          >
            {active && (
              <m.span
                layoutId="mobile-tab-indicator"
                className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-10 rounded-full bg-gradient-primary"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            {active && (
              <m.span
                layoutId="mobile-tab-glow"
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] size-12 rounded-full pointer-events-none"
                style={{
                  background: "radial-gradient(circle, hsl(var(--primary) / 0.22) 0%, transparent 70%)",
                }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                aria-hidden
              />
            )}
            <m.span
              animate={{ scale: active ? 1.22 : 1, y: active ? -1 : 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 18 }}
              className="relative"
            >
              <Icon
                size={18}
                className={
                  active
                    ? "text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]"
                    : "text-[hsl(var(--foreground-muted))]"
                }
              />
            </m.span>
            <m.span
              animate={{ opacity: active ? 1 : 0.7, scale: active ? 1 : 0.96 }}
              transition={{ duration: 0.15 }}
              className={`text-[10px] font-medium ${active ? "text-foreground" : "text-[hsl(var(--foreground-muted))]"}`}
            >
              {label}
            </m.span>
          </button>
        );
      })}
    </nav>
  );
};
