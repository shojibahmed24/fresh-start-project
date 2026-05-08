import { Plus, Undo2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  onNewChat?: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onSearch?: () => void;
};

export const ChatHeader = ({ onNewChat, onUndo, canUndo = false, onSearch }: Props) => (
  <>
    {/* Thin gradient line at the very top */}
    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent pointer-events-none z-10" />
    <div className="relative flex items-center justify-end gap-1 px-2 pt-1.5 pb-1 shrink-0">
      {onSearch && (
        <button
          onClick={onSearch}
          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 p-2.5 md:p-1.5 rounded-md text-[hsl(var(--foreground-muted))] hover:text-foreground hover:bg-[hsl(0_0%_100%/0.05)] active:bg-[hsl(0_0%_100%/0.08)] transition-colors"
          aria-label="Find in chat"
          title="Find in chat (⌘F)"
        >
          <Search size={18} className="md:hidden" />
          <Search size={12} className="hidden md:block" />
        </button>
      )}
      <button
        onClick={onNewChat}
        // Mobile: ≥44px tap target (iOS HIG). Desktop: compact.
        className="inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 px-3 py-2 md:px-2 md:py-1 rounded-md text-[13px] md:text-[11px] font-medium text-[hsl(var(--foreground-muted))] hover:text-foreground hover:bg-[hsl(0_0%_100%/0.05)] active:bg-[hsl(0_0%_100%/0.08)] transition-colors"
        aria-label="New chat"
        title="New chat"
      >
        <Plus size={16} className="md:hidden" />
        <Plus size={12} className="hidden md:block" />
        <span>New</span>
      </button>
      <button
        onClick={canUndo ? onUndo : undefined}
        disabled={!canUndo}
        className={cn(
          "inline-flex items-center justify-center min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 p-2.5 md:p-1.5 rounded-md transition-colors",
          canUndo
            ? "text-[hsl(var(--foreground-muted))] hover:text-foreground hover:bg-[hsl(0_0%_100%/0.05)] active:bg-[hsl(0_0%_100%/0.08)] cursor-pointer"
            : "text-[hsl(var(--foreground-subtle))] opacity-40 cursor-not-allowed",
        )}
        aria-label="Undo last update"
        title={canUndo ? "Undo last update" : "Nothing to undo"}
      >
        <Undo2 size={18} className="md:hidden" />
        <Undo2 size={12} className="hidden md:block" />
      </button>
    </div>
  </>
);
