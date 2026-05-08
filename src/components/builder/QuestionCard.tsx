// QuestionCard — interactive multi-choice prompt rendered when the agent
// calls the `ask_user` tool.
//
// Premium UX + full a11y:
//   - "AI is asking" header badge with sparkle
//   - Numbered option buttons (keyboard 1-9 shortcut)
//   - Arrow up/down to move focus, Enter to select, Esc to focus custom input
//   - Stagger-in animation on options + spring on selection
//   - Inline custom-answer input with Enter hint
//   - "Skip this question" action when allowOther (sends `[skipped]`)
//   - Network-failure retry: if `lastError` prop is set, the previously
//     submitted answer is pre-filled and a Retry button is offered
//   - Collapsed "answered" state with click-to-expand history
//   - Post-answer "thinking…" pulse so the user knows the agent is working
//   - role="radiogroup" + aria-labelledby + aria-live announcement
import { useEffect, useId, useRef, useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { Sparkles, Send, Check, Pencil, ChevronDown, SkipForward, RotateCcw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  question: string;
  options: string[];
  allowOther?: boolean;
  onAnswer: (answer: string) => void;
  disabled?: boolean;
  // Set when the previous submit attempt failed (network/server). Pre-fills
  // the answer and shows an inline retry affordance.
  lastError?: { answer: string; message: string } | null;
  onRetry?: () => void;
};

export const QuestionCard = ({
  question,
  options,
  allowOther = true,
  onAnswer,
  disabled,
  lastError,
  onRetry,
}: Props) => {
  const [picked, setPicked] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [showOther, setShowOther] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const otherRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const labelId = useId();

  // Auto-collapse 600ms after the user picks so the chat stays tidy.
  useEffect(() => {
    if (!picked || lastError) return;
    const t = setTimeout(() => setCollapsed(true), 600);
    return () => clearTimeout(t);
  }, [picked, lastError]);

  // Keyboard navigation: arrows move focus, Enter selects, Esc opens custom
  // input, number keys 1-9 select directly.
  useEffect(() => {
    if (picked || disabled) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
      if (showOther) return;

      if (!inField) {
        const n = parseInt(e.key, 10);
        if (!isNaN(n) && n >= 1 && n <= options.length) {
          e.preventDefault();
          handlePick(options[n - 1]);
          return;
        }
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = (focusIdx + 1) % options.length;
        setFocusIdx(next);
        optionRefs.current[next]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const next = (focusIdx - 1 + options.length) % options.length;
        setFocusIdx(next);
        optionRefs.current[next]?.focus();
      } else if (e.key === "Enter" && !inField) {
        const focused = document.activeElement as HTMLElement | null;
        if (focused && optionRefs.current.includes(focused as HTMLButtonElement)) {
          // Native button click handles it.
          return;
        }
        e.preventDefault();
        handlePick(options[focusIdx]);
      } else if (e.key === "Escape" && allowOther && !showOther) {
        e.preventDefault();
        setShowOther(true);
        setTimeout(() => otherRef.current?.focus(), 50);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, picked, disabled, showOther, focusIdx, allowOther]);

  const handlePick = (opt: string) => {
    if (disabled || picked) return;
    setPicked(opt);
    onAnswer(opt);
  };

  const handleOther = () => {
    const v = other.trim();
    if (!v || disabled) return;
    setPicked(v);
    onAnswer(v);
  };

  const handleSkip = () => {
    if (disabled || picked) return;
    setPicked("[skipped]");
    onAnswer("[skipped]");
  };

  // Collapsed answered pill — click to re-expand history.
  if (collapsed && picked && !lastError) {
    return (
      <m.button
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => setCollapsed(false)}
        aria-label={`Expand answered question: ${question}`}
        className={cn(
          "group flex w-full items-center gap-2 rounded-lg border border-primary/20 bg-primary/[0.04]",
          "px-3 py-2 text-left text-[12.5px] transition-colors hover:bg-primary/[0.08]",
        )}
      >
        <Check size={13} className="text-primary shrink-0" aria-hidden />
        <span className="text-[hsl(var(--foreground-muted))] shrink-0">You answered:</span>
        <span className="text-foreground font-medium truncate min-w-0">{picked}</span>
        <ChevronDown
          size={13}
          aria-hidden
          className="ml-auto text-[hsl(var(--foreground-muted))] shrink-0 transition-transform group-hover:translate-y-0.5"
        />
      </m.button>
    );
  }

  return (
    <m.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={cn(
        "rounded-xl border border-primary/25 bg-primary/[0.04] p-3.5 space-y-3",
        "shadow-[0_0_0_1px_hsl(var(--primary)/0.08),0_4px_20px_-8px_hsl(var(--primary)/0.25)]",
      )}
    >
      {/* SR-only live region announces the new question on appear */}
      <div role="status" aria-live="polite" className="sr-only">
        New question from agent: {question}
      </div>

      {/* Header: AI badge + question */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5",
              "text-[10px] font-semibold uppercase tracking-wider text-primary",
            )}
          >
            <Sparkles size={10} className="animate-pulse" aria-hidden />
            AI is asking
          </span>
        </div>
        <p
          id={labelId}
          className="text-sm font-semibold text-foreground leading-snug"
        >
          {question}
        </p>
      </div>

      {/* Network failure banner — pre-fills the failed answer & offers retry */}
      {lastError && onRetry && (
        <m.div
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "flex items-center gap-2 rounded-lg border border-destructive/40",
            "bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive",
          )}
          role="alert"
        >
          <AlertCircle size={14} className="shrink-0" aria-hidden />
          <span className="flex-1 truncate">
            Couldn't send "{lastError.answer}" — {lastError.message}
          </span>
          <button
            onClick={onRetry}
            className={cn(
              "inline-flex items-center gap-1 rounded-md bg-destructive/20 hover:bg-destructive/30",
              "px-2.5 py-1 font-medium min-h-[32px] transition-colors",
            )}
          >
            <RotateCcw size={13} aria-hidden />
            Retry
          </button>
        </m.div>
      )}

      {/* Options */}
      <div
        className="grid gap-1.5"
        role="radiogroup"
        aria-labelledby={labelId}
      >
        {options.map((opt, i) => {
          const active = picked === opt;
          const dimmed = picked !== null && !active;
          return (
            <m.button
              key={opt}
              ref={(el) => (optionRefs.current[i] = el)}
              role="radio"
              aria-checked={active}
              tabIndex={focusIdx === i ? 0 : -1}
              onFocus={() => setFocusIdx(i)}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.18 }}
              whileTap={!picked && !disabled ? { scale: 0.98 } : undefined}
              onClick={() => handlePick(opt)}
              disabled={disabled || picked !== null}
              className={cn(
                "group flex items-center gap-2.5 text-left text-[13px] rounded-lg px-3 py-2.5",
                "border transition-all min-h-[44px]",
                "border-[hsl(0_0%_100%/0.08)] bg-[hsl(var(--bg-elevated))]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                !picked && "hover:border-primary/50 hover:bg-primary/10 hover:translate-x-0.5",
                active && "border-primary bg-primary/15 text-foreground",
                dimmed && "opacity-40 cursor-not-allowed",
                disabled && !active && "opacity-50 cursor-not-allowed",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "shrink-0 inline-flex items-center justify-center w-5 h-5 rounded",
                  "text-[10.5px] font-mono font-semibold border transition-colors",
                  active
                    ? "border-primary/60 bg-primary/20 text-primary"
                    : "border-[hsl(0_0%_100%/0.1)] bg-[hsl(0_0%_100%/0.03)] text-[hsl(var(--foreground-muted))] group-hover:border-primary/40 group-hover:text-primary",
                )}
              >
                {i + 1}
              </span>
              <span className="flex-1 min-w-0 truncate">{opt}</span>
              <AnimatePresence>
                {active && (
                  <m.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="shrink-0"
                    aria-hidden
                  >
                    <Check size={14} className="text-primary" />
                  </m.span>
                )}
              </AnimatePresence>
            </m.button>
          );
        })}
      </div>

      {/* Custom answer input — inline expansion */}
      {allowOther && picked === null && (
        <AnimatePresence initial={false} mode="wait">
          {!showOther ? (
            <m.div
              key="open-other"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5"
            >
              <button
                onClick={() => {
                  setShowOther(true);
                  setTimeout(() => otherRef.current?.focus(), 50);
                }}
                disabled={disabled}
                className={cn(
                  "inline-flex items-center gap-1.5 text-[12px] text-[hsl(var(--foreground-muted))]",
                  "hover:text-primary transition-colors",
                )}
              >
                <Pencil size={11} aria-hidden />
                Or type your own answer
              </button>
              <button
                onClick={handleSkip}
                disabled={disabled}
                aria-label="Skip this question"
                className={cn(
                  "inline-flex items-center gap-1.5 text-[12px] text-[hsl(var(--foreground-muted))]",
                  "hover:text-foreground transition-colors",
                )}
              >
                <SkipForward size={11} aria-hidden />
                Skip this question
              </button>
            </m.div>
          ) : (
            <m.div
              key="other-input"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              className="space-y-1"
            >
              <div className="flex gap-1.5">
                <input
                  ref={otherRef}
                  value={other}
                  onChange={(e) => setOther(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleOther();
                    if (e.key === "Escape") {
                      setShowOther(false);
                      setOther("");
                    }
                  }}
                  placeholder="Type your answer…"
                  disabled={disabled}
                  aria-labelledby={labelId}
                  className={cn(
                    "flex-1 min-w-0 rounded-md border border-[hsl(0_0%_100%/0.1)]",
                    "bg-[hsl(var(--bg-elevated))] px-2.5 py-2 text-[13px] outline-none",
                    "focus:border-primary focus:bg-primary/[0.04] transition-colors",
                  )}
                />
                <Button
                  size="sm"
                  onClick={handleOther}
                  disabled={!other.trim() || disabled}
                  className="shrink-0"
                  aria-label="Submit custom answer"
                >
                  <Send size={13} />
                </Button>
              </div>
              <p className="text-[10.5px] text-[hsl(var(--foreground-muted))] pl-0.5">
                Press <kbd className="px-1 rounded bg-[hsl(0_0%_100%/0.06)] font-mono">Enter</kbd> to
                submit · <kbd className="px-1 rounded bg-[hsl(0_0%_100%/0.06)] font-mono">Esc</kbd>{" "}
                to cancel
              </p>
            </m.div>
          )}
        </AnimatePresence>
      )}

      {/* Post-answer "thinking…" pulse (suppressed when an error is shown) */}
      <AnimatePresence>
        {picked && !lastError && (
          <m.div
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 pt-0.5"
            aria-live="polite"
          >
            <div className="flex gap-1" aria-hidden>
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse [animation-delay:300ms]" />
            </div>
            <span className="text-[11.5px] text-[hsl(var(--foreground-muted))]">
              Agent is thinking…
            </span>
          </m.div>
        )}
      </AnimatePresence>

      {/* Keyboard hint when idle */}
      {!picked && !showOther && options.length > 1 && (
        <p className="text-[10.5px] text-[hsl(var(--foreground-muted))] pl-0.5">
          <kbd className="px-1 rounded bg-[hsl(0_0%_100%/0.06)] font-mono">1</kbd>–
          <kbd className="px-1 rounded bg-[hsl(0_0%_100%/0.06)] font-mono">{options.length}</kbd>{" "}
          pick · <kbd className="px-1 rounded bg-[hsl(0_0%_100%/0.06)] font-mono">↑↓</kbd> nav ·{" "}
          <kbd className="px-1 rounded bg-[hsl(0_0%_100%/0.06)] font-mono">Esc</kbd> custom
        </p>
      )}
    </m.div>
  );
};
