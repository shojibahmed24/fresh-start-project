import type { Snippet } from "./types.ts";

export const HERO_GRADIENT: Snippet = {
  name: "Gradient hero card with focal CTA",
  why: "Every premium app opens with a single hero with clear focal contrast.",
  uses: ["framer-motion", "lucide-react: ArrowRight"],
  code: `function HeroCard({ title, subtitle, cta = "Get started", onCta }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl p-6 sm:p-8
        bg-gradient-to-br from-primary via-primary/90 to-primary/60
        text-primary-foreground shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.5)]">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
      <p className="text-xs uppercase tracking-[0.2em] opacity-80">{subtitle}</p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-bold leading-tight">{title}</h1>
      <button onClick={onCta}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-white text-primary
          px-5 py-2.5 text-sm font-semibold hover:scale-[1.02] transition">
        {cta} <ArrowRight className="h-4 w-4" />
      </button>
    </motion.section>
  );
}`,
};

export const STAT_PILL: Snippet = {
  name: "Stat pill row (3-up KPI strip)",
  why: "Numbers-at-a-glance row gives instant authority. Use sparingly — 3 max.",
  code: `function StatPills({ items }) {
  // items: [{ label, value, delta? }]
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((s) => (
        <div key={s.label}
          className="rounded-2xl border border-border bg-card/60 backdrop-blur p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{s.value}</p>
          {s.delta && <p className="text-xs text-emerald-500 font-medium">{s.delta}</p>}
        </div>
      ))}
    </div>
  );
}`,
};

export const SECTION_HEADER: Snippet = {
  name: "Section header with action",
  why: "Every horizontal carousel / grid needs a titled header — never a plain string.",
  uses: ["lucide-react: ChevronRight"],
  code: `function SectionHeader({ title, action = "See all", onAction }) {
  return (
    <header className="flex items-end justify-between mb-3">
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      {onAction && (
        <button onClick={onAction}
          className="text-xs font-medium text-primary inline-flex items-center gap-0.5 hover:gap-1 transition-all">
          {action} <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </header>
  );
}`,
};

export const BOTTOM_NAV: Snippet = {
  name: "Premium bottom nav (mobile)",
  why: "Mobile-first apps need a sticky bottom nav with 4-5 tabs and an active indicator.",
  uses: ["lucide-react: any 4 icons"],
  code: `function BottomNav({ tabs, active, onChange }) {
  // tabs: [{ id, label, Icon }]
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md
      border-t border-border bg-background/85 backdrop-blur-lg">
      <ul className="grid grid-cols-4">
        {tabs.map((t) => {
          const on = active === t.id;
          return (
            <li key={t.id}>
              <button onClick={() => onChange(t.id)}
                className="flex w-full flex-col items-center gap-0.5 py-2.5">
                <t.Icon className={\`h-5 w-5 \${on ? "text-primary" : "text-muted-foreground"}\`} />
                <span className={\`text-[10px] font-medium \${on ? "text-primary" : "text-muted-foreground"}\`}>{t.label}</span>
                {on && <span className="absolute -top-px h-0.5 w-8 bg-primary rounded-full" />}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}`,
};

export const SHARED: Snippet[] = [HERO_GRADIENT, SECTION_HEADER, STAT_PILL, BOTTOM_NAV];
