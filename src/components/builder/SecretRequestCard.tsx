// SecretRequestCard — rendered when the agent calls `request_secret` or
// `delete_secret`. The agent encodes intent in the question prefix:
//   __SECRET_REQUEST__:NAME   → first option = purpose, second = docs URL
//   __SECRET_DELETE__:NAME    → confirm/cancel
//
// We never let the secret value cross the agent stream. The user is directed
// to the project secrets settings (or a dialog that calls the appropriate
// platform API). When done, we resume the agent with a status string.
import { m } from "framer-motion";
import { KeyRound, ExternalLink, ShieldAlert, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  /** Raw question from the agent — encoded with __SECRET_REQUEST__: or __SECRET_DELETE__: prefix */
  question: string;
  options: string[];
  onAnswer: (answer: string) => void;
  disabled?: boolean;
};

export const SecretRequestCard = ({ question, options, onAnswer, disabled }: Props) => {
  const isDelete = question.startsWith("__SECRET_DELETE__:");
  const isRequest = question.startsWith("__SECRET_REQUEST__:");
  const name = question.replace(/^__SECRET_(REQUEST|DELETE)__:/, "").trim();
  const purpose = options[0] || "";
  const docsUrl = options[1] || "";

  if (isDelete) {
    return (
      <m.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 space-y-3",
        )}
      >
        <div className="flex items-center gap-2">
          <ShieldAlert size={16} className="text-destructive shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-destructive">
            Confirm secret deletion
          </span>
        </div>
        <p className="text-sm text-foreground">
          Delete the secret <code className="px-1.5 py-0.5 rounded bg-destructive/15 font-mono text-[12px]">{name}</code>?
          Any code that reads it will start failing.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="destructive"
            disabled={disabled}
            onClick={() => onAnswer(`__DELETE_SECRET_CONFIRM__:${name}`)}
            className="gap-1.5"
          >
            <Check size={13} /> Delete {name}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => onAnswer("Cancel")}
            className="gap-1.5"
          >
            <X size={13} /> Cancel
          </Button>
        </div>
      </m.div>
    );
  }

  if (!isRequest) return null;

  return (
    <m.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-3",
        "shadow-[0_0_0_1px_hsl(43_96%_56%/0.08),0_4px_20px_-8px_hsl(43_96%_56%/0.25)]",
      )}
    >
      <div className="flex items-center gap-2">
        <KeyRound size={16} className="text-amber-400 shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">
          Secret needed
        </span>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground">
          Add <code className="px-1.5 py-0.5 rounded bg-amber-500/15 font-mono text-[12px]">{name}</code>
        </p>
        {purpose && <p className="text-[12.5px] text-foreground/80 leading-snug">{purpose}</p>}
      </div>
      {docsUrl && (
        <a
          href={docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[12px] text-amber-300 hover:text-amber-200 transition-colors"
        >
          <ExternalLink size={12} /> Where to find this key
        </a>
      )}
      <div className="rounded-md bg-background/40 border border-amber-500/20 p-2.5 text-[11.5px] text-foreground/70 leading-snug">
        Open <strong className="text-foreground">Project Settings → Secrets</strong> and add{" "}
        <code className="font-mono text-amber-300">{name}</code>. Your value is encrypted and never sent to the AI.
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={disabled}
          onClick={() => onAnswer(`__SECRET_ADDED__:${name}`)}
          className="gap-1.5 bg-amber-500 hover:bg-amber-400 text-amber-950"
        >
          <Check size={13} /> I've added it
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => onAnswer(`__SECRET_SKIP__:${name}`)}
        >
          Skip for now
        </Button>
      </div>
    </m.div>
  );
};
