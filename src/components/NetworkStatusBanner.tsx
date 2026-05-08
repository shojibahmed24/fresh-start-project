import { AnimatePresence, m } from "framer-motion";
import { WifiOff, Gauge, Clock } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

type Props = {
  // Number of messages waiting to be sent once we're back online.
  queuedCount?: number;
};

// Top-of-screen banner that surfaces network issues. Shown when:
//  - offline → red "No connection" + queued count
//  - slow link → amber "Slow connection" hint
// Sits below the safe-area inset so it doesn't collide with the notch.
export const NetworkStatusBanner = ({ queuedCount = 0 }: Props) => {
  const { online, isSlow, effectiveType, saveData } = useNetworkStatus();

  const variant = !online ? "offline" : isSlow ? "slow" : null;

  return (
    <AnimatePresence>
      {variant && (
        <m.div
          key={variant}
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          role="status"
          aria-live="polite"
          className="fixed top-0 inset-x-0 z-[60] pt-safe pointer-events-none"
        >
          <div
            className={`mx-auto max-w-md mt-1 mx-2 rounded-xl px-3 py-2 flex items-center gap-2 text-[12.5px] font-medium shadow-lg backdrop-blur-md border pointer-events-auto ${
              variant === "offline"
                ? "bg-destructive/15 border-destructive/40 text-destructive"
                : "bg-warning/15 border-warning/40 text-warning"
            }`}
          >
            {variant === "offline" ? (
              <>
                <WifiOff className="size-4 shrink-0" />
                <span className="flex-1 truncate">
                  No connection
                  {queuedCount > 0 && ` — ${queuedCount} queued`}
                </span>
                {queuedCount > 0 && (
                  <Clock className="size-3.5 shrink-0 opacity-70" />
                )}
              </>
            ) : (
              <>
                <Gauge className="size-4 shrink-0" />
                <span className="flex-1 truncate">
                  Slow connection ({saveData ? "data saver" : effectiveType}) — replies may take longer
                </span>
              </>
            )}
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
};
