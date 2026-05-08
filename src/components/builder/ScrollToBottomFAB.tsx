// ScrollToBottomFAB — shows a floating "jump to latest" button when the user
// has scrolled away from the bottom of a scroll container. Auto-hides when
// the user is already near the bottom. Designed to sit above the chat input.
import { memo, useEffect, useState, type RefObject } from "react";
import { m, AnimatePresence } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  scrollRef: RefObject<HTMLElement | null>;
  /** Distance from bottom (in px) before the FAB appears. Default 200. */
  threshold?: number;
  className?: string;
  /** Optional badge count (e.g. unread new messages). */
  newCount?: number;
};

export const ScrollToBottomFAB = memo(function ScrollToBottomFAB({
  scrollRef,
  threshold = 200,
  className,
  newCount,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setVisible(distanceFromBottom > threshold);
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    // Also re-check on resize so the FAB hides when the container grows.
    const ro = new ResizeObserver(onScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [scrollRef, threshold]);

  const jump = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  return (
    <AnimatePresence>
      {visible && (
        <m.button
          type="button"
          onClick={jump}
          initial={{ opacity: 0, y: 12, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.85 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          aria-label="Scroll to latest message"
          className={cn(
            "absolute left-1/2 -translate-x-1/2 z-20",
            "inline-flex items-center gap-1.5 rounded-full",
            "px-3 py-1.5 text-[12px] font-medium",
            "bg-[hsl(var(--bg-elevated))]/90 backdrop-blur-md",
            "border border-primary/30 text-foreground",
            "shadow-lg shadow-primary/10",
            "hover:bg-primary/15 hover:border-primary/50",
            "transition-colors",
            className,
          )}
        >
          <ArrowDown size={13} className="text-primary" />
          <span>{newCount && newCount > 0 ? `${newCount} new` : "Jump to latest"}</span>
        </m.button>
      )}
    </AnimatePresence>
  );
});
