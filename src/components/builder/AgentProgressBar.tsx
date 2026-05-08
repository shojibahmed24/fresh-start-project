// AgentProgressBar — determinate progress bar for long-running agent tasks.
// Driven by the `report_progress` tool (Phase 11). Shows current/total,
// optional textual label, percentage, and an ETA derived server-side.
import { memo } from "react";
import { m, AnimatePresence } from "framer-motion";
import { Clock, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";

export type AgentProgress = {
  current: number;
  total: number;
  percent: number;
  label?: string;
  eta_seconds?: number | null;
};

type Props = {
  progress: AgentProgress | null;
  className?: string;
};

function formatEta(seconds: number | null | undefined): string | null {
  if (!seconds || !isFinite(seconds) || seconds <= 0) return null;
  if (seconds < 60) return `${Math.round(seconds)}s left`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 10) return `${m}m ${s}s left`;
  return `~${m} min left`;
}

export const AgentProgressBar = memo(function AgentProgressBar({
  progress,
  className,
}: Props) {
  return (
    <AnimatePresence initial={false}>
      {progress && progress.total > 0 && (
        <m.div
          key="agent-progress"
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className={cn("overflow-hidden", className)}
          role="status"
          aria-live="polite"
          aria-label={`Progress ${progress.current} of ${progress.total}`}
        >
          <div className="rounded-lg border border-primary/20 bg-[hsl(var(--bg-elevated))]/70 backdrop-blur-md px-3 py-2 shadow-[0_2px_12px_-4px_hsl(var(--primary)/0.25)]">
            {/* Top row: label + counts + ETA */}
            <div className="flex items-center gap-2 text-[11px] font-medium">
              <Hourglass size={12} className="shrink-0 text-primary animate-pulse" />
              <span className="flex-1 min-w-0 truncate text-foreground">
                {progress.label || "Working"}
              </span>
              <span className="shrink-0 font-mono text-[10.5px] text-[hsl(var(--foreground-muted))]">
                {progress.current}/{progress.total}
              </span>
              {(() => {
                const eta = formatEta(progress.eta_seconds);
                return eta ? (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary border border-primary/20">
                    <Clock size={9} />
                    {eta}
                  </span>
                ) : null;
              })()}
            </div>

            {/* Track + fill */}
            <div className="relative mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <m.div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary via-primary to-[hsl(var(--accent-cyan))]"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(2, Math.min(100, progress.percent))}%` }}
                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              />
              {/* Subtle moving sheen — uses the existing CSS `shimmer` keyframe (background-position based). */}
              <div
                className="pointer-events-none absolute inset-0 rounded-full motion-reduce:hidden"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, hsl(0 0% 100% / 0.22) 50%, transparent 100%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 1.8s linear infinite",
                }}
                aria-hidden
              />
            </div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
});
