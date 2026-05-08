// ═══════════════════════════════════════════════════════════════════════════
// StreamingFileWrite — letter-by-letter "typing" preview of a file write.
// ───────────────────────────────────────────────────────────────────────────
// Pulls live state from the streamingFiles registry (frontend-only animation
// over the backend's bulk write). Auto-scrolls to the cursor, shows a live
// progress bar + char counter, and offers a "Show all" skip button.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { m } from "framer-motion";
import { ChevronsDown, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStreamingFile, skipStreaming } from "@/lib/streamingFiles";

const langFor = (path: string): string => {
  if (path.endsWith(".tsx") || path.endsWith(".ts")) return "tsx";
  if (path.endsWith(".jsx") || path.endsWith(".js")) return "jsx";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".sql")) return "sql";
  return "text";
};

type Props = {
  path: string;
  /** Max viewport height in px before content scrolls internally. */
  maxHeight?: number;
};

export const StreamingFileWrite = ({ path, maxHeight = 280 }: Props) => {
  const state = useStreamingFile(path);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom while still revealing.
  useEffect(() => {
    if (!state || state.done) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [state?.revealed, state?.done, state]);

  if (!state) return null;

  const visible = state.full.slice(0, state.revealed);
  const lang = langFor(path);
  const percent = state.full.length === 0
    ? 100
    : Math.round((state.revealed / state.full.length) * 100);
  const filename = path.split("/").pop() ?? path;

  return (
    <m.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="mt-2 overflow-hidden rounded-lg border border-primary/20 bg-[hsl(240_10%_4%)] shadow-[0_0_0_1px_hsl(var(--primary)/0.08)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-[hsl(0_0%_100%/0.06)] bg-[hsl(0_0%_100%/0.02)] px-3 py-1.5">
        <div className="flex items-center gap-2 min-w-0 text-xs font-mono text-[hsl(var(--foreground-muted))]">
          <FileCode className="size-3.5 shrink-0 text-primary/80" aria-hidden />
          <span className="truncate text-foreground">{filename}</span>
          <span className="shrink-0 inline-flex items-center rounded-md border border-primary/25 bg-primary/10 px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-wider text-primary">
            {lang}
          </span>
          {!state.done && (
            <span className="shrink-0 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-primary/80">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              writing
            </span>
          )}
          {state.done && (
            <span className="shrink-0 text-[10px] uppercase tracking-wider text-emerald-400">
              ✓ done
            </span>
          )}
        </div>
        {!state.done && (
          <button
            type="button"
            onClick={() => skipStreaming(path)}
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium",
              "text-[hsl(var(--foreground-muted))] hover:text-foreground",
              "hover:bg-[hsl(0_0%_100%/0.06)] transition-colors duration-150",
            )}
          >
            <ChevronsDown className="size-3" aria-hidden />
            Show all
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-[2px] w-full bg-[hsl(0_0%_100%/0.05)] overflow-hidden">
        <m.div
          className="h-full bg-gradient-to-r from-primary/60 via-primary to-primary/60"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.15, ease: "linear" }}
        />
      </div>

      {/* Code body */}
      <div
        ref={scrollRef}
        className="overflow-auto"
        style={{ maxHeight }}
      >
        <SyntaxHighlighter
          language={lang}
          style={oneDark}
          showLineNumbers
          customStyle={{
            margin: 0,
            padding: "0.75rem 1rem",
            background: "transparent",
            fontSize: "12px",
            fontFamily: "'Geist Mono', 'JetBrains Mono', ui-monospace, monospace",
            lineHeight: 1.55,
          }}
          codeTagProps={{
            style: {
              fontFamily: "'Geist Mono', 'JetBrains Mono', ui-monospace, monospace",
            },
          }}
          lineNumberStyle={{
            minWidth: "2em",
            paddingRight: "1em",
            color: "hsl(0 0% 35%)",
            userSelect: "none",
          }}
        >
          {visible || " "}
        </SyntaxHighlighter>
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between gap-2 border-t border-[hsl(0_0%_100%/0.06)] bg-[hsl(0_0%_100%/0.02)] px-3 py-1 text-[10.5px] font-mono text-[hsl(var(--foreground-subtle))]">
        <span>
          {state.revealed.toLocaleString()} / {state.full.length.toLocaleString()} chars
        </span>
        <span>{percent}%</span>
      </div>
    </m.div>
  );
};
