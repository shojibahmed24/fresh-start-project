import { useEffect, useMemo, useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Sparkles,
  AlertTriangle,
  XCircle,
  Wrench,
  Hammer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EventIcon } from "./EventIcon";
import { FileCard } from "./FileCard";
import { Chip } from "./Chip";
import { groupByFile, formatElapsed } from "./utils";
import type { BuildProgressCardProps } from "./types";

export const BuildProgressCard = ({ events, status, startedAt, endedAt }: BuildProgressCardProps) => {
  const isRunning = status === "running";
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (status === "done") setOpen(false);
  }, [status]);

  const stats = useMemo(() => {
    const filesWritten = new Set<string>();
    let fixes = 0;
    let warnings = 0;
    let errors = 0;
    for (const e of events) {
      if (e.kind === "file" && e.path) filesWritten.add(e.path);
      if (e.kind === "fix") fixes++;
      if (e.kind === "warn") warnings++;
      if (e.kind === "error") errors++;
    }
    return { files: filesWritten.size, fixes, warnings, errors };
  }, [events]);

  // Debug events (auto-fix internals) are noise — hidden behind a toggle.
  const [showDebug, setShowDebug] = useState(false);
  const debugCount = useMemo(() => events.filter((e) => e.kind === "debug").length, [events]);
  const visibleEvents = useMemo(
    () => (showDebug ? events : events.filter((e) => e.kind !== "debug")),
    [events, showDebug],
  );

  const { groups, orphans } = useMemo(() => groupByFile(visibleEvents), [visibleEvents]);
  // While running, the most recently touched file is treated as "in-flight"
  // so its spinner stays alive even between its file/fix events.
  const inFlightPath = useMemo(() => {
    if (!isRunning) return null;
    for (let i = visibleEvents.length - 1; i >= 0; i--) {
      if (visibleEvents[i].path) return visibleEvents[i].path!;
    }
    return null;
  }, [visibleEvents, isRunning]);

  const totalFiles = groups.length;
  const doneFiles = groups.filter((g) => g.status === "ok").length;
  const allDone = !isRunning && totalFiles > 0 && doneFiles === totalFiles && stats.errors === 0;

  const [, force] = useState(0);
  useEffect(() => {
    if (!isRunning || !startedAt) return;
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [isRunning, startedAt]);

  const elapsedMs = endedAt && startedAt
    ? endedAt - startedAt
    : startedAt
    ? Date.now() - startedAt
    : 0;

  const latest = events[events.length - 1];

  const headerTint =
    status === "error"
      ? "from-rose-500/20 via-rose-500/5 to-transparent border-rose-500/30"
      : status === "done"
      ? "from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-500/25"
      : "from-primary/20 via-primary/5 to-transparent border-primary/30";

  const StatusIcon = status === "error" ? XCircle : status === "done" ? Sparkles : Hammer;

  return (
    <m.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "relative overflow-hidden rounded-xl border bg-gradient-to-br",
        "backdrop-blur-sm shadow-[0_4px_20px_-8px_hsl(var(--primary)/0.25)]",
        headerTint,
      )}
    >
      {isRunning && (
        <m.div
          className="pointer-events-none absolute inset-0 opacity-40"
          initial={{ backgroundPosition: "0% 50%" }}
          animate={{ backgroundPosition: "200% 50%" }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, hsl(var(--primary)/0.08) 50%, transparent 100%)",
            backgroundSize: "200% 100%",
          }}
          aria-hidden
        />
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative w-full flex items-center gap-3 px-3.5 py-2.5 text-left"
        aria-expanded={open}
      >
        <span
          className={cn(
            "shrink-0 flex items-center justify-center size-7 rounded-lg",
            status === "error"
              ? "bg-rose-500/20 text-rose-300"
              : status === "done"
              ? "bg-emerald-500/20 text-emerald-300"
              : "bg-primary/20 text-primary",
          )}
        >
          {isRunning ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <StatusIcon className="size-4" aria-hidden />
          )}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground tracking-tight">
            <span className="truncate">
              {status === "error"
                ? "Build interrupted"
                : status === "done"
                ? totalFiles > 0
                  ? `Built ${doneFiles}/${totalFiles} files`
                  : `Built ${stats.files} file${stats.files === 1 ? "" : "s"}`
                : totalFiles > 0
                ? `Building ${doneFiles}/${totalFiles} files…`
                : "Building your app…"}
            </span>
            <span className="text-[11px] font-mono font-normal text-[hsl(var(--foreground-muted))]">
              {elapsedMs > 0 ? formatElapsed(elapsedMs) : ""}
            </span>
          </div>

          <AnimatePresence mode="wait">
            <m.div
              key={isRunning ? latest?.id ?? "idle" : status}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="mt-0.5 flex items-center gap-2 text-[11.5px] text-[hsl(var(--foreground-muted))] truncate"
            >
              {isRunning && latest ? (
                <>
                  <EventIcon kind={latest.kind} />
                  <span className="truncate">{latest.message}</span>
                </>
              ) : status === "done" ? (
                <span className="truncate">
                  {stats.fixes > 0 ? `${stats.fixes} auto-fix${stats.fixes === 1 ? "" : "es"} • ` : ""}
                  {stats.warnings > 0 ? `${stats.warnings} warning${stats.warnings === 1 ? "s" : ""} • ` : ""}
                  Click to {open ? "hide" : "view"} build details
                </span>
              ) : (
                <span className="truncate">Click to {open ? "hide" : "view"} details</span>
              )}
            </m.div>
          </AnimatePresence>
        </div>

        <m.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 text-[hsl(var(--foreground-muted))]"
        >
          <ChevronDown className="size-4" aria-hidden />
        </m.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <m.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
            className="relative overflow-hidden border-t border-[hsl(0_0%_100%/0.06)]"
          >
            <div className="max-h-[320px] overflow-y-auto px-3 py-2.5 space-y-1.5 scrollbar-thin">
              {events.length === 0 && (
                <div className="text-[12px] text-[hsl(var(--foreground-muted))] py-1 px-1">
                  Waiting for the agent…
                </div>
              )}

              {/* "Show details" toggle — only renders when there are hidden
                  internal/auto-fix events. Animated chevron + tabular count. */}
              {debugCount > 0 && (
                <m.button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDebug((v) => !v);
                  }}
                  layout
                  initial={{ opacity: 0, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.005 }}
                  whileTap={{ scale: 0.995 }}
                  transition={{ duration: 0.15 }}
                  className={cn(
                    "group flex w-full items-center gap-2 rounded-md border px-2.5 py-1 text-left",
                    "border-[hsl(0_0%_100%/0.06)] bg-[hsl(0_0%_100%/0.02)]",
                    "hover:bg-[hsl(0_0%_100%/0.04)] transition-colors",
                  )}
                  aria-pressed={showDebug}
                >
                  <Wrench className="size-3 text-[hsl(var(--foreground-muted))]" aria-hidden />
                  <span className="text-[11px] text-[hsl(var(--foreground-muted))]">
                    {showDebug ? "Hide" : "Show"} {debugCount} internal{" "}
                    {debugCount === 1 ? "fix" : "fixes"}
                  </span>
                  <span
                    className={cn(
                      "ml-auto inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide",
                      showDebug
                        ? "bg-primary/15 text-primary"
                        : "bg-foreground/5 text-[hsl(var(--foreground-muted))]",
                    )}
                  >
                    {showDebug ? "Visible" : "Hidden"}
                  </span>
                  <m.span
                    animate={{ rotate: showDebug ? 90 : 0 }}
                    transition={{ duration: 0.18 }}
                    className="text-[hsl(var(--foreground-muted))]"
                  >
                    <ChevronRight className="size-3" aria-hidden />
                  </m.span>
                </m.button>
              )}

              {/* All-files-complete summary banner */}
              {allDone && (
                <m.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2",
                    "border-emerald-500/25 bg-emerald-500/[0.07]",
                  )}
                >
                  <Sparkles className="size-3.5 text-emerald-300" aria-hidden />
                  <span className="text-[12px] font-medium text-emerald-100">
                    Built {doneFiles}/{totalFiles} files
                  </span>
                  {stats.fixes > 0 && (
                    <span className="text-[11px] text-[hsl(var(--foreground-muted))]">
                      • {stats.fixes} auto-fix{stats.fixes === 1 ? "" : "es"}
                    </span>
                  )}
                </m.div>
              )}

              {/* Per-file collapsible cards */}
              <AnimatePresence initial={false}>
                {groups.map((g) => (
                  <FileCard
                    key={g.path}
                    group={g}
                    inFlight={inFlightPath === g.path && isRunning}
                    forceCollapsed={allDone}
                  />
                ))}
              </AnimatePresence>

              {/* Orphan (non-file) events shown as compact stage rows */}
              {orphans.length > 0 && (
                <div className="pt-1 space-y-0.5">
                  {orphans.map((e) => (
                    <m.div
                      key={e.id}
                      layout
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.16 }}
                      className="flex items-start gap-2 px-1 text-[12px] leading-[1.5] text-foreground/75"
                    >
                      <span className="mt-[3px]">
                        <EventIcon kind={e.kind} />
                      </span>
                      <span
                        className={cn(
                          "flex-1 min-w-0 break-words",
                          e.kind === "error" && "text-rose-300",
                          e.kind === "warn" && "text-amber-200/90",
                          e.kind === "milestone" && "text-foreground/95 font-medium",
                          e.kind === "debug" && "text-foreground/55 italic",
                        )}
                      >
                        {e.message}
                      </span>
                    </m.div>
                  ))}
                </div>
              )}
            </div>

            {!isRunning && events.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 px-3.5 pb-2.5 pt-1 text-[11px]">
                <Chip tone="success" icon={<CheckCircle2 className="size-3" />} label={`${stats.files} files`} />
                {stats.fixes > 0 && (
                  <Chip tone="info" icon={<Wrench className="size-3" />} label={`${stats.fixes} fixes`} />
                )}
                {stats.warnings > 0 && (
                  <Chip tone="warn" icon={<AlertTriangle className="size-3" />} label={`${stats.warnings} warnings`} />
                )}
                {stats.errors > 0 && (
                  <Chip tone="error" icon={<XCircle className="size-3" />} label={`${stats.errors} errors`} />
                )}
              </div>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
};
