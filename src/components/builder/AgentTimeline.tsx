// AgentTimeline — renders the live "thought stream" of the agent inside a
// chat message bubble. Shows each tool call as a compact row with status,
// streams thinking text inline (with markdown), collapses long tool results,
// and inlines answered-question history + the active pending question card
// so the whole conversation flows naturally in one column.
import { memo, useState, type ReactNode } from "react";
import { m, AnimatePresence } from "framer-motion";
import {
  FileText,
  FileSearch,
  FilePlus,
  FileEdit,
  Trash2,
  Terminal,
  Package,
  Cloud,
  ListTree,
  Search,
  ShieldCheck,
  HelpCircle,
  CheckCircle2,
  Loader2,
  AlertCircle,
  MessageCircleQuestion,
  Brain,
  Database,
  Regex,
  ChevronRight,
  Hammer,
  Stethoscope,
  Eye,
  type LucideIcon,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { PathHighlight } from "./PathHighlight";
import { V2PlanCard } from "./V2PlanCard";
import { V2PhasePill } from "./V2PhasePill";
import { PlanBlock } from "./PlanBlock";

export type TimelineStep =
  | {
      kind: "thinking";
      id: string;
      text: string;
    }
  | {
      kind: "tool";
      id: string;
      name: string;
      args: any;
      status: "running" | "ok" | "error";
      result?: any;
    }
  | {
      kind: "ask";
      id: string;
      question: string;
      options: string[];
      answered?: string;
    }
  | {
      kind: "answered_question";
      id: string;
      question: string;
      answer: string;
    }
  // Auto-verification row — shows pass / fail with collapsible issue list.
  | {
      kind: "verify";
      id: string;
      ok: boolean;
      checked: number;
      issueCount: number;
      attempt?: number;
      final?: boolean;
      issues?: { path: string; problem: string }[];
    }
  // Memory write row — distinct visual from "thinking".
  | {
      kind: "memory";
      id: string;
      key: string;
    }
  // V2 orchestrator: structured plan card (planner pass output)
  | {
      kind: "v2_plan";
      id: string;
      plan: import("./V2PlanCard").V2Plan;
      currentStepIndex: number;
      active: boolean;
      rolledBackStepIds?: string[];
    }
  // V2 orchestrator: phase indicator (planning/executing/retrying/summarizing/complete)
  | {
      kind: "v2_phase";
      id: string;
      phase: import("./V2PhasePill").V2Phase;
      active: boolean;
    }
  // V2 orchestrator: mid-run context summary
  | {
      kind: "v2_summary";
      id: string;
      text: string;
    }
  // Visual feedback loop result — shows the screenshot review score
  | {
      kind: "visual";
      id: string;
      total: number;
      max: number;
      passed: boolean;
      summary: string;
      attempt?: number;
      polishing?: boolean;
      consoleErrors?: number;
      deadButtons?: number;
    }
  ;

const TOOL_META: Record<
  string,
  { label: string; icon: LucideIcon; tone: "neutral" | "write" | "memory" }
> = {
  read_file: { label: "Reading", icon: FileSearch, tone: "neutral" },
  write_file: { label: "Writing", icon: FilePlus, tone: "write" },
  bulk_write_files: { label: "Writing files", icon: FilePlus, tone: "write" },
  list_files: { label: "Listing files", icon: ListTree, tone: "neutral" },
  search_files: { label: "Searching", icon: Search, tone: "neutral" },
  grep_files: { label: "Regex search", icon: Regex, tone: "neutral" },
  run_typecheck: { label: "Type-checking", icon: ShieldCheck, tone: "neutral" },
  validate_files: { label: "Validating", icon: ShieldCheck, tone: "neutral" },
  read_memory: { label: "Recalling", icon: Brain, tone: "memory" },
  write_memory: { label: "Remembering", icon: Brain, tone: "memory" },
  list_memory: { label: "Memory index", icon: Database, tone: "memory" },
  ask_user: { label: "Asking", icon: HelpCircle, tone: "neutral" },
  edit_file: { label: "Editing", icon: FileEdit, tone: "write" },
  delete_file: { label: "Deleting", icon: Trash2, tone: "write" },
  read_console_logs: { label: "Reading logs", icon: Terminal, tone: "neutral" },
  add_dependency: { label: "Installing", icon: Package, tone: "write" },
  db_migration: { label: "Migration", icon: Database, tone: "write" },
  deploy_edge_function: { label: "Edge function", icon: Cloud, tone: "write" },
  executor_error: { label: "Verification issue", icon: AlertCircle, tone: "neutral" },
};

function describeArgs(name: string, args: any): string {
  if (!args || typeof args !== "object") return "";
  if (
    name === "read_file" ||
    name === "write_file" ||
    name === "edit_file" ||
    name === "delete_file"
  )
    return String(args.path ?? "");
  if (name === "search_files") return `"${args.query ?? ""}"`;
  if (name === "grep_files") return `/${args.pattern ?? ""}/${args.flags ?? ""}`;
  if (name === "validate_files") {
    const n = Array.isArray(args.paths) ? args.paths.length : 0;
    return `${n} file${n === 1 ? "" : "s"}`;
  }
  if (name === "bulk_write_files") {
    const n = Array.isArray(args.files) ? args.files.length : 0;
    const first = Array.isArray(args.files) && args.files[0]?.path ? shortenPath(args.files[0].path) : "";
    return `${n} file${n === 1 ? "" : "s"}${first ? ` · ${first}${n > 1 ? " +…" : ""}` : ""}`;
  }
  if (name === "read_memory" || name === "write_memory") return String(args.key ?? "");
  if (name === "list_files") return args.dir ?? "/";
  if (name === "add_dependency") return String(args.name ?? "");
  if (name === "db_migration") return String(args.name ?? "");
  if (name === "deploy_edge_function") return String(args.name ?? "");
  if (name === "read_console_logs") {
    return args.search ? `"${args.search}"` : `last ${args.limit ?? 20}`;
  }
  return "";
}

function shortenPath(path: string): string {
  if (!path) return "";
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 2) return path;
  return `…/${parts.slice(-2).join("/")}`;
}

