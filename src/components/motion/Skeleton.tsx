import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Skeleton screen with shimmer effect (no spinner!).
 * Use as direct replacement for content while loading.
 *
 * <Skeleton className="h-4 w-32" />
 * <Skeleton variant="card" />
 *
 * forwardRef'd so framer-motion / Suspense fallback wrappers can attach refs
 * without React firing "Function components cannot be given refs" warnings.
 */
type SkeletonProps = {
  className?: string;
  variant?: "default" | "card" | "text" | "circle";
};

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant = "default" }, ref) => {
    const base =
      "relative overflow-hidden bg-[hsl(0_0%_100%/0.04)] before:absolute before:inset-0 " +
      "before:-translate-x-full before:animate-[shimmer_1.6s_linear_infinite] " +
      "before:bg-gradient-to-r before:from-transparent before:via-[hsl(0_0%_100%/0.06)] before:to-transparent";

    const variants = {
      default: "rounded-md h-4 w-full",
      card: "rounded-lg h-32 w-full",
      text: "rounded h-3 w-full",
      circle: "rounded-full aspect-square",
    };

    return <div ref={ref} className={cn(base, variants[variant], className)} />;
  },
);
Skeleton.displayName = "Skeleton";

/** Pre-composed card skeleton — title + 3 lines. */
export const SkeletonCard = ({ className }: { className?: string }) => (
  <div className={cn("card-surface p-5 space-y-3", className)}>
    <Skeleton className="h-5 w-2/3" />
    <Skeleton className="h-3 w-full" />
    <Skeleton className="h-3 w-5/6" />
    <Skeleton className="h-3 w-4/6" />
  </div>
);
