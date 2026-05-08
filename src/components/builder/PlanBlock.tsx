// PlanBlock — renders a structured, animated checklist from a markdown plan.
// Detects a "Plan" section in the assistant's message and converts the
// bullet/numbered items into checkable task rows with progress indicator.
//
// Detection: matches a heading like "## Plan", "**Plan:**", or "Plan:" at the
// start of a line, followed by consecutive list items (- / * / 1.).
//
// Items are inferred as "done" when the message has finished streaming AND
// downstream tool activity exists for that step (caller can pass
// `completedCount` to override). By default we mark all items pending while
// streaming and all done once the message is complete.
import { memo } from "react";
import { m } from "framer-motion";
import { CheckCircle2, Circle, ListChecks, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type PlanItem = {
  text: string;
  status: "done" | "running" | "pending";
};

type Props = {
  items: PlanItem[];
  title?: string;
  className?: string;
};

export const PlanBlock = memo(function PlanBlock({
  items,
  title = "Plan",
  className,
}: Props) {
  if (items.length === 0) return null;
  const done = items.filter((i) => i.status === "done").length;
  const total = items.length;
  const pct = Math.round((done / total) * 100);
  const allDone = done === total;

  return (
    <m.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={cn(
        "not-prose my-3 rounded-xl border backdrop-blur-md overflow-hidden",
        "border-primary/20 bg-gradient-to-br from-primary/[0.06] via-primary/[0.02] to-transparent",
        className,
      )}
    >
      {/* Header with progress bar */}
      <div className="px-3 py-2 border-b border-primary/10">
        <div className="flex items-center gap-2 text-[12px]">
          <span className="inline-flex items-center justify-center size-5 rounded-full bg-primary/15 ring-1 ring-primary/25">
            <ListChecks size={11} className="text-primary" />
          </span>
          <span className="font-semibold text-foreground tracking-tight">{title}</span>
          <span className="ml-auto font-mono text-[10.5px] text-[hsl(var(--foreground-muted))]">
            {done}/{total} {allDone && "✓"}
          </span>
        </div>
        <div className="mt-1.5 h-1 w-full rounded-full bg-white/5 overflow-hidden">
          <m.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className={cn(
              "h-full rounded-full",
              allDone
                ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                : "bg-gradient-to-r from-primary to-primary/60",
            )}
          />
        </div>
      </div>

      {/* Items */}
      <ul className="px-2 py-1.5 space-y-0.5">
        {items.map((item, i) => {
          const Icon =
            item.status === "done"
              ? CheckCircle2
              : item.status === "running"
                ? Loader2
                : Circle;
          return (
            <m.li
              key={i}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.18, delay: i * 0.04 }}
              className={cn(
                "flex items-start gap-2 px-2 py-1.5 rounded-lg text-[13px] leading-snug",
                item.status === "running" && "bg-primary/[0.04]",
              )}
            >
              <Icon
                size={13}
                className={cn(
                  "shrink-0 mt-[3px]",
                  item.status === "done" && "text-emerald-400",
                  item.status === "running" && "text-primary animate-spin",
                  item.status === "pending" && "text-[hsl(var(--foreground-subtle))]",
                )}
              />
              <span
                className={cn(
                  "min-w-0",
                  item.status === "done" && "text-foreground/70 line-through decoration-foreground/30",
                  item.status === "running" && "text-foreground font-medium",
                  item.status === "pending" && "text-foreground/85",
                )}
              >
                {item.text}
              </span>
            </m.li>
          );
        })}
      </ul>
    </m.div>
  );
});

/**
 * Extract a "Plan" section from markdown content. Returns the parsed items
 * plus the content with the plan section removed (so it can be replaced by
 * the rich PlanBlock without duplicating text).
 *
 * Matches:
 *   ## Plan         (heading)
 *   **Plan:**       (bold)
 *   Plan:           (plain prefix at start of line)
 *
 * followed by a contiguous block of "- ", "* ", "1. " items.
 */
export function extractPlan(content: string): {
  items: string[];
  rest: string;
} {
  if (!content) return { items: [], rest: content };

  const lines = content.split("\n");
  const headingRe = /^(?:#{1,6}\s*)?(?:\*\*)?(?:📋\s*)?plan(?:\*\*)?\s*:?\s*$/i;
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headingRe.test(lines[i].trim())) {
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) return { items: [], rest: content };

  const itemRe = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/;
  const items: string[] = [];
  let endIdx = startIdx;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === "") {
      // allow a single blank line inside the list
      if (items.length > 0 && i + 1 < lines.length && itemRe.test(lines[i + 1])) {
        continue;
      }
      endIdx = i;
      break;
    }
    const m = trimmed.match(itemRe);
    if (m) {
      items.push(m[1].replace(/[*_`]/g, "").trim());
      endIdx = i + 1;
    } else {
      if (items.length === 0) {
        // not actually a plan; bail
        return { items: [], rest: content };
      }
      endIdx = i;
      break;
    }
  }

  if (items.length < 2) return { items: [], rest: content };

  const before = lines.slice(0, startIdx).join("\n").trimEnd();
  const after = lines.slice(endIdx).join("\n").trimStart();
  const rest = [before, after].filter(Boolean).join("\n\n");
  return { items, rest };
}

/**
 * Helper to derive item statuses from message streaming state. While streaming,
 * everything is "pending" except the last item (which is "running"). Once the
 * message completes, all items become "done".
 */
export function deriveStatuses(
  itemTexts: string[],
  isStreaming: boolean,
): PlanItem[] {
  if (!isStreaming) {
    return itemTexts.map((text) => ({ text, status: "done" as const }));
  }
  return itemTexts.map((text, i) => ({
    text,
    status:
      i === itemTexts.length - 1
        ? ("running" as const)
        : ("pending" as const),
  }));
}