// Format a tool result for the inline preview.
// IMPORTANT: For write_file / edit_file / bulk_write_files / read_file we
// deliberately DO NOT dump the full file content into the timeline — the user
// can already see those files in the editor / preview. Echoing them here
// (a) wastes screen space, (b) makes it look like the agent is "writing the
// code into chat", and (c) caused the bug where huge raw {"path":...,"content":...}
// blobs filled the chat.
function previewResult(result: any, toolName?: string): string {
  if (result == null) return "";

  // File-write style results: keep it to a single concise line.
  if (
    toolName === "write_file" ||
    toolName === "edit_file" ||
    toolName === "bulk_write_files" ||
    toolName === "delete_file"
  ) {
    if (typeof result === "string") {
      // Show only the first line (e.g. "Wrote /src/App.tsx (3.2 KB)").
      const firstLine = result.split("\n")[0]?.trim();
      return firstLine ? firstLine.slice(0, 160) : "Done";
    }
    if (typeof result === "object") {
      const r: any = result;
      // Surface errors first — otherwise a failed write shows "Done" in a red box.
      if (r.error) return typeof r.error === "string" ? r.error.slice(0, 240) : JSON.stringify(r.error).slice(0, 240);
      if (r.path) return `${r.path}${r.bytes ? ` · ${r.bytes} bytes` : ""}`;
      if (Array.isArray(r.files)) {
        const n = r.files.length;
        const head = r.files.slice(0, 3).map((f: any) => f?.path ?? "").filter(Boolean).join(", ");
        return `${n} file${n === 1 ? "" : "s"} written${head ? ` · ${head}${n > 3 ? "…" : ""}` : ""}`;
      }
      if (r.warning) return `⚠️ ${String(r.warning).slice(0, 200)}`;
    }
    return "Done";
  }

  // read_file: just show size — full content is noise in the timeline.
  if (toolName === "read_file") {
    if (typeof result === "string") {
      const lines = result.split("\n").length;
      return `${result.length} chars · ${lines} line${lines === 1 ? "" : "s"}`;
    }
    if (typeof result === "object" && result && typeof (result as any).content === "string") {
      const c = (result as any).content as string;
      const lines = c.split("\n").length;
      return `${c.length} chars · ${lines} line${lines === 1 ? "" : "s"}`;
    }
  }

  if (typeof result === "string") {
    return result.length > 600 ? result.slice(0, 600) + "\n…" : result;
  }
  if (Array.isArray(result)) {
    const head = result.slice(0, 5).map((x) => (typeof x === "string" ? x : JSON.stringify(x)));
    const more = result.length > 5 ? `\n…and ${result.length - 5} more` : "";
    return `${result.length} item${result.length === 1 ? "" : "s"}\n${head.join("\n")}${more}`;
  }
  try {
    const json = JSON.stringify(result, null, 2);
    return json.length > 600 ? json.slice(0, 600) + "\n…" : json;
  } catch {
    return String(result);
  }
}

