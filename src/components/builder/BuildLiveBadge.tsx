// Floating live-build badge shown at the bottom-right of the Builder when
// an APK build is in flight and the BuildAPKDialog is closed. Click to
// reopen the dialog bound to the active build. Uses realtime hooks so the
// % progress and current step update without polling.

import { useMemo } from "react";
import { m, AnimatePresence } from "framer-motion";
import { Smartphone, Loader2, X } from "lucide-react";
import { useBuildLive } from "@/hooks/useAppBuilds";
import { cn } from "@/lib/utils";

type Props = {
  buildId: string | null;
  visible: boolean;            // hide when dialog is open
  onClick: () => void;         // reopen dialog
  onDismiss?: () => void;      // optional: stop tracking
};

export function BuildLiveBadge({ buildId, visible, onClick, onDismiss }: Props) {
  const { build, steps } = useBuildLive(buildId);

  const progress = useMemo(() => {
    if (!steps.length) return 0;
    const done = steps.filter((s) => s.status === "done").length;
    return Math.round((done / steps.length) * 100);
  }, [steps]);

  const current = useMemo(
    () => steps.find((s) => s.status === "running") ?? null,
    [steps],
  );

  const show = visible && !!buildId && !!build &&
    build.status !== "ready" && build.status !== "failed" && build.status !== "cancelled";

  return (
    <AnimatePresence>
      {show && (
        <m.div
          key={buildId}
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className={cn(
            "fixed z-30 bottom-4 right-4 md:bottom-6 md:right-6",
            "max-w-[300px] w-[calc(100vw-2rem)] md:w-[300px]",
          )}
          style={{
            paddingBottom: "env(safe-area-inset-bottom)",
            paddingRight: "env(safe-area-inset-right)",
          }}
        >
          <button
            type="button"
            onClick={onClick}
            className={cn(
              "group relative w-full overflow-hidden rounded-xl border border-primary/30",
              "bg-gradient-to-br from-primary/15 via-background/95 to-background/95",
              "backdrop-blur-md shadow-[0_8px_28px_-8px_hsl(var(--primary)/0.45)]",
              "px-3 py-2.5 text-left",
              "hover:border-primary/50 transition-colors",
            )}
            aria-label="Reopen build progress"
          >
            {/* shimmer */}
            <m.div
              className="pointer-events-none absolute inset-0 opacity-50"
              initial={{ backgroundPosition: "0% 50%" }}
              animate={{ backgroundPosition: "200% 50%" }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, hsl(var(--primary)/0.10) 50%, transparent 100%)",
                backgroundSize: "200% 100%",
              }}
              aria-hidden
            />

            <div className="relative flex items-center gap-2.5">
              <span className="shrink-0 size-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
                <Smartphone size={14} />
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground tracking-tight">
                  <Loader2 className="size-3 animate-spin text-primary" aria-hidden />
                  <span className="truncate">
                    Building APK{build?.status ? ` • ${build.status}` : ""}
                  </span>
                  <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                    {progress}%
                  </span>
                </div>

                <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                  <m.div
                    className="h-full rounded-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.35 }}
                  />
                </div>

                <div className="mt-1 truncate text-[10.5px] text-muted-foreground">
                  {current?.label ?? steps[steps.length - 1]?.label ?? "Queueing…"}
                </div>
              </div>

              {onDismiss && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      onDismiss();
                    }
                  }}
                  className="shrink-0 -mr-1 -mt-1 self-start size-5 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                  aria-label="Dismiss badge"
                >
                  <X size={12} />
                </span>
              )}
            </div>
          </button>
        </m.div>
      )}
    </AnimatePresence>
  );
}
