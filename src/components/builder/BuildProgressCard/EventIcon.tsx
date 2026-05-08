import { CheckCircle2, AlertTriangle, XCircle, Wrench, Sparkles } from "lucide-react";
import type { BuildEvent } from "@/lib/store";
import { cn } from "@/lib/utils";

export function EventIcon({ kind }: { kind: BuildEvent["kind"] }) {
  const cls = "size-3.5 shrink-0";
  switch (kind) {
    case "file":
      return <CheckCircle2 className={cn(cls, "text-emerald-400")} aria-hidden />;
    case "warn":
      return <AlertTriangle className={cn(cls, "text-amber-400")} aria-hidden />;
    case "error":
      return <XCircle className={cn(cls, "text-rose-400")} aria-hidden />;
    case "fix":
      return <Wrench className={cn(cls, "text-sky-400")} aria-hidden />;
    case "milestone":
      return <Sparkles className={cn(cls, "text-primary")} aria-hidden />;
    case "debug":
      return <Wrench className={cn(cls, "text-foreground/40")} aria-hidden />;
    default:
      return <span className={cn(cls, "rounded-full bg-foreground/30")} aria-hidden />;
  }
}
