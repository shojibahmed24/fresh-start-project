// Phase 11 — Renders a destructive-action confirmation dialog when the agent
// calls `request_confirmation`. The question payload is encoded as
//   __CONFIRM__:{"action":"…","impact":"…","severity":"high|medium|low","confirm_label":"…"}
// High severity requires the user to type "DELETE" (or a custom phrase) to
// arm the confirm button — same UX as GitHub destructive actions.

import { useState } from "react";
import { m } from "framer-motion";
import { AlertTriangle, ShieldAlert, Info, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Severity = "low" | "medium" | "high";
type Payload = {
  action: string;
  impact: string;
  severity: Severity;
  confirm_label: string;
};

type Props = {
  /** Raw question — `__CONFIRM__:` + JSON. */
  question: string;
  onAnswer: (answer: string) => void;
};

const TYPED_PHRASE = "CONFIRM";

const SEVERITY_STYLES: Record<Severity, { wrap: string; icon: any; iconColor: string; cta: string }> = {
  low: {
    wrap: "border-border bg-card",
    icon: Info,
    iconColor: "text-muted-foreground",
    cta: "",
  },
  medium: {
    wrap: "border-amber-500/30 bg-amber-500/5",
    icon: AlertTriangle,
    iconColor: "text-amber-500",
    cta: "bg-amber-500 hover:bg-amber-600 text-amber-50",
  },
  high: {
    wrap: "border-destructive/40 bg-destructive/5",
    icon: ShieldAlert,
    iconColor: "text-destructive",
    cta: "bg-destructive hover:bg-destructive/90 text-destructive-foreground",
  },
};

export const ConfirmationCard = ({ question, onAnswer }: Props) => {
  const payload: Payload = (() => {
    try {
      const p = JSON.parse(question.replace(/^__CONFIRM__:/, ""));
      return {
        action: String(p.action ?? "Confirm action"),
        impact: String(p.impact ?? ""),
        severity: (["low", "medium", "high"].includes(p.severity) ? p.severity : "medium") as Severity,
        confirm_label: String(p.confirm_label ?? "Confirm"),
      };
    } catch {
      return {
        action: "Confirm action",
        impact: "",
        severity: "medium" as Severity,
        confirm_label: "Confirm",
      };
    }
  })();

  const styles = SEVERITY_STYLES[payload.severity];
  const Icon = styles.icon;
  const requiresTyped = payload.severity === "high";
  const [typed, setTyped] = useState("");
  const armed = !requiresTyped || typed.trim().toUpperCase() === TYPED_PHRASE;

  return (
    <m.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("rounded-xl border-2 p-4 space-y-3", styles.wrap)}
      role="alertdialog"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-desc"
    >
      <div className="flex items-start gap-3">
        <div className={cn("rounded-lg p-2 bg-background/50", styles.iconColor)}>
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p id="confirm-title" className="text-sm font-semibold">
            {payload.action}
          </p>
          {payload.impact && (
            <p id="confirm-desc" className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {payload.impact}
            </p>
          )}
        </div>
      </div>

      {requiresTyped && (
        <div className="space-y-1.5">
          <label htmlFor="confirm-typed" className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
            Type <span className="font-mono font-bold text-foreground">{TYPED_PHRASE}</span> to enable
          </label>
          <Input
            id="confirm-typed"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={TYPED_PHRASE}
            autoComplete="off"
            spellCheck={false}
            className="h-8 font-mono text-sm"
          />
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAnswer("Cancel")}
        >
          <X className="size-3.5 mr-1" />
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!armed}
          onClick={() => onAnswer(payload.confirm_label)}
          className={cn(payload.severity !== "low" && styles.cta)}
        >
          <Check className="size-3.5 mr-1" />
          {payload.confirm_label}
        </Button>
      </div>
    </m.div>
  );
};
