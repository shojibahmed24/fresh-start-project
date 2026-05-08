import { forwardRef } from "react";
import { Skeleton } from "@/components/motion/Skeleton";
import logoMark from "@/assets/oneclick-mark.webp";

/** Skeleton bubble that mimics a chat message while it streams in. */
export const ChatMessageSkeleton = forwardRef<
  HTMLDivElement,
  { side?: "user" | "assistant" }
>(({ side = "assistant" }, ref) => {
  const isUser = side === "user";
  return (
    <div ref={ref} className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      <Skeleton variant="circle" className="size-7 shrink-0 rounded-md" />
      <div
        className={`flex-1 max-w-[85%] rounded-lg px-3.5 py-3 space-y-2 ${
          isUser
            ? "bg-primary/10 border border-primary/20"
            : "bg-[hsl(var(--bg-muted))] border border-[hsl(0_0%_100%/0.06)]"
        }`}
      >
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-2/5" />
      </div>
    </div>
  );
});
ChatMessageSkeleton.displayName = "ChatMessageSkeleton";

/** Full-screen Builder skeleton — works on both mobile (single column) and desktop (split panes). */
export const BuilderSkeleton = () => (
  <div className="relative h-[var(--app-height,100dvh)] w-full flex flex-col bg-background overflow-hidden">
    {/* Ambient glow background */}
    <div className="pointer-events-none absolute inset-0 -z-0">
      <div className="absolute -top-40 -left-40 size-[520px] rounded-full bg-primary/15 blur-3xl animate-pulse" />
      <div
        className="absolute -bottom-40 -right-40 size-[560px] rounded-full bg-accent/15 blur-3xl animate-pulse"
        style={{ animationDelay: "1.2s" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,hsl(var(--primary)/0.06),transparent_60%)]" />
    </div>

    {/* Top bar */}
    <div className="relative h-12 border-b border-[hsl(0_0%_100%/0.06)] flex items-center justify-between px-3 shrink-0 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <Skeleton className="size-6 rounded-md" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-16 rounded-md" />
        <Skeleton className="h-7 w-7 rounded-full" />
      </div>
    </div>

    {/* Body — desktop: split panes (chat skeleton + branded loader). Mobile: single centered loader. */}
    <div className="relative flex-1 grid grid-cols-1 md:grid-cols-[38%_1fr] min-h-0">
      {/* Desktop-only: chat-side skeleton */}
      <div className="hidden md:flex flex-col gap-3 p-4 border-r border-[hsl(0_0%_100%/0.06)] overflow-hidden">
        <ChatMessageSkeleton />
        <ChatMessageSkeleton side="user" />
        <ChatMessageSkeleton />
        <div className="mt-auto">
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </div>

      {/* Centered branded loader — full width on mobile, right pane on desktop */}
      <div className="flex items-center justify-center px-6">
        <div className="flex flex-col items-center text-center max-w-sm">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-accent blur-2xl opacity-70 animate-pulse" />
            <img
              src={logoMark}
              alt="OneClick Studio"
              className="relative size-20 rounded-full object-contain drop-shadow-[0_6px_24px_hsl(var(--primary)/0.55)] animate-[spin_6s_linear_infinite]"
            />
          </div>
          <h2 className="text-lg font-semibold mb-1 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
            Preparing your workspace
          </h2>
          <p className="text-sm text-muted-foreground mb-6">Loading your AI builder…</p>
          <div className="relative h-1.5 w-56 rounded-full bg-muted/40 overflow-hidden">
            <div className="absolute inset-y-0 -left-1/3 w-1/3 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent animate-[shimmer_1.6s_linear_infinite]" />
          </div>
        </div>
      </div>
    </div>
  </div>
);

/**
 * Full-screen Monaco editor skeleton — shown while the heavy chunk loads.
 * forwardRef'd because Suspense's loading fallback receives a ref from Monaco's wrapper.
 */
export const CodeEditorSkeleton = forwardRef<HTMLDivElement>((_props, ref) => (
  <div ref={ref} className="h-full flex flex-col bg-[hsl(var(--bg-subtle))]">
    <div className="px-4 py-2 border-b border-[hsl(0_0%_100%/0.06)] flex items-center gap-2">
      <Skeleton className="size-3 rounded" />
      <Skeleton className="h-3 w-48" />
    </div>
    <div className="flex-1 p-4 space-y-2 font-mono">
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} className="flex gap-3 items-center">
          <Skeleton className="h-3 w-6 opacity-50" />
          <div
            className="relative overflow-hidden bg-[hsl(0_0%_100%/0.04)] rounded h-3 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_linear_infinite] before:bg-gradient-to-r before:from-transparent before:via-[hsl(0_0%_100%/0.06)] before:to-transparent"
            style={{ width: `${30 + ((i * 13) % 60)}%` }}
          />
        </div>
      ))}
    </div>
  </div>
));
CodeEditorSkeleton.displayName = "CodeEditorSkeleton";
