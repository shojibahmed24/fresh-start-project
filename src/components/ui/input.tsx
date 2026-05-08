import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Input — refined with subtle border, smooth cyan focus ring, and error state.
 *
 * Style choice: **placeholder-based** (not floating label) — denser, more
 * tech-app appropriate (Linear/Vercel/Bolt all use this).
 *
 * Pair with <FormField> + <FormMessage> for full error UX, or pass `error`
 * directly for a quick red border + helper text.
 */
export interface InputProps extends React.ComponentProps<"input"> {
  error?: string | boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  helperText?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, leftIcon, rightIcon, helperText, ...props }, ref) => {
    const hasError = Boolean(error);
    const errorMsg = typeof error === "string" ? error : undefined;

    const inputEl = (
      <input
        type={type}
        ref={ref}
        aria-invalid={hasError || undefined}
        className={cn(
          "flex h-10 w-full rounded-md border bg-[hsl(var(--bg-muted))] px-3 py-2",
          "text-sm text-foreground placeholder:text-[hsl(var(--foreground-subtle))]",
          "transition-[border-color,box-shadow] duration-180 ease-[cubic-bezier(0.4,0,0.2,1)]",
          "border-[hsl(0_0%_100%/0.08)]",
          "hover:border-[hsl(0_0%_100%/0.14)]",
          "focus-visible:outline-none focus-visible:border-[hsl(var(--primary)/0.5)]",
          "focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)/0.18),0_0_16px_hsl(var(--primary)/0.12)]",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "disabled:cursor-not-allowed disabled:opacity-50",
          leftIcon && "pl-9",
          rightIcon && "pr-9",
          hasError &&
            "border-destructive/60 focus-visible:border-destructive focus-visible:shadow-[0_0_0_3px_hsl(var(--destructive)/0.2)]",
          className,
        )}
        {...props}
      />
    );

    if (!leftIcon && !rightIcon && !errorMsg && !helperText) return inputEl;

    return (
      <div className="space-y-1.5">
        <div className="relative">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--foreground-subtle))] [&_svg]:size-4">
              {leftIcon}
            </span>
          )}
          {inputEl}
          {rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--foreground-subtle))] [&_svg]:size-4">
              {rightIcon}
            </span>
          )}
        </div>
        {(errorMsg || helperText) && (
          <p
            className={cn(
              "text-xs leading-snug",
              hasError ? "text-destructive" : "text-[hsl(var(--foreground-subtle))]",
            )}
          >
            {errorMsg || helperText}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
