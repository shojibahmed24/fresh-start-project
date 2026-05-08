// Compact, animated badge rendered inside a USER chat bubble when the message
// is an auto-heal prompt (the giant "The live preview crashed…" structured
// prompt produced by useBuilderHeal). Instead of dumping the wall of text
// into chat, we show a small pill with the file name + the original error
// message, expandable on click for full details.
//
// The badge subscribes to live heal state via `healState` so it can show
// "Attempt 2/3 — fixing…", "Healed", or "Stopped — manual fix needed".

import { useEffect, useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  ChevronDown,
  FileWarning,
  Loader2,
  CheckCircle2,
  XOctagon,
} from "lucide-react";
import {
  subscribeHealState,
  makeHealKey,
  type HealState,
} from "@/lib/healState";

const HEAL_SIGNATURE = "The live preview crashed with a runtime error";

export type ParsedHeal = {
  errorMessage: string;
  filePath: string | null;
  full: string;
};

export function parseHealMarker(content: string): ParsedHeal | null {
  if (!content || !content.includes(HEAL_SIGNATURE)) return null;
  const errMatch = content.match(/═══ ERROR MESSAGE ═══\s*([\s\S]*?)(?:\n═══|$)/);
  const errorMessage = errMatch ? errMatch[1].trim() : "Runtime error";
  const fileMatch = content.match(/File:\s*([^\s\n]+)/);
  return {
    errorMessage: errorMessage.length > 240 ? errorMessage.slice(0, 237) + "…" : errorMessage,
    filePath: fileMatch ? fileMatch[1] : null,
    full: content,
  };
}

type Tone = {
  label: string;
  Icon: typeof ShieldAlert;
  iconClass: string;
  pillClass: string;
  pulse: boolean;
};

function toneFor(state: HealState | null): Tone {
  if (!state) {
    return {
      label: "Auto-fixing preview error",
      Icon: ShieldAlert,
      iconClass: "text-destructive",
      pillClass:
        "bg-gradient-to-r from-destructive/15 via-destructive/10 to-transparent border-destructive/30 hover:border-destructive/50",
      pulse: true,
    };
  }
  if (state.status === "fixing") {
    return {
      label: `Auto-fixing — attempt ${state.attempt}/${state.maxAttempts}`,
      Icon: Loader2,
      iconClass: "text-amber-400 animate-spin",
      pillClass:
        "bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border-amber-500/30 hover:border-amber-500/50",
      pulse: false,
    };
  }
  if (state.status === "healed") {
    return {
      label: `Healed — attempt ${state.attempt}/${state.maxAttempts}`,
      Icon: CheckCircle2,
      iconClass: "text-emerald-400",
      pillClass:
        "bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-transparent border-emerald-500/30 hover:border-emerald-500/50",
      pulse: false,
    };
  }
  if (state.status === "stopped" || state.status === "manual") {
    return {
      label: "Auto-heal stopped — manual fix needed",
      Icon: XOctagon,
      iconClass: "text-destructive",
      pillClass:
        "bg-gradient-to-r from-destructive/20 via-destructive/10 to-transparent border-destructive/40 hover:border-destructive/60",
      pulse: false,
    };
  }
  return {
    label: "Auto-fixing preview error",
    Icon: ShieldAlert,
    iconClass: "text-destructive",
    pillClass:
      "bg-gradient-to-r from-destructive/15 via-destructive/10 to-transparent border-destructive/30 hover:border-destructive/50",
    pulse: true,
  };
}

export function HealBadge({ parsed }: { parsed: ParsedHeal }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<HealState | null>(null);
  const fileName = parsed.filePath ? parsed.filePath.split("/").pop() : null;

  useEffect(() => {
    const key = makeHealKey(parsed.errorMessage, parsed.filePath);
    const unsub = subscribeHealState(key, setState);
    return unsub;
  }, [parsed.errorMessage, parsed.filePath]);

  const tone = toneFor(state);
  const Icon = tone.Icon;

  return (
    <m.div
      initial={{ opacity: 0, scale: 0.96, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col gap-1.5 max-w-full"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={[
          "group/heal inline-flex items-center gap-2 self-start",
          "rounded-full pl-2.5 pr-2 py-1.5 border",
          "shadow-[0_0_18px_-6px_hsl(var(--destructive)/0.45)]",
          "text-[12.5px] font-medium text-foreground transition-colors",
          tone.pillClass,
        ].join(" ")}
        aria-expanded={open}
      >
        {tone.pulse ? (
          <m.span
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            className="inline-flex"
            aria-hidden
          >
            <Icon size={12} className={tone.iconClass} />
          </m.span>
        ) : (
          <span className="inline-flex" aria-hidden>
            <Icon size={12} className={tone.iconClass} />
          </span>
        )}
        <span className="tracking-tight">{tone.label}</span>
        {fileName && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-foreground/10 border border-foreground/15 text-[10.5px] font-mono font-semibold max-w-[180px]">
            <FileWarning size={9} className="shrink-0 opacity-90" />
            <span className="truncate">{fileName}</span>
          </span>
        )}
        <m.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18 }}
          className="inline-flex text-[hsl(var(--foreground-muted))] group-hover/heal:text-foreground"
          aria-hidden
        >
          <ChevronDown size={12} />
        </m.span>
      </button>

      <span
        className="text-[11.5px] text-[hsl(var(--foreground-subtle))] italic pl-1 line-clamp-2"
        title={parsed.errorMessage}
      >
        {parsed.errorMessage}
      </span>

      {state?.reason && (
        <span className="text-[11px] text-[hsl(var(--foreground-muted))] pl-1">
          {state.reason}
        </span>
      )}

      <AnimatePresence initial={false}>
        {open && (
          <m.div
            key="heal-full"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <pre className="mt-1 max-h-64 overflow-auto rounded-md border border-[hsl(0_0%_100%/0.08)] bg-[hsl(var(--bg-elevated))] p-2.5 text-[11px] leading-[1.55] font-mono text-[hsl(var(--foreground-muted))] whitespace-pre-wrap">
              {parsed.full}
            </pre>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
}