const ToolRow = memo(function ToolRow({
  step,
  onOpenFile,
}: {
  step: Extract<TimelineStep, { kind: "tool" }>;
  onOpenFile?: (path: string) => void;
}) {
  const meta = TOOL_META[step.name] ?? {
    label: step.name,
    icon: FileText,
    tone: "neutral" as const,
  };
  const Icon = meta.icon;
  const detail = describeArgs(step.name, step.args);
  const isWrite = meta.tone === "write";
  const isMemory = meta.tone === "memory";
  const isFilePath = step.name === "read_file" || step.name === "write_file";
  const displayDetail = isFilePath ? shortenPath(detail) : detail;
  const writtenBadge = isWrite && step.status === "ok";

  // ── Collapsible details (D1) ────────────────────────────────
  // The row itself stays compact; tapping it reveals the raw args and a
  // truncated result preview. We only show the chevron when there's actually
  // something useful to expand (args or result present).
  const hasArgs = step.args && Object.keys(step.args).length > 0;
  const hasResult = step.result != null && step.result !== "";
  const expandable = hasArgs || hasResult;
  const [open, setOpen] = useState(false);

  // If this row points at a file we can open in the editor, prefer the
  // "open in editor" behavior over the expand toggle (Bolt-style).
  const openablePath =
    isFilePath && detail && onOpenFile ? detail : null;

  const handleToggle = () => {
    if (openablePath) {
      onOpenFile!(openablePath);
      return;
    }
    if (expandable) setOpen((v) => !v);
  };

  return (
    <m.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18 }}
      whileHover={{ y: -1 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border backdrop-blur-md transition-all duration-200",
        isWrite &&
          "border-primary/35 bg-gradient-to-r from-primary/[0.14] via-primary/[0.07] to-transparent shadow-[0_0_0_1px_hsl(var(--primary)/0.06),0_4px_18px_-10px_hsl(var(--primary)/0.5)]",
        isMemory &&
          "border-violet-500/35 bg-gradient-to-r from-violet-500/[0.14] via-fuchsia-500/[0.06] to-transparent shadow-[0_4px_18px_-10px_hsl(280_80%_60%/0.4)]",
        !isWrite &&
          !isMemory &&
          "border-white/[0.07] bg-gradient-to-r from-white/[0.04] via-white/[0.02] to-transparent hover:bg-white/[0.05] hover:border-white/[0.14]",
        step.status === "running" && "ring-1 ring-primary/30",
      )}
    >
      {step.status === "running" && (
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
      )}
      <button
        type="button"
        onClick={handleToggle}
        title={detail || undefined}
        aria-expanded={open}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px]",
          expandable && "cursor-pointer",
          !expandable && "cursor-default",
        )}
      >
        <span
          className={cn(
            "shrink-0 inline-flex items-center justify-center size-5 rounded-full",
            isWrite && "bg-primary/15 ring-1 ring-primary/25",
            isMemory && "bg-violet-500/15 ring-1 ring-violet-500/25",
            !isWrite && !isMemory && "bg-white/5",
          )}
        >
          <Icon
            size={11}
            className={cn(
              isWrite && "text-primary",
              isMemory && "text-violet-300",
              !isWrite && !isMemory && "text-foreground/70",
            )}
          />
        </span>
        <span
          className={cn(
            "shrink-0",
            isWrite && "text-primary font-medium",
            isMemory && "text-violet-300 font-medium",
            !isWrite && !isMemory && "text-[hsl(var(--foreground-muted))]",
          )}
        >
          {meta.label}
        </span>
        {displayDetail && (
          isFilePath ? (
            <PathHighlight path={detail} maxSegments={3} />
          ) : (
            <code
              className={cn(
                "font-mono text-[11.5px] truncate min-w-0",
                isWrite || isMemory ? "text-foreground font-medium" : "text-foreground",
              )}
            >
              {displayDetail}
            </code>
          )
        )}
        {writtenBadge && (
          <span className="shrink-0 rounded-full bg-primary/20 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-primary ring-1 ring-primary/20">
            Saved
          </span>
        )}
        <span className="ml-auto shrink-0 flex items-center gap-1.5">
          {step.status === "running" && <Loader2 size={12} className="animate-spin text-primary" />}
          {step.status === "ok" && !writtenBadge && (
            <CheckCircle2
              size={12}
              className={isMemory ? "text-violet-400" : "text-primary"}
            />
          )}
          {step.status === "error" && <AlertCircle size={12} className="text-destructive" />}
          {expandable && (
            <ChevronRight
              size={11}
              className={cn(
                "text-[hsl(var(--foreground-subtle))] transition-transform duration-150",
                open && "rotate-90",
              )}
              aria-hidden
            />
          )}
        </span>
      </button>

      {/* Collapsible body — args + result preview */}
      <AnimatePresence initial={false}>
        {open && expandable && (
          <m.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.06] px-3 py-2 space-y-2">
              {hasArgs && (
                <div>
                  <div className="text-[9.5px] font-semibold uppercase tracking-wider text-[hsl(var(--foreground-subtle))] mb-1">
                    Arguments
                  </div>
                  <pre className="text-[11px] font-mono leading-snug text-foreground/85 bg-black/30 rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-words max-h-44 scrollbar-thin">
                    {(() => {
                      try {
                        return JSON.stringify(step.args, null, 2);
                      } catch {
                        return String(step.args);
                      }
                    })()}
                  </pre>
                </div>
              )}
              {hasResult && (
                <div>
                  <div className="text-[9.5px] font-semibold uppercase tracking-wider text-[hsl(var(--foreground-subtle))] mb-1">
                    {step.status === "error" ? "Error" : "Result"}
                  </div>
                  <pre
                    className={cn(
                      "text-[11px] font-mono leading-snug rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-words max-h-56 scrollbar-thin",
                      step.status === "error"
                        ? "bg-destructive/10 text-destructive/90 border border-destructive/20"
                        : "bg-black/30 text-foreground/85",
                    )}
                  >
                    {previewResult(step.result, step.name)}
                  </pre>
                </div>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
});

const AnsweredQuestionRow = memo(function AnsweredQuestionRow({
  step,
}: {
  step: Extract<TimelineStep, { kind: "answered_question" }>;
}) {
  return (
    <m.div
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      title={`Q: ${step.question}\nA: ${step.answer}`}
      className={cn(
        "flex items-center gap-2 rounded-md border border-primary/15 bg-primary/[0.04]",
        "px-2.5 py-1.5 text-[12px]",
      )}
    >
      <MessageCircleQuestion size={13} className="shrink-0 text-primary/80" />
      <span className="shrink-0 text-[hsl(var(--foreground-muted))]">Q:</span>
      <span className="truncate min-w-0 text-foreground/90">{step.question}</span>
      <span className="shrink-0 text-[hsl(var(--foreground-muted))]">→</span>
      <span className="shrink-0 text-[hsl(var(--foreground-muted))]">A:</span>
      <span className="truncate min-w-0 font-medium text-foreground">{step.answer}</span>
      <CheckCircle2 size={12} className="ml-auto shrink-0 text-primary" />
    </m.div>
  );
});

// Auto-verify result row. Issues collapse behind a chevron so the timeline
// stays scannable but the user can drill in when a fix is happening.
const VerifyRow = memo(function VerifyRow({
  step,
}: {
  step: Extract<TimelineStep, { kind: "verify" }>;
}) {
  const [open, setOpen] = useState(false);
  const hasIssues = !step.ok && step.issueCount > 0;
  const visibleIssues = step.issues ?? [];
  return (
    <m.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18 }}
      className={cn(
        "rounded-md border text-[12px]",
        step.ok
          ? "border-emerald-500/25 bg-emerald-500/[0.05]"
          : "border-amber-500/30 bg-amber-500/[0.06]",
      )}
    >
      <button
        type="button"
        onClick={() => hasIssues && setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 px-2.5 py-1.5",
          hasIssues && "cursor-pointer",
        )}
      >
        <ShieldCheck
          size={13}
          className={cn("shrink-0", step.ok ? "text-emerald-400" : "text-amber-400")}
        />
        <span
          className={cn(
            "shrink-0 font-medium",
            step.ok ? "text-emerald-300" : "text-amber-300",
          )}
        >
          {step.ok ? "Verified" : step.final ? "Final check" : "Auto-verify"}
        </span>
        <span className="text-[hsl(var(--foreground-muted))]">
          {step.ok
            ? `${step.checked} file${step.checked === 1 ? "" : "s"} clean`
            : `${step.issueCount} issue${step.issueCount === 1 ? "" : "s"} found · ${step.checked} file${step.checked === 1 ? "" : "s"} checked`}
        </span>
        {!step.ok && step.attempt && (
          <span className="shrink-0 rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
            attempt {step.attempt}/3
          </span>
        )}
        {hasIssues && (
          <ChevronRight
            size={12}
            className={cn(
              "ml-auto shrink-0 text-amber-400 transition-transform",
              open && "rotate-90",
            )}
          />
        )}
      </button>
      {hasIssues && open && (
        <ul className="space-y-1 border-t border-amber-500/20 px-2.5 py-1.5">
          {visibleIssues.length === 0 && (
            <li className="text-[11.5px] leading-snug text-foreground/70">
              Issue details were not included for this older run. Start a new fix/build run to see exact file paths and messages here.
            </li>
          )}
          {visibleIssues.slice(0, 8).map((iss, i) => (
            <li key={i} className="text-[11.5px] leading-snug">
              <code className="font-mono text-amber-200">{shortenPath(iss.path)}</code>
              <span className="text-foreground/80"> — {iss.problem}</span>
            </li>
          ))}
        </ul>
      )}
    </m.div>
  );
});

