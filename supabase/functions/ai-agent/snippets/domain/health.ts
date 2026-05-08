import type { Snippet } from "../types.ts";

export const FITNESS_RING: Snippet = {
  name: "Circular progress ring (Apple-Fitness style)",
  why: "The signature visual of any health/fitness app — animated SVG ring beats a plain number.",
  code: `function ProgressRing({ value = 0, max = 100, size = 140, label, sub }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} strokeWidth="10"
          className="fill-none stroke-muted" />
        <circle cx={size/2} cy={size/2} r={r} strokeWidth="10" strokeLinecap="round"
          className="fill-none stroke-primary transition-[stroke-dashoffset] duration-700"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-3xl font-bold tabular-nums">{Math.round(pct * 100)}%</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}`,
};

export const MEDITATION_SESSION: Snippet = {
  name: "Meditation session card with duration + breathing orb",
  why: "Meditation apps need calming gradients, soft shadows, breathing-orb visualization.",
  uses: ["lucide-react: Play"],
  code: `function SessionCard({ session }) {
  return (
    <article className="relative overflow-hidden rounded-3xl p-5
      bg-gradient-to-br from-emerald-300 via-teal-400 to-cyan-500 text-white">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/20 blur-2xl animate-pulse" />
      <p className="text-[11px] uppercase tracking-[0.2em] opacity-80">{session.category}</p>
      <h3 className="mt-1 text-xl font-bold">{session.title}</h3>
      <p className="mt-1 text-sm opacity-90">{session.duration} min · {session.guide}</p>
      <button className="mt-4 inline-flex items-center gap-2 rounded-full bg-white text-emerald-700
        px-4 py-2 text-sm font-semibold hover:scale-[1.02] transition">
        <Play className="h-4 w-4 fill-current" /> Begin
      </button>
    </article>
  );
}`,
};

