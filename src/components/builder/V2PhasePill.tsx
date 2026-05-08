// Phase pill for the V2 hybrid orchestrator. Shows the current high-level
// phase ("planning", "executing", "retrying", "summarizing") as a compact,
// glassmorphic chip with a subtle pulse on the active dot.
//
// Designed to sit at the TOP of the agent timeline so the user always knows
// what stage of the V2 pipeline they're in.

import { m } from "framer-motion";
import { Brain, Cog, RefreshCw, FileText, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type V2Phase =
  | "planning"
  | "executing"
  | "retrying"
  | "summarizing"
  | "complete";

const PHASE_META: Record<
  V2Phase,
  { label: string; icon: typeof Brain; tone: string; ring: string }
> = {
  planning: {
    label: "Planning",
    icon: Brain,
    tone: "text-violet-300 bg-violet-500/15",
    ring: "ring-violet-400/40",
  },
  executing: {
    label: "Executing",
    icon: Cog,
    tone: "text-sky-300 bg-sky-500/15",
    ring: "ring-sky-400/40",
  },
  retrying: {
    label: "Retrying",
    icon: RefreshCw,
    tone: "text-amber-300 bg-amber-500/15",
    ring: "ring-amber-400/40",
  },
  summarizing: {
    label: "Summarizing",
    icon: FileText,
    tone: "text-fuchsia-300 bg-fuchsia-500/15",
    ring: "ring-fuchsia-400/40",
  },
  complete: {
    label: "V2 Complete",
    icon: CheckCircle2,
    tone: "text-emerald-300 bg-emerald-500/15",
    ring: "ring-emerald-400/40",
  },
};

type Props = {
  phase: V2Phase;
  /** Hide the pulse when the run is finished. */
  active?: boolean;
};

export const V2PhasePill = ({ phase, active = true }: Props) => {
  const meta = PHASE_META[phase];
  const Icon = meta.icon;
  return (
    <m.div
      layout
      initial={{ opacity: 0, y: -4, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
        "text-[10px] font-semibold uppercase tracking-wider",
        "ring-1 backdrop-blur-md",
        meta.tone,
        meta.ring,
      )}
    >
      <Icon
        className={cn(
          "h-3 w-3",
          active && phase === "executing" && "animate-spin [animation-duration:3s]",
          active && phase === "retrying" && "animate-spin [animation-duration:1.5s]",
        )}
      />
      <span>{meta.label}</span>
      {active && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inset-0 rounded-full bg-current animate-ping opacity-60" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
    </m.div>
  );
};
