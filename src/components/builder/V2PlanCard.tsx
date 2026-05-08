// V2 Plan card — renders the structured plan emitted by the V2 orchestrator's
// planner pass. Shows the intent + an ordered list of steps with per-step
// agent badges (frontend / backend / design / general) and a parallel marker.
//
// Keeps the same visual language as PlanBlock (glassmorphism, gradient header)
// so users feel a unified "plan-first" agent experience whether the plan came
// from inline markdown (V1) or the V2 planner.

import { m } from "framer-motion";
import {
  Sparkles,
  Layers,
  Server,
  Palette,
  Wrench,
  Zap,
  CheckCircle2,
  Circle,
  Loader2,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type V2PlanStep = {
  id: string;
  title: string;
  description: string;
  agent: "frontend" | "backend" | "design" | "general";
  parallelizable?: boolean;
  depends_on?: string[];
  touches?: string[];
  risk?: "low" | "med" | "high";
  rollback_hint?: string;
};

export type V2Plan = {
  intent: string;
  scope: "scratch_build" | "edit" | "fix" | "refactor" | "discussion";
  steps: V2PlanStep[];
  notes?: string;
};

const AGENT_META: Record<
  V2PlanStep["agent"],
  { label: string; icon: typeof Layers; tone: string }
> = {
  frontend: {
    label: "UI",
    icon: Layers,
    tone: "text-sky-300 bg-sky-500/15 ring-sky-400/30",
  },
  backend: {
    label: "Backend",
    icon: Server,
    tone: "text-emerald-300 bg-emerald-500/15 ring-emerald-400/30",
  },
  design: {
    label: "Design",
    icon: Palette,
    tone: "text-fuchsia-300 bg-fuchsia-500/15 ring-fuchsia-400/30",
  },
  general: {
    label: "General",
    icon: Wrench,
    tone: "text-slate-300 bg-slate-500/15 ring-slate-400/30",
  },
};

const SCOPE_LABEL: Record<V2Plan["scope"], string> = {
  scratch_build: "New build",
  edit: "Edit",
  fix: "Fix",
  refactor: "Refactor",
  discussion: "Discussion",
};

type Props = {
  plan: V2Plan;
  /** Index of the currently-executing step (-1 = not started, steps.length = done). */
  currentStepIndex?: number;
  /** True while the executor is still running. */
  active?: boolean;
  /** IDs of steps that were rolled back after exhausting their retry budget. */
  rolledBackStepIds?: string[];
};

export const V2PlanCard = ({ plan, currentStepIndex = -1, active = true, rolledBackStepIds = [] }: Props) => {
  const rolledBackSet = new Set(rolledBackStepIds);
  if (plan.scope === "discussion" || plan.steps.length === 0) {
    // Collapsed mode for discussion-only intents
    return (
      <m.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-xs text-violet-200"
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0" />
        <span className="opacity-80">Conversation mode</span>
        <span className="opacity-60 truncate">— {plan.intent}</span>
      </m.div>
    );
  }

  const completed = Math.max(0, Math.min(currentStepIndex, plan.steps.length));
  const total = plan.steps.length;
  const progress = total === 0 ? 0 : (completed / total) * 100;

  return (
    <m.div
      layout
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "relative overflow-hidden rounded-xl",
        "border border-white/10 bg-gradient-to-br from-violet-500/10 via-fuchsia-500/5 to-sky-500/10",
        "backdrop-blur-md shadow-lg shadow-violet-500/10",
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-3.5 py-2.5">
        <div className="flex items-start gap-2 min-w-0">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-violet-500/20 ring-1 ring-violet-400/40">
            <Sparkles className="h-3.5 w-3.5 text-violet-200" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/80">
                Plan
              </span>
              <span className="text-[10px] rounded px-1.5 py-0.5 bg-white/5 text-white/60 ring-1 ring-white/10">
                {SCOPE_LABEL[plan.scope]}
              </span>
            </div>
            <p className="text-xs text-white/85 leading-snug mt-0.5 line-clamp-2">
              {plan.intent}
            </p>
          </div>
        </div>
        <div className="text-[10px] text-white/50 shrink-0 tabular-nums">
          {completed}/{total}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-white/5 overflow-hidden">
        <m.div
          className="h-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-sky-400"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      {/* Steps */}
      <ul className="px-2 py-1.5 space-y-0.5">
        {plan.steps.map((step, idx) => {
          const meta = AGENT_META[step.agent] ?? AGENT_META.general;
          const AgentIcon = meta.icon;
          const wasRolledBack = rolledBackSet.has(step.id);
          const isDone = idx < completed && !wasRolledBack;
          const isRunning = idx === completed && active && !wasRolledBack;
          const isPending = !wasRolledBack && (idx > completed || (!active && idx >= completed));

          return (
            <m.li
              key={step.id ?? idx}
              layout
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.2 }}
              className={cn(
                "flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors",
                isRunning && "bg-white/5",
                wasRolledBack && "bg-amber-500/5 ring-1 ring-amber-500/20",
              )}
            >
              {/* Status icon */}
              <div className="mt-0.5 shrink-0">
                {wasRolledBack ? (
                  <Undo2 className="h-3.5 w-3.5 text-amber-400" />
                ) : isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                ) : isRunning ? (
                  <Loader2 className="h-3.5 w-3.5 text-sky-300 animate-spin" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-white/25" />
                )}
              </div>

              {/* Step body */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={cn(
                      "text-xs font-medium leading-tight",
                      isDone && "text-white/50 line-through decoration-white/30",
                      isRunning && "text-white",
                      isPending && "text-white/70",
                      wasRolledBack && "text-amber-200/80 line-through decoration-amber-400/40",
                    )}
                  >
                    {step.title}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide ring-1",
                      meta.tone,
                    )}
                  >
                    <AgentIcon className="h-2.5 w-2.5" />
                    {meta.label}
                  </span>
                  {step.parallelizable && (
                    <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium text-amber-300 bg-amber-500/10 ring-1 ring-amber-400/30">
                      <Zap className="h-2.5 w-2.5" />
                      parallel
                    </span>
                  )}
                  {wasRolledBack && (
                    <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-300 bg-amber-500/15 ring-1 ring-amber-400/40">
                      <Undo2 className="h-2.5 w-2.5" />
                      rolled back
                    </span>
                  )}
                </div>
                {step.description && (
                  <p
                    className={cn(
                      "text-[11px] mt-0.5 leading-snug line-clamp-2",
                      isDone ? "text-white/30" : wasRolledBack ? "text-amber-200/50" : "text-white/55",
                    )}
                  >
                    {step.description}
                  </p>
                )}
                {wasRolledBack && step.rollback_hint && (
                  <p className="text-[10px] mt-0.5 leading-snug text-amber-300/70 italic">
                    ↩ {step.rollback_hint}
                  </p>
                )}
              </div>
            </m.li>
          );
        })}
      </ul>

      {plan.notes && (
        <div className="px-3.5 py-1.5 border-t border-white/10 text-[10px] text-white/45 italic">
          {plan.notes}
        </div>
      )}
    </m.div>
  );
};
