import type { Snippet } from "../types.ts";

export const KOKO_ANIMATED_NUMBER_CARD: Snippet = {
  name: "Stat card with delta indicator + sparkline",
  why: "Dashboards need rich stat cards: label + huge tabular number + ▲/▼ delta + sparkline.",
  uses: ["lucide-react: TrendingUp, TrendingDown"],
  code: `function StatCard({ stat }) {
  // stat: { label, value, delta, spark: number[] }
  const up = stat.delta >= 0;
  const max = Math.max(...stat.spark), min = Math.min(...stat.spark);
  const points = stat.spark.map((v, i) =>
    \`\${(i / (stat.spark.length - 1)) * 80},\${28 - ((v - min) / (max - min || 1)) * 24}\`
  ).join(" ");
  return (
    <article className="rounded-2xl bg-card border border-border/60 p-4
      hover:shadow-md hover:-translate-y-0.5 transition">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{stat.label}</p>
      <div className="mt-1 flex items-end justify-between">
        <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
        <svg width="80" height="28" className={up ? "text-emerald-500" : "text-rose-500"}>
          <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={points} />
        </svg>
      </div>
      <p className={\`mt-1 inline-flex items-center gap-1 text-xs font-medium
        \${up ? "text-emerald-500" : "text-rose-500"}\`}>
        {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {up ? "+" : ""}{stat.delta}% vs last week
      </p>
    </article>
  );
}`,
};

export const KOKO_TIMELINE: Snippet = {
  name: "Vertical timeline with status dots + relative time",
  why: "Order tracking, activity logs, audit trails — all need a left-rail timeline with colored dots.",
  uses: ["lucide-react: any status icons"],
  code: `function Timeline({ events }) {
  // events: [{ id, title, body?, time, done?, Icon }]
  return (
    <ol className="relative ml-3 border-l-2 border-border space-y-5 pl-5">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className={\`absolute -left-[27px] top-0 grid h-6 w-6 place-items-center rounded-full ring-4 ring-background
            \${e.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}\`}>
            <e.Icon className="h-3 w-3" strokeWidth={3} />
          </span>
          <p className="text-sm font-semibold leading-tight">{e.title}</p>
          {e.body && <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{e.body}</p>}
          <p className="mt-1 text-[11px] text-muted-foreground">{e.time}</p>
        </li>
      ))}
    </ol>
  );
}`,
};

export const KOKO_LEADERBOARD: Snippet = {
  name: "Leaderboard row with rank medal + score",
  why: "Gamified apps (fitness, learning, gaming) need leaderboards with gold/silver/bronze styling.",
  uses: ["lucide-react: Trophy"],
  code: `function LeaderRow({ entry, rank, mine }) {
  const medal = rank === 1
    ? "bg-gradient-to-br from-amber-300 to-amber-500 text-amber-900"
    : rank === 2 ? "bg-gradient-to-br from-zinc-200 to-zinc-400 text-zinc-800"
    : rank === 3 ? "bg-gradient-to-br from-orange-300 to-orange-500 text-orange-900"
    : "bg-muted text-muted-foreground";
  return (
    <li className={\`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition
      \${mine ? "bg-primary/10 ring-2 ring-primary/30" : "hover:bg-muted/40"}\`}>
      <div className={\`grid h-9 w-9 place-items-center rounded-xl text-sm font-bold tabular-nums \${medal}\`}>
        {rank <= 3 ? <Trophy className="h-4 w-4" /> : rank}
      </div>
      <img src={entry.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{entry.name} {mine && <span className="text-xs text-primary">(You)</span>}</p>
        <p className="text-xs text-muted-foreground">{entry.streak} day streak</p>
      </div>
      <p className="text-base font-bold tabular-nums">{entry.score.toLocaleString()}</p>
    </li>
  );
}`,
};

export const KOKO_BADGE_GRID: Snippet = {
  name: "Achievement badge grid (locked / unlocked)",
  why: "Learning/fitness/gaming apps need achievement grids with locked greyscale + unlocked colored states.",
  uses: ["lucide-react: Lock, any achievement icons"],
  code: `function BadgeGrid({ badges }) {
  // badges: [{ id, name, Icon, unlocked, progress? }]
  return (
    <div className="grid grid-cols-3 gap-3">
      {badges.map((b) => (
        <div key={b.id} className="text-center">
          <div className={\`relative mx-auto grid h-20 w-20 place-items-center rounded-2xl transition
            \${b.unlocked
              ? "bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30"
              : "bg-muted text-muted-foreground grayscale"}\`}>
            {b.unlocked ? <b.Icon className="h-8 w-8" /> : <Lock className="h-6 w-6" />}
          </div>
          <p className="mt-2 text-xs font-semibold leading-tight">{b.name}</p>
          {!b.unlocked && b.progress != null && (
            <div className="mt-1 mx-auto h-1 w-12 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: \`\${b.progress}%\` }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}`,
};

export const KOKO_HABIT_HEATMAP: Snippet = {
  name: "Habit heatmap (GitHub-style contribution grid)",
  why: "Habit/streak apps need a 7×N grid of intensity-tinted squares — instantly readable progress.",
  code: `function HabitHeatmap({ data }) {
  // data: number[][] — rows × cols of 0-4 intensity
  const tones = [
    "bg-muted",
    "bg-emerald-500/30",
    "bg-emerald-500/55",
    "bg-emerald-500/80",
    "bg-emerald-500",
  ];
  return (
    <div className="rounded-2xl bg-card border border-border/60 p-4">
      <div className="grid grid-flow-col grid-rows-7 gap-1">
        {data.flatMap((col, ci) =>
          col.map((v, ri) => (
            <span key={\`\${ci}-\${ri}\`}
              className={\`h-3 w-3 rounded-sm \${tones[v]}\`}
              title={\`\${v} sessions\`} />
          ))
        )}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        <span>Less</span>
        {tones.map((t, i) => <span key={i} className={\`h-2.5 w-2.5 rounded-sm \${t}\`} />)}
        <span>More</span>
      </div>
    </div>
  );
}`,
};

export const KOKO_FAQ_ACCORDION: Snippet = {
  name: "FAQ accordion with smooth expand",
  why: "Help/landing pages need accordion FAQs with chevron rotation + height animation.",
  uses: ["framer-motion", "lucide-react: ChevronDown"],
  code: `function FaqItem({ q, a }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="border-b border-border/60 last:border-0">
      <button onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 py-4 text-left">
        <span className="text-sm font-semibold">{q}</span>
        <ChevronDown className={\`h-4 w-4 shrink-0 transition-transform \${open ? "rotate-180" : ""}\`} />
      </button>
      <motion.div initial={false} animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        className="overflow-hidden">
        <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{a}</p>
      </motion.div>
    </div>
  );
}`,
};

export const KOKO_SEGMENTED_CONTROL: Snippet = {
  name: "iOS-style segmented control",
  why: "Tab-style filters (All/Today/Week) inside content need a pill segmented control, not browser tabs.",
  code: `function Segmented({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-full bg-muted p-1">
      {options.map((opt) => {
        const on = value === opt.id;
        return (
          <button key={opt.id} onClick={() => onChange(opt.id)}
            className={\`relative rounded-full px-4 py-1.5 text-xs font-semibold transition
              \${on ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"}\`}>
            {on && (
              <motion.span layoutId="segmentedActive"
                className="absolute inset-0 rounded-full bg-primary -z-10" />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}`,
};

