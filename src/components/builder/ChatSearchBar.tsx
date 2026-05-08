import { useEffect, useRef } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  query: string;
  total: number;
  index: number; // 0-based position of the active hit
  onChange: (q: string) => void;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
};

/**
 * Floating search bar for in-chat find (Cmd/Ctrl+F).
 * Mirrors browser-style "find on page" affordances: count, prev/next, Esc.
 */
export const ChatSearchBar = ({
  open,
  query,
  total,
  index,
  onChange,
  onClose,
  onPrev,
  onNext,
}: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // Slight delay so focus survives mount transition.
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) onPrev();
      else onNext();
    }
  };

  return (
    <div
      className={cn(
        "absolute top-2 left-1/2 -translate-x-1/2 z-30",
        "flex items-center gap-1 px-2 py-1.5 rounded-xl",
        "bg-[hsl(var(--bg-elevated))]/95 backdrop-blur-md",
        "border border-[hsl(0_0%_100%/0.08)]",
        "shadow-[0_8px_32px_-8px_hsl(0_0%_0%/0.6)]",
      )}
      role="search"
    >
      <Search size={13} className="text-[hsl(var(--foreground-muted))] mx-1" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Find in chat…"
        className="bg-transparent outline-none text-[13px] text-foreground placeholder:text-[hsl(var(--foreground-subtle))] w-44 sm:w-56"
        aria-label="Find in chat"
      />
      <span className="px-1.5 text-[11px] font-mono text-[hsl(var(--foreground-muted))] tabular-nums min-w-[44px] text-center">
        {query ? `${total === 0 ? 0 : index + 1}/${total}` : "—"}
      </span>
      <button
        onClick={onPrev}
        disabled={total === 0}
        className="p-1 rounded-md hover:bg-[hsl(0_0%_100%/0.06)] disabled:opacity-40 disabled:cursor-not-allowed text-[hsl(var(--foreground-muted))]"
        aria-label="Previous match"
        title="Previous (Shift+Enter)"
      >
        <ChevronUp size={14} />
      </button>
      <button
        onClick={onNext}
        disabled={total === 0}
        className="p-1 rounded-md hover:bg-[hsl(0_0%_100%/0.06)] disabled:opacity-40 disabled:cursor-not-allowed text-[hsl(var(--foreground-muted))]"
        aria-label="Next match"
        title="Next (Enter)"
      >
        <ChevronDown size={14} />
      </button>
      <button
        onClick={onClose}
        className="p-1 rounded-md hover:bg-[hsl(0_0%_100%/0.06)] text-[hsl(var(--foreground-muted))]"
        aria-label="Close search"
        title="Close (Esc)"
      >
        <X size={14} />
      </button>
    </div>
  );
};