const MemoryRow = memo(function MemoryRow({
  step,
}: {
  step: Extract<TimelineStep, { kind: "memory" }>;
}) {
  return (
    <m.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18 }}
      className="flex items-center gap-2 rounded-md border border-violet-500/30 bg-violet-500/[0.06] px-2.5 py-1.5 text-[12px]"
      title={`Saved to project memory: ${step.key}`}
    >
      <Brain size={13} className="shrink-0 text-violet-400" />
      <span className="shrink-0 font-medium text-violet-300">Remembered</span>
      <code className="font-mono text-[11.5px] truncate min-w-0 text-foreground">
        {step.key}
      </code>
      <CheckCircle2 size={12} className="ml-auto shrink-0 text-violet-400" />
    </m.div>
  );
});

// Visual feedback row — screenshot was scored by a vision model after files
// were written. Shows score out of 50 and whether a polish pass was triggered.
const VisualRow = memo(function VisualRow({
  step,
}: {
  step: Extract<TimelineStep, { kind: "visual" }>;
}) {
  const tone = step.passed
    ? "border-emerald-500/25 bg-emerald-500/[0.05]"
    : step.polishing
      ? "border-violet-500/30 bg-violet-500/[0.06]"
      : "border-amber-500/30 bg-amber-500/[0.06]";
  const label = step.passed ? "Looks good" : step.polishing ? "Polishing" : "Reviewed";
  const labelColor = step.passed
    ? "text-emerald-300"
    : step.polishing
      ? "text-violet-300"
      : "text-amber-300";
  const iconColor = step.passed
    ? "text-emerald-400"
    : step.polishing
      ? "text-violet-400"
      : "text-amber-400";
  return (
    <m.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18 }}
      className={cn("flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12px]", tone)}
      title={step.summary}
    >
      <Eye size={13} className={cn("shrink-0", iconColor)} />
      <span className={cn("shrink-0 font-medium", labelColor)}>{label}</span>
      <span className="text-[hsl(var(--foreground-muted))]">
        Visual score {step.total}/{step.max}
      </span>
      {step.consoleErrors && step.consoleErrors > 0 ? (
        <span className="shrink-0 rounded-sm bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-300">
          {step.consoleErrors} runtime err
        </span>
      ) : null}
      {step.deadButtons && step.deadButtons > 0 ? (
        <span className="shrink-0 rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
          {step.deadButtons} dead btn
        </span>
      ) : null}
      {step.attempt && step.attempt > 1 && (
        <span className="shrink-0 rounded-sm bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300">
          pass {step.attempt}
        </span>
      )}
    </m.div>
  );
});
// headings, code styled like the rest of the chat.
function ThinkingMarkdown({ text }: { text: string }) {
  return (
    <div className="prose prose-sm prose-invert max-w-none text-[13px] leading-relaxed text-foreground/90 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-1 prose-headings:text-[14px] prose-code:bg-white/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:my-1 prose-pre:bg-black/40 prose-strong:text-foreground">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}

type SubAgentKey = "build" | "heal" | "review";

const SUBAGENT_META: Record<
  SubAgentKey,
  { label: string; icon: LucideIcon; color: string; ring: string; bg: string }
> = {
  build: {
    label: "Build Agent",
    icon: Hammer,
    color: "text-primary",
    ring: "ring-primary/30",
    bg: "bg-primary/10",
  },
  heal: {
    label: "Heal Agent",
    icon: Stethoscope,
    color: "text-amber-300",
    ring: "ring-amber-500/30",
    bg: "bg-amber-500/10",
  },
  review: {
    label: "Review Agent",
    icon: Eye,
    color: "text-violet-300",
    ring: "ring-violet-500/30",
    bg: "bg-violet-500/10",
  },
};

// Infer which sub-agent(s) are active from the timeline steps.
// build  = any write tool (write_file/edit_file/delete_file/add_dependency/db_migration/deploy_edge_function)
// heal   = any verify step that has issues OR attempt > 1
// review = any verify step that is final OR ok=true after writes
function detectActiveSubAgents(steps: TimelineStep[]): SubAgentKey[] {
  const active = new Set<SubAgentKey>();
  for (const s of steps) {
    if (s.kind === "tool") {
      const meta = TOOL_META[s.name];
      if (meta?.tone === "write") active.add("build");
    }
    if (s.kind === "verify") {
      if (s.final || s.ok) active.add("review");
      if (!s.ok || (s.attempt && s.attempt > 1)) active.add("heal");
    }
  }
  // If nothing detected yet but we have steps, assume build is warming up
  if (active.size === 0 && steps.length > 0) active.add("build");
  return Array.from(active);
}

const SubAgentBadges = memo(function SubAgentBadges({
  active,
  current,
}: {
  active: SubAgentKey[];
  current: SubAgentKey | null;
}) {
  if (active.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 pb-1">
      {(["build", "heal", "review"] as SubAgentKey[]).map((key) => {
        const meta = SUBAGENT_META[key];
        const isActive = active.includes(key);
        const isCurrent = current === key;
        const Icon = meta.icon;
        if (!isActive) return null;
        return (
          <m.span
            key={key}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-all",
              meta.bg,
              meta.color,
              isCurrent && cn("ring-1", meta.ring, "shadow-sm"),
            )}
            title={`${meta.label}${isCurrent ? " · active" : ""}`}
          >
            <Icon size={10} className={isCurrent ? "animate-pulse" : ""} />
            {meta.label.replace(" Agent", "")}
            {isCurrent && (
              <span className="ml-0.5 h-1 w-1 rounded-full bg-current animate-pulse" />
            )}
          </m.span>
        );
      })}
    </div>
  );
});

