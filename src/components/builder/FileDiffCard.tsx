import { forwardRef, useEffect, useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { FilePlus2, FilePen, ChevronDown, FileStack, Eye } from "lucide-react";
import { getFileIcon } from "./file-icons";
import { cn } from "@/lib/utils";
import { PathHighlight } from "./PathHighlight";
import { StreamingFileWrite } from "./StreamingFileWrite";
import {
  useStreamingFile,
  subscribeStreaming,
  getStreaming,
} from "@/lib/streamingFiles";
import type { ProjectFile } from "@/lib/store";

export type FileChange = {
  path: string;
  kind: "created" | "modified";
  additions?: number;
  deletions?: number;
};

type Props = {
  changes: FileChange[];
  existingPaths: Set<string>;
  activePath?: string;
  onOpen: (path: string) => void;
  /** Collapse the list when there are more than this many files. Default: 3. */
  collapseThreshold?: number;
  /** Optional — provides current file content for the inline preview toggle. */
  projectFiles?: ProjectFile[];
};

/**
 * Renders a tidy list of file-change cards with aggregate +/- counts and a
 * collapsible header when there are many files. Tapping a card opens that
 * file in the editor; tapping the header expands/collapses the group.
 */
export const FileDiffList = forwardRef<HTMLDivElement, Props>(
  ({ changes, existingPaths, activePath, onOpen, collapseThreshold = 3, projectFiles }, ref) => {
    // Dedupe by path (keep last occurrence) — done before any hooks so length is stable.
    const seen = new Map<string, FileChange>();
    for (const c of changes) seen.set(c.path, c);
    const list = Array.from(seen.values());

    const startsCollapsed = list.length > collapseThreshold;
    const [collapsed, setCollapsed] = useState(startsCollapsed);
    // If ANY file in this group is mid-stream, force the list open so the
    // user actually sees the typewriter animation playing.
    const anyStreaming = useAnyStreaming(list.map((c) => c.path));
    const effectiveCollapsed = anyStreaming ? false : collapsed;

    if (list.length === 0) return null;

    const totals = list.reduce(
      (acc, c) => ({
        adds: acc.adds + (c.additions ?? 0),
        dels: acc.dels + (c.deletions ?? 0),
        created: acc.created + (c.kind === "created" || !existingPaths.has(c.path) ? 1 : 0),
      }),
      { adds: 0, dels: 0, created: 0 },
    );
    const modified = list.length - totals.created;

    return (
      <div ref={ref} className="mt-2.5 not-prose">
        {/* Group header — always rendered, doubles as collapse/expand toggle */}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className={cn(
            "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg",
            "bg-[hsl(var(--bg-subtle))] border border-[hsl(0_0%_100%/0.06)]",
            "hover:bg-[hsl(var(--bg-elevated))] hover:border-primary/30 transition-all",
            "text-[11.5px] font-mono text-[hsl(var(--foreground-muted))]",
            !effectiveCollapsed && "rounded-b-none border-b-0",
          )}
          aria-expanded={!effectiveCollapsed}
        >
          <FileStack size={12} className="text-primary/80 shrink-0" />
          <span className="font-semibold text-foreground">
            {list.length} {list.length === 1 ? "file" : "files"}
          </span>
          <span className="opacity-70 truncate">
            {totals.created > 0 && `${totals.created} new`}
            {totals.created > 0 && modified > 0 && " · "}
            {modified > 0 && `${modified} edit${modified === 1 ? "" : "s"}`}
          </span>
          <span className="ml-auto flex items-center gap-1.5 shrink-0">
            {totals.adds > 0 && <span className="text-emerald-400">+{totals.adds}</span>}
            {totals.dels > 0 && <span className="text-rose-400">−{totals.dels}</span>}
            <ChevronDown
              size={13}
              className={cn(
                "text-[hsl(var(--foreground-subtle))] transition-transform duration-200",
                effectiveCollapsed && "-rotate-90",
              )}
            />
          </span>
        </button>

        <AnimatePresence initial={false}>
          {!effectiveCollapsed && (
            <m.div
              key="diff-list"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
              className={cn(
                "overflow-hidden",
                "rounded-b-lg border-x border-b border-[hsl(0_0%_100%/0.06)] bg-[hsl(var(--bg-subtle))]/40",
              )}
            >
              <div className="p-1 space-y-1">
                {list.map((c, i) => (
                  <FileDiffCard
                    key={c.path}
                    change={c}
                    isNew={!existingPaths.has(c.path) || c.kind === "created"}
                    isActive={activePath === c.path}
                    onOpen={() => onOpen(c.path)}
                    delay={i * 0.03}
                  />
                ))}
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);
FileDiffList.displayName = "FileDiffList";

// Re-render whenever ANY of the listed paths changes streaming state.
function useAnyStreaming(paths: string[]): boolean {
  const [, force] = useState(0);
  useEffect(() => {
    const unsubs = paths.map((p) => subscribeStreaming(p, () => force((n) => n + 1)));
    return () => { for (const u of unsubs) u(); };
  }, [paths.join("|")]);
  return paths.some((p) => {
    const s = getStreaming(p);
    return !!s && !s.done;
  });
}

const FileDiffCard = ({
  change,
  isNew,
  isActive,
  onOpen,
  delay,
}: {
  change: FileChange;
  isNew: boolean;
  isActive: boolean;
  onOpen: () => void;
  delay: number;
}) => {
  const { Icon, colorClass } = getFileIcon(change.path);
  const Action = isNew ? FilePlus2 : FilePen;
  const streaming = useStreamingFile(change.path);
  const isStreaming = !!streaming && !streaming.done;

  return (
    <div className="space-y-1">
      <m.button
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, delay, ease: [0.4, 0, 0.2, 1] }}
        onClick={onOpen}
        className={cn(
          "group w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-full",
          "backdrop-blur-md border border-transparent",
          "hover:bg-[hsl(var(--bg-elevated))] hover:border-white/[0.08]",
          "transition-all duration-150 text-left",
          isActive && "bg-primary/10 border-primary/30 ring-1 ring-primary/20",
          isStreaming && "bg-primary/5 border-primary/20",
        )}
      >
        <div
          className={cn(
            "shrink-0 size-6 rounded-full flex items-center justify-center ring-1",
            isStreaming
              ? "bg-primary/15 ring-primary/40 text-primary animate-pulse"
              : isNew
              ? "bg-emerald-500/10 ring-emerald-500/30 text-emerald-400"
              : "bg-amber-500/10 ring-amber-500/30 text-amber-400",
          )}
          aria-hidden
        >
          <Action size={11} />
        </div>

        <Icon size={13} className={cn("shrink-0", colorClass)} />

        <div className="flex-1 min-w-0 flex items-baseline">
          <PathHighlight path={change.path} className="text-[12px]" />
        </div>

        <div className="shrink-0 flex items-center gap-1.5 font-mono text-[10.5px]">
          {isStreaming && (
            <span className="inline-flex items-center gap-1 text-primary">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              writing
            </span>
          )}
          {!isStreaming && typeof change.additions === "number" && change.additions > 0 && (
            <span className="text-emerald-400">+{change.additions}</span>
          )}
          {!isStreaming && typeof change.deletions === "number" && change.deletions > 0 && (
            <span className="text-rose-400">−{change.deletions}</span>
          )}
          {!isStreaming && (
            <span className="text-[hsl(var(--foreground-subtle))] uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
              {isNew ? "new" : "edit"}
            </span>
          )}
        </div>
      </m.button>

      <AnimatePresence initial={false}>
        {isStreaming && (
          <m.div
            key="stream"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden px-1"
          >
            <StreamingFileWrite path={change.path} />
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
};
