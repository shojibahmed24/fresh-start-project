// MobilePreviewPill — floating bottom pill on mobile chat view that lets the
// user jump to the preview tab. Auto-shows after files are written or after
// a successful generation completes; auto-hides after a short delay so it
// doesn't linger forever.
import { memo, useEffect, useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { Eye, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  /** Show only when on a mobile screen. Caller usually gates this with `isMobile`. */
  visible: boolean;
  /** Bumps the visibility timer — pass a counter that increments on file writes. */
  trigger?: number;
  onOpen: () => void;
  /** Auto-hide after N ms. 0 = never. Default 8000. */
  autoHideMs?: number;
  className?: string;
};

export const MobilePreviewPill = memo(function MobilePreviewPill({
  visible,
  trigger = 0,
  onOpen,
  autoHideMs = 8000,
  className,
}: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!visible) {
      setShow(false);
      return;
    }
    setShow(true);
    if (autoHideMs <= 0) return;
    const t = setTimeout(() => setShow(false), autoHideMs);
    return () => clearTimeout(t);
  }, [visible, trigger, autoHideMs]);

  return (
    <AnimatePresence>
      {show && (
        <m.button
          type="button"
          onClick={() => {
            setShow(false);
            onOpen();
          }}
          initial={{ opacity: 0, y: 16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 380, damping: 26 }}
          aria-label="Open preview"
          className={cn(
            "fixed left-1/2 -translate-x-1/2 z-40",
            "inline-flex items-center gap-2 rounded-full",
            "px-4 py-2.5 text-[13px] font-semibold",
            "bg-gradient-primary text-background",
            "shadow-[0_10px_28px_-8px_hsl(var(--primary)/0.6),0_0_0_1px_hsl(var(--primary)/0.3)]",
            "active:scale-95 transition-transform",
            className,
          )}
          style={{
            // Keep clear of the bottom nav + safe area
            bottom: "calc(env(safe-area-inset-bottom) + 88px)",
          }}
        >
          <span className="relative inline-flex items-center justify-center">
            <Eye size={15} />
            <span className="absolute -top-1 -right-1 size-2 rounded-full bg-emerald-400 animate-pulse" />
          </span>
          View preview
          <Sparkles size={12} className="opacity-80" />
        </m.button>
      )}
    </AnimatePresence>
  );
});
