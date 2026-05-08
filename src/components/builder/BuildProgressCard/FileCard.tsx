import { useEffect, useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  AlertTriangle,
  XCircle,
  FileCode2,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EventIcon } from "./EventIcon";
import type { FileGroup } from "./types";

export function FileCard({
  group,
  inFlight,
  forceCollapsed,
}: {
  group: FileGroup;
  inFlight: boolean;
  forceCollapsed: boolean;
}) {
  const { path, events, status } = group;
  const isError = status === "error";
  const isWarn = status === "warn";
  const isOk = status === "ok";
  const isRunning = status === "running" || inFlight;

  // Auto-expand on error/warn; collapse when ok or when the whole build is done.
  const [open, setOpen] = useState<boolean>(isError || isWarn);
  useEffect(() => {
    if (isError || isWarn) setOpen(true);
    else if (forceCollapsed || isOk) setOpen(false);
  }, [isError, isWarn, isOk, forceCollapsed]);

  const fileName = path.split("/").pop() || path;
  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";

  const tint = isError
    ? "border-rose-500/30 bg-rose-500/[0.06] hover:bg-rose-500/[0.09]"
    : isWarn
    ? "border-amber-500/30 bg-amber-500/[0.05] hover:bg-amber-500/[0.08]"
    : isRunning
    ? "border-primary/25 bg-primary/[0.04] hover:bg-primary/[0.07]"
    : "border-[hsl(0_0%_100%/0.06)] bg-[hsl(0_0%_100%/0.02)] hover:bg-[hsl(0_0%_100%/0.04)]";

  const StatusBadge = () => {
    if (isError) return <XCircle className="size-3.5 text-rose-400" aria-hidden />;
    if (isWarn) return <AlertTriangle className="size-3.5 text-amber-400" aria-hidden />;
    if (isRunning) return <Loader2 className="size-3.5 text-primary animate-spin" aria-hidden />;
    if (isOk) return <CheckCircle2 className="size-3.5 text-emerald-400" aria-hidden />;
    return <Circle className="size-3.5 text-foreground/40" aria-hidden />;
  };

  return (
    <m.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -2 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      className={cn("rounded-lg border overflow-hidden transition-colors", tint)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left"
        aria-expanded={open}
      >
        <StatusBadge />
        <FileCode2 className="size-3.5 shrink-0 text-foreground/60" aria-hidden />
        <span className="font-mono text-[12px] font-medium text-foreground truncate">
          {fileName}
        </span>
        {dir && (
          <span className="font-mono text-[10.5px] text-[hsl(var(--foreground-muted))] truncate hidden sm:inline">
            {dir}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] tabular-nums text-[hsl(var(--foreground-muted))]">
            {events.length}
          </span>
          <m.span
            animate={{ rotate: open ? 90 : 0 }}
            transition={{ duration: 0.18 }}
            className="text-[hsl(var(--foreground-muted))]"
          >
            <ChevronRight className="size-3.5" aria-hidden />
          </m.span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <m.div
            key="file-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden border-t border-[hsl(0_0%_100%/0.05)]"
          >
            <div className="px-2.5 py-1.5 space-y-0.5">
              {events.map((e) => (
                <div
                  key={e.id}
                  className="flex items-start gap-2 text-[11.5px] leading-[1.5]"
                >
                  <span className="mt-[3px]">
                    <EventIcon kind={e.kind} />
                  </span>
                  <span
                    className={cn(
                      "flex-1 min-w-0 break-words text-foreground/80",
                      e.kind === "error" && "text-rose-300",
                      e.kind === "warn" && "text-amber-200/90",
                      e.kind === "debug" && "text-foreground/50 italic",
                    )}
                  >
                    {e.message}
                  </span>
                </div>
              ))}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
}
