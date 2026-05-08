import { m } from "framer-motion";
import { type ReactNode } from "react";

type Props = {
  label: string;
  value: string | number;
  icon: ReactNode;
  /** Series of small numbers to render as an inline sparkline. */
  spark?: number[];
  /** Tailwind gradient classes, e.g. "from-violet-500 to-fuchsia-500". */
  gradient?: string;
  /** Optional small caption under the value (e.g. "+12 this week"). */
  caption?: string;
  delay?: number;
};

/**
 * Build a smooth sparkline path from a numeric series, normalised to the
 * supplied viewBox. Returns both a stroke path and a closed area path so the
 * caller can paint a gradient fill underneath.
 */
const buildSparkline = (data: number[], w = 100, h = 28) => {
  if (data.length === 0) return { line: "", area: "" };
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = w / Math.max(data.length - 1, 1);
  const pts = data.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * h;
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  return { line, area };
};

/**
 * Premium gradient stat card with an inline sparkline. Used on the dashboard
 * hero row. Each card is fully self-contained — no external state needed.
 */
export const StatCard = ({ label, value, icon, spark = [], gradient = "from-violet-500/20 to-fuchsia-500/10", caption, delay = 0 }: Props) => {
  const { line, area } = buildSparkline(spark);
  const gradId = `sg-${label.replace(/\s+/g, "")}`;

  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/50 p-4 sm:p-5 group hover:border-primary/40 hover:shadow-glow transition-all"
    >
      {/* Brand wash */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none`} />
      {/* Subtle aurora orb */}
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/20 blur-2xl opacity-50 group-hover:opacity-80 transition-opacity pointer-events-none" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
          <div className="mt-1 text-2xl sm:text-3xl font-bold leading-tight truncate">{value}</div>
          {caption && <div className="mt-0.5 text-[11px] text-muted-foreground">{caption}</div>}
        </div>
        <div className="shrink-0 size-9 rounded-xl bg-background/60 border border-border/50 flex items-center justify-center text-primary">
          {icon}
        </div>
      </div>

      {spark.length > 1 && (
        <svg
          viewBox="0 0 100 28"
          preserveAspectRatio="none"
          className="relative mt-3 w-full h-7 overflow-visible"
          aria-hidden
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradId})`} />
          <path
            d={line}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </m.div>
  );
};
