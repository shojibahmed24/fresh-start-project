import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * App-wide toast surface.
 * - Anchored bottom-right with safe-area aware offset.
 * - Rich colors, close button, and a thin progress bar at the bottom of
 *   each toast (animated via the `--progress` CSS var sonner sets).
 * - Theme follows next-themes (light/dark/system) — same source of truth
 *   as the in-app ThemeSwitcher.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={(resolvedTheme as ToasterProps["theme"]) ?? "dark"}
      position="bottom-right"
      richColors
      closeButton
      expand
      visibleToasts={4}
      offset={20}
      toastOptions={{
        duration: 4500,
        classNames: {
          toast:
            "group toast pointer-events-auto relative overflow-hidden " +
            "group-[.toaster]:bg-[hsl(var(--bg-elevated))] group-[.toaster]:text-foreground " +
            "group-[.toaster]:border group-[.toaster]:border-border " +
            "group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl group-[.toaster]:backdrop-blur-md " +
            "group-[.toaster]:pr-10",
          title: "text-[13px] font-semibold leading-tight",
          description: "group-[.toast]:text-[12px] group-[.toast]:text-[hsl(var(--foreground-muted))]",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-md " +
            "group-[.toast]:px-2.5 group-[.toast]:py-1 group-[.toast]:text-[12px] group-[.toast]:font-medium",
          cancelButton:
            "group-[.toast]:bg-[hsl(var(--bg-muted))] group-[.toast]:text-[hsl(var(--foreground-muted))] " +
            "group-[.toast]:rounded-md group-[.toast]:px-2.5 group-[.toast]:py-1 group-[.toast]:text-[12px]",
          closeButton:
            "group-[.toast]:!left-auto group-[.toast]:!right-2 group-[.toast]:!top-2 " +
            "group-[.toast]:!bg-transparent group-[.toast]:!border-0 " +
            "group-[.toast]:!text-[hsl(var(--foreground-subtle))] hover:group-[.toast]:!text-foreground",
          icon: "group-[.toast]:shrink-0",
        },
      }}
      style={{ ["--toast-progress-color" as string]: "hsl(var(--primary))" }}
      className="toaster group toaster-with-progress"
      {...props}
    />
  );
};

export { Toaster, toast };
