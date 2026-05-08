import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { m } from "framer-motion";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

type Variant = "segmented" | "compact";

interface Props {
  variant?: Variant;
  className?: string;
}

/**
 * Three-way theme switcher (Light / Dark / System) with an animated
 * sliding pill highlight. Hydration-safe — renders an inert placeholder
 * until next-themes has resolved the persisted value.
 */
export const ThemeSwitcher = ({ variant = "segmented", className }: Props) => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const active = mounted ? theme ?? "system" : "system";

  if (variant === "compact") {
    return (
      <div className={cn("inline-flex items-center gap-0.5 rounded-full bg-[hsl(var(--bg-muted))] p-0.5 border border-border", className)}>
        {OPTIONS.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            aria-label={label}
            aria-pressed={active === value}
            onClick={() => setTheme(value)}
            className={cn(
              "relative size-7 rounded-full grid place-items-center transition-colors",
              active === value
                ? "text-primary-foreground"
                : "text-[hsl(var(--foreground-muted))] hover:text-foreground",
            )}
          >
            {active === value && (
              <m.span
                layoutId="theme-pill-compact"
                className="absolute inset-0 rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <Icon size={13} className="relative z-10" />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("relative inline-flex items-center gap-1 rounded-xl bg-[hsl(var(--bg-muted))] p-1 border border-border", className)}>
      {OPTIONS.map(({ value, label, Icon }) => {
        const isActive = active === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={isActive}
            className={cn(
              "relative px-3.5 py-1.5 text-[12.5px] font-medium rounded-lg flex items-center gap-1.5 transition-colors",
              isActive ? "text-primary-foreground" : "text-[hsl(var(--foreground-muted))] hover:text-foreground",
            )}
          >
            {isActive && (
              <m.span
                layoutId="theme-pill"
                className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary to-primary-glow shadow-[0_4px_14px_-4px_hsl(var(--primary)/0.55)]"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <Icon size={13} className="relative z-10" />
            <span className="relative z-10">{label}</span>
          </button>
        );
      })}
    </div>
  );
};
