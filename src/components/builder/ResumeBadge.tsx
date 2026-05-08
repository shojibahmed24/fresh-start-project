// Stylish, animated badge rendered inside a USER chat bubble when the
// message is an auto-resume marker (instead of the giant structured prompt
// that gets sent to the AI).
//
// Storage format we look for:  "▶︎RESUME:<attempt>/<max>:<originalIntent>"
// Example:                     "▶︎RESUME:2/5:Build a chat app like WhatsApp"
//
// `parseResumeMarker` returns null when the string isn't a resume marker, so
// the chat bubble can fall back to its normal markdown render.

import { m } from "framer-motion";
import { RotateCw, Zap } from "lucide-react";

export const RESUME_PREFIX = "▶︎RESUME:";

export type ParsedResume = {
  attempt: number;
  max: number;
  intent: string;
};

export function parseResumeMarker(content: string): ParsedResume | null {
  if (!content.startsWith(RESUME_PREFIX)) return null;
  const rest = content.slice(RESUME_PREFIX.length);
  // Split on the FIRST two `:` so the intent can contain colons too.
  const firstColon = rest.indexOf(":");
  if (firstColon <= 0) return null;
  const counter = rest.slice(0, firstColon);
  const intent = rest.slice(firstColon + 1).trim();
  const m = counter.match(/^(\d+)\/(\d+)$/);
  if (!m) return null;
  return {
    attempt: Math.max(1, parseInt(m[1], 10)),
    max: Math.max(1, parseInt(m[2], 10)),
    intent,
  };
}

export function buildResumeMarker(
  attempt: number,
  max: number,
  intent: string,
): string {
  const safeIntent = intent.replace(/\s+/g, " ").trim().slice(0, 200);
  return `${RESUME_PREFIX}${attempt}/${max}:${safeIntent}`;
}

export function ResumeBadge({ parsed }: { parsed: ParsedResume }) {
  const { attempt, max, intent } = parsed;
  const showIntentSnippet =
    intent && intent.length > 0
      ? intent.length > 60
        ? intent.slice(0, 57) + "…"
        : intent
      : "";

  return (
    <m.div
      initial={{ opacity: 0, scale: 0.96, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className="inline-flex flex-col gap-1 max-w-full"
    >
      <div
        className={[
          "inline-flex items-center gap-2 self-start",
          "rounded-full px-3 py-1.5",
          "bg-gradient-to-r from-primary/15 via-primary/10 to-transparent",
          "border border-primary/30",
          "shadow-[0_0_18px_-6px_hsl(var(--primary)/0.55)]",
          "text-[12.5px] font-medium text-foreground",
        ].join(" ")}
      >
        {/* Spinning ring while the resume is in flight */}
        <m.span
          animate={{ rotate: 360 }}
          transition={{ duration: 2.4, ease: "linear", repeat: Infinity }}
          className="inline-flex"
          aria-hidden
        >
          <RotateCw size={12} className="text-primary" />
        </m.span>

        <span className="tracking-tight">
          Resuming build
        </span>

        {/* Animated attempt counter chip */}
        <m.span
          key={attempt}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 480, damping: 22 }}
          className={[
            "inline-flex items-center gap-1",
            "rounded-full px-2 py-0.5",
            "bg-primary/25 border border-primary/40",
            "text-[10.5px] font-mono font-semibold tabular-nums text-primary",
          ].join(" ")}
        >
          <Zap size={9} className="opacity-90" />
          {attempt}/{max}
        </m.span>
      </div>

      {showIntentSnippet && (
        <m.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.08, duration: 0.2 }}
          className="text-[11.5px] text-[hsl(var(--foreground-subtle))] italic pl-1"
          title={intent}
        >
          “{showIntentSnippet}”
        </m.span>
      )}
    </m.div>
  );
}
