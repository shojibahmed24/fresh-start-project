import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2, Check } from "lucide-react";

import { cn } from "@/lib/utils";

type Ripple = { id: number; x: number; y: number; size: number };

/**
 * Button — refined to 4 core variants.
 * - primary  : filled gradient/solid accent (default)
 * - secondary: outlined neutral
 * - ghost    : transparent, hover surface
 * - destructive : danger filled
 *
 * Built-in `loading` state replaces text/icon with a spinner while preserving width.
 * `[&_svg]:size-4` keeps icon+text alignment perfect across all variants.
 */
const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium",
    "rounded-md text-sm leading-none select-none",
    "transition-[transform,box-shadow,background-color,border-color,color]",
    "duration-150 ease-[cubic-bezier(0.4,0,0.2,1)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4",
    "active:scale-[0.98]",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: [
          "bg-primary text-primary-foreground",
          "shadow-[0_1px_0_0_hsl(0_0%_100%/0.15)_inset,0_1px_2px_0_hsl(0_0%_0%/0.4)]",
          "hover:bg-primary/90 hover:scale-[1.02]",
          "hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.3),0_0_24px_hsl(var(--primary)/0.4),0_8px_24px_-8px_hsl(0_0%_0%/0.5)]",
        ].join(" "),
        secondary: [
          "bg-transparent text-foreground border border-[hsl(0_0%_100%/0.12)]",
          "hover:bg-[hsl(0_0%_100%/0.04)] hover:border-[hsl(0_0%_100%/0.2)] hover:scale-[1.02]",
        ].join(" "),
        ghost: "bg-transparent text-foreground hover:bg-[hsl(0_0%_100%/0.06)]",
        destructive: [
          "bg-destructive text-destructive-foreground",
          "hover:bg-destructive/90 hover:scale-[1.02]",
          "hover:shadow-[0_0_0_1px_hsl(var(--destructive)/0.3),0_0_20px_hsl(var(--destructive)/0.3)]",
        ].join(" "),
        link: "text-primary underline-offset-4 hover:underline p-0 h-auto",
        // Backwards-compat aliases (existing call sites use these)
        default: [
          "bg-primary text-primary-foreground",
          "shadow-[0_1px_0_0_hsl(0_0%_100%/0.15)_inset,0_1px_2px_0_hsl(0_0%_0%/0.4)]",
          "hover:bg-primary/90 hover:scale-[1.02]",
          "hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.3),0_0_24px_hsl(var(--primary)/0.4),0_8px_24px_-8px_hsl(0_0%_0%/0.5)]",
        ].join(" "),
        outline: [
          "bg-transparent text-foreground border border-[hsl(0_0%_100%/0.12)]",
          "hover:bg-[hsl(0_0%_100%/0.04)] hover:border-[hsl(0_0%_100%/0.2)] hover:scale-[1.02]",
        ].join(" "),
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-10 px-4",
        lg: "h-11 px-6 text-md",
        xl: "h-12 px-7 text-md",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  /** Briefly swap content for a checkmark to confirm an action succeeded. */
  success?: boolean;
  /** Disable the click ripple effect. */
  noRipple?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      success = false,
      noRipple = false,
      disabled,
      leftIcon,
      rightIcon,
      children,
      onClick,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = disabled || loading;
    const [ripples, setRipples] = React.useState<Ripple[]>([]);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!noRipple && !isDisabled) {
        const target = e.currentTarget;
        const rect = target.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 1.4;
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        const id = Date.now() + Math.random();
        setRipples((r) => [...r, { id, x, y, size }]);
        window.setTimeout(() => {
          setRipples((r) => r.filter((rp) => rp.id !== id));
        }, 600);
      }
      onClick?.(e);
    };

    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref as React.Ref<HTMLButtonElement>}
          onClick={onClick}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }), "overflow-hidden")}
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        onClick={handleClick}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            <span className="sr-only">Loading…</span>
          </>
        ) : success ? (
          <span className="inline-flex items-center gap-1.5 animate-in zoom-in-50 fade-in duration-200">
            <Check aria-hidden className="size-4" />
            <span className="sr-only">Done</span>
          </span>
        ) : (
          <>
            {leftIcon}
            {children}
            {rightIcon}
          </>
        )}
        {/* Ripples */}
        <span aria-hidden className="pointer-events-none absolute inset-0">
          {ripples.map((r) => (
            <span
              key={r.id}
              className="absolute rounded-full bg-current opacity-25 animate-[ripple_600ms_ease-out_forwards]"
              style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
            />
          ))}
        </span>
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