type Props = {
  steps: TimelineStep[];
  activeQuestion?: ReactNode;
  /** Optional override — when provided, this sub-agent is shown as currently running. */
  currentSubAgent?: SubAgentKey | null;
  /** When provided, file-path tool rows become clickable and open the file in the editor. */
  onOpenFile?: (path: string) => void;
};

// Which step kinds count as "primary" (always visible) vs "details"
// (collapsed inside the Details footer, Bolt-style).
const PRIMARY_KINDS = new Set([
  "thinking",
  "ask",
  "answered_question",
  "v2_plan",
  "v2_phase",
  "v2_summary",
]);

export const AgentTimeline = ({ steps, activeQuestion, currentSubAgent, onOpenFile }: Props) => {
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (steps.length === 0 && !activeQuestion) return null;
  const activeAgents = detectActiveSubAgents(steps);
  // If no explicit current agent, infer from the last write/verify step
  const inferredCurrent: SubAgentKey | null =
    currentSubAgent ??
    (() => {
      for (let i = steps.length - 1; i >= 0; i--) {
        const s = steps[i];
        if (s.kind === "tool" && s.status === "running") {
          const tone = TOOL_META[s.name]?.tone;
          if (tone === "write") return "build";
        }
        if (s.kind === "verify") return s.ok ? "review" : "heal";
      }
      return activeAgents[0] ?? null;
    })();

  const renderStep = (step: TimelineStep) => {
    if (step.kind === "thinking") {
      return (
        <m.div key={step.id} initial={{ opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }}>
          <ThinkingMarkdown text={step.text} />
        </m.div>
      );
    }
    if (step.kind === "tool")
      return <ToolRow key={step.id} step={step} onOpenFile={onOpenFile} />;
    if (step.kind === "verify") return <VerifyRow key={step.id} step={step} />;
    if (step.kind === "memory") return <MemoryRow key={step.id} step={step} />;
    if (step.kind === "visual") return <VisualRow key={step.id} step={step} />;
    if (step.kind === "v2_plan") {
      return (
        <V2PlanCard
          key={step.id}
          plan={step.plan}
          currentStepIndex={step.currentStepIndex}
          active={step.active}
          rolledBackStepIds={step.rolledBackStepIds}
        />
      );
    }
    if (step.kind === "v2_phase") {
      return (
        <div key={step.id} className="flex justify-start">
          <V2PhasePill phase={step.phase} active={step.active} />
        </div>
      );
    }
    if (step.kind === "v2_summary") {
      return (
        <m.div
          key={step.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/5 px-3 py-2 text-[11px] text-fuchsia-100/80"
        >
          <div className="text-[9px] font-semibold uppercase tracking-wider text-fuchsia-300/80 mb-1">
            Context summary
          </div>
          <div className="leading-relaxed whitespace-pre-wrap">{step.text}</div>
        </m.div>
      );
    }
    if (step.kind === "answered_question") {
      return <AnsweredQuestionRow key={step.id} step={step} />;
    }
    return null;
  };

  // Split into primary (always visible) and details (collapsed under footer),
  // preserving original ordering within each group.
  const primary: TimelineStep[] = [];
  const details: TimelineStep[] = [];
  for (const s of steps) {
    if (PRIMARY_KINDS.has(s.kind)) primary.push(s);
    else details.push(s);
  }

  // Footer label — prefer the most recent "build verify" style action.
  const detailsLabel = (() => {
    for (let i = details.length - 1; i >= 0; i--) {
      const s = details[i];
      if (s.kind === "verify") {
        return s.ok ? "Built the project to verify compilation" : "Auto-verifying changes";
      }
      if (s.kind === "tool" && (s.name === "write_file" || s.name === "edit_file" || s.name === "bulk_write_files")) {
        return "Built the project to verify compilation";
      }
    }
    return `${details.length} step${details.length === 1 ? "" : "s"}`;
  })();

  // Any running tool? Then the footer should look "active".
  const detailsRunning = details.some(
    (s) => s.kind === "tool" && s.status === "running",
  );

  return (
    <div className="space-y-1.5">
      <SubAgentBadges active={activeAgents} current={inferredCurrent} />
      <AnimatePresence initial={false}>
        {primary.map(renderStep)}
      </AnimatePresence>

      {details.length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            aria-expanded={detailsOpen}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left hover:bg-white/[0.03] transition-colors"
          >
            {detailsRunning ? (
              <Loader2 size={12} className="shrink-0 animate-spin text-primary" />
            ) : (
              <Hammer size={12} className="shrink-0 text-[hsl(var(--foreground-muted))]" />
            )}
            <span className="text-[hsl(var(--foreground-muted))] truncate">
              {detailsLabel}
            </span>
            <span className="ml-auto shrink-0 inline-flex items-center gap-1.5 text-[10.5px] text-[hsl(var(--foreground-subtle))]">
              {details.length} {details.length === 1 ? "step" : "steps"}
              <ChevronRight
                size={11}
                className={cn("transition-transform duration-150", detailsOpen && "rotate-90")}
                aria-hidden
              />
            </span>
          </button>
          <AnimatePresence initial={false}>
            {detailsOpen && (
              <m.div
                key="details-body"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <div className="border-t border-white/[0.06] p-2 space-y-1.5">
                  {details.map(renderStep)}
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {activeQuestion && (
        <m.div
          layout
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "relative rounded-xl",
            "before:absolute before:inset-0 before:rounded-xl before:pointer-events-none",
            "before:ring-2 before:ring-primary/40 before:animate-pulse",
          )}
        >
          <div className="relative">{activeQuestion}</div>
        </m.div>
      )}
    </div>
  );
};
