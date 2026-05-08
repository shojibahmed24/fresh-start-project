import type { Snippet } from "./types.ts";

export const MAGIC_NUMBER_TICKER: Snippet = {
  name: "Animated number ticker (counts up on view)",
  why: "Stat sections need numbers to count up when scrolled into view — instant 'premium' feel for metrics.",
  uses: ["framer-motion"],
  code: `function NumberTicker({ value = 0, duration = 1.4, prefix = "", suffix = "" }) {
  const [n, setN] = React.useState(0);
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / (duration * 1000));
        setN(Math.floor(value * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      obs.disconnect();
    }, { threshold: 0.4 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [value, duration]);
  return <span ref={ref} className="tabular-nums">{prefix}{n.toLocaleString()}{suffix}</span>;
}`,
};

export const MAGIC_GRADIENT_TEXT: Snippet = {
  name: "Animated gradient headline text",
  why: "Hero headlines pop 10× harder with a slow-shifting gradient — used by Vercel, Stripe, OpenAI.",
  uses: [],
  code: `function GradientText({ children, className = "" }) {
  return (
    <span className={\`inline-block bg-[linear-gradient(110deg,hsl(var(--primary)),45%,hsl(var(--accent)),55%,hsl(var(--primary)))] bg-[length:200%_100%] bg-clip-text text-transparent animate-[shine_5s_linear_infinite] \${className}\`}>
      {children}
      <style>{\`@keyframes shine { from { background-position: 200% 0 } to { background-position: -200% 0 } }\`}</style>
    </span>
  );
}`,
};

export const MAGIC_MARQUEE: Snippet = {
  name: "Marquee row (tweet/review carousel)",
  why: "Horizontal infinite marquee of testimonials/reviews — fills space, conveys volume, requires zero JS scroll logic.",
  uses: [],
  code: `function Marquee({ children, reverse = false, speed = 30 }) {
  const items = React.Children.toArray(children);
  return (
    <div className="group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      <div className="flex w-max gap-4 group-hover:[animation-play-state:paused]"
        style={{ animation: \`marqueeX \${speed}s linear infinite\${reverse ? " reverse" : ""}\` }}>
        {[...items, ...items].map((c, i) => <div key={i} className="shrink-0">{c}</div>)}
      </div>
      <style>{\`@keyframes marqueeX { from { transform: translateX(0) } to { transform: translateX(-50%) } }\`}</style>
    </div>
  );
}`,
};

export const MAGIC_PARTICLES_BG: Snippet = {
  name: "Particle background (canvas dots)",
  why: "Subtle floating particles on dark hero = 'AI/tech product' signature without heavy 3D libs.",
  uses: [],
  code: `function ParticlesBg({ count = 60, color = "hsl(var(--primary))" }) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    const resize = () => { c.width = c.offsetWidth; c.height = c.offsetHeight; };
    resize(); window.addEventListener("resize", resize);
    const ps = Array.from({ length: count }, () => ({
      x: Math.random() * c.width, y: Math.random() * c.height,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.6 + 0.4,
    }));
    let raf: number;
    const loop = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.fillStyle = color;
      ps.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > c.width) p.vx *= -1;
        if (p.y < 0 || p.y > c.height) p.vy *= -1;
        ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      });
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [count, color]);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden />;
}`,
};

export const MAGIC_SHIMMER_BUTTON: Snippet = {
  name: "Shimmer button (sweep highlight on hover)",
  why: "Premium primary CTA with a light-sweep on hover — micro-delight that signals 'tap me'.",
  uses: [],
  code: `function ShimmerButton({ children = "Continue", onClick }) {
  return (
    <button onClick={onClick}
      className="group relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-md transition hover:shadow-lg">
      <span className="relative z-10">{children}</span>
      <span aria-hidden
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
    </button>
  );
}`,
};

export const MAGIC_BLUR_FADE: Snippet = {
  name: "Blur-fade reveal (staggered list entrance)",
  why: "Items blur-fade in as they appear — Apple's signature scroll reveal, drop-in replacement for plain lists.",
  uses: ["framer-motion"],
  code: `function BlurFadeList({ items, render }) {
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <motion.div key={i}
          initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5, delay: i * 0.06, ease: [0.21, 0.47, 0.32, 0.98] }}>
          {render(it, i)}
        </motion.div>
      ))}
    </div>
  );
}`,
};

export const MAGIC_ANIMATED_BEAM: Snippet = {
  name: "Animated connection beam (integrations diagram)",
  why: "SaaS landing pages show 'connects with X' via a node + animated dotted beam — visual storytelling.",
  uses: ["framer-motion"],
  code: `function AnimatedBeam({ left, center, right }) {
  // left/center/right: { icon, label }
  const Node = ({ icon: Icon, label }) => (
    <div className="flex flex-col items-center gap-1.5">
      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-border bg-card shadow-md">
        {Icon && <Icon className="h-6 w-6 text-foreground" />}
      </div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
  return (
    <div className="relative flex items-center justify-between gap-4 rounded-3xl border border-border bg-card p-8">
      <Node {...left} />
      <Node {...center} />
      <Node {...right} />
      <svg aria-hidden className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 30">
        <line x1="15" y1="15" x2="50" y2="15" stroke="hsl(var(--primary))" strokeWidth="0.4" strokeDasharray="1.5 1.5">
          <animate attributeName="stroke-dashoffset" from="0" to="-12" dur="1.5s" repeatCount="indefinite" />
        </line>
        <line x1="50" y1="15" x2="85" y2="15" stroke="hsl(var(--primary))" strokeWidth="0.4" strokeDasharray="1.5 1.5">
          <animate attributeName="stroke-dashoffset" from="0" to="-12" dur="1.5s" repeatCount="indefinite" />
        </line>
      </svg>
    </div>
  );
}`,
};

export const MAGIC_DOCK: Snippet = {
  name: "macOS-style magnifying dock",
  why: "Bottom dock with hover-magnify icons — playful, tactile, perfect for app launchers / portfolio nav.",
  uses: [],
  code: `function MagnifyDock({ items }) {
  // items: [{ icon: Icon, label }]
  const [hover, setHover] = React.useState<number | null>(null);
  const scale = (i: number) => hover == null ? 1 : Math.max(1, 1.6 - Math.abs(hover - i) * 0.25);
  return (
    <div className="mx-auto inline-flex items-end gap-2 rounded-2xl border border-border bg-card/80 px-3 py-2 backdrop-blur-md shadow-lg"
      onMouseLeave={() => setHover(null)}>
      {items.map((it, i) => {
        const Icon = it.icon;
        return (
          <button key={i} onMouseEnter={() => setHover(i)}
            style={{ transform: \`scale(\${scale(i)})\` }}
            className="grid h-10 w-10 origin-bottom place-items-center rounded-xl bg-muted text-foreground transition-transform duration-200">
            {Icon && <Icon className="h-5 w-5" />}
          </button>
        );
      })}
    </div>
  );
}`,
};
