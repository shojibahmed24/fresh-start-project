import { useEffect, useState } from "react";
import { m } from "framer-motion";

const STATUSES = [
  { at: 0, label: "Thinking" },
  { at: 2200, label: "Generating" },
  { at: 6500, label: "Almost done" },
];

/**
 * Streaming indicator shown under the assistant skeleton bubble while we
 * wait for the first token. Three signals stacked together:
 *  • shimmer skeleton lines (fake "writing" cadence)
 *  • status text that progresses Thinking → Generating → Almost done
 *  • three bouncing dots (chat-style typing animation)
 */
export const StreamingIndicator = () => {
  const [status, setStatus] = useState(STATUSES[0].label);

  useEffect(() => {
    const timers = STATUSES.map((s) =>
      window.setTimeout(() => setStatus(s.label), s.at),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <m.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="px-1 py-1 space-y-2.5"
      aria-live="polite"
      aria-label={`${status}…`}
    >
      {/* Shimmer skeleton lines */}
      <div className="space-y-2">
        <ShimmerLine width="92%" />
        <ShimmerLine width="78%" />
        <ShimmerLine width="55%" />
      </div>
      {/* Status text + animated typing dots */}
      <div className="flex items-center gap-2 pt-0.5">
        <m.span
          key={status}
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[11px] font-mono uppercase tracking-wider text-[hsl(var(--foreground-subtle))]"
        >
          {status}
        </m.span>
        <TypingDots />
      </div>
    </m.div>
  );
};

/** Three bouncing dots — staggered y-translate gives a classic "typing" feel. */
const TypingDots = () => (
  <span className="inline-flex items-end gap-[3px] h-[10px]" aria-hidden>
    {[0, 1, 2].map((i) => (
      <m.span
        key={i}
        className="block size-[5px] rounded-full bg-primary/80"
        animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "easeInOut",
          delay: i * 0.15,
        }}
      />
    ))}
  </span>
);

const ShimmerLine = ({ width }: { width: string }) => (
  <div
    className="h-3 rounded-md relative overflow-hidden bg-[hsl(0_0%_100%/0.04)]"
    style={{ width }}
  >
    <div
      className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_linear_infinite] bg-gradient-to-r from-transparent via-[hsl(var(--primary)/0.15)] to-transparent"
      style={{ backgroundSize: "200% 100%" }}
    />
  </div>
);
