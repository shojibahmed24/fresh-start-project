import type { Snippet } from "./types.ts";

export const ACE_AURORA_HERO: Snippet = {
  name: "Aurora gradient hero with animated blobs",
  why: "Landing pages need an immediate 'wow' — soft animated aurora gradient is the modern Stripe/Linear signature.",
  uses: ["framer-motion", "lucide-react: ArrowRight, Sparkles"],
  code: `function AuroraHero({ eyebrow = "New", title, subtitle, cta = "Start free" }) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-background p-8 sm:p-14 text-center">
      <motion.div aria-hidden
        animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-primary/40 blur-[120px]" />
      <motion.div aria-hidden
        animate={{ x: [0, -50, 30, 0], y: [0, 40, -10, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -bottom-32 right-1/4 h-96 w-96 rounded-full bg-accent/40 blur-[120px]" />
      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium backdrop-blur">
          <Sparkles className="h-3 w-3 text-primary" /> {eyebrow}
        </span>
        <h1 className="mx-auto mt-5 max-w-3xl bg-gradient-to-br from-foreground via-foreground to-foreground/60 bg-clip-text text-4xl font-bold leading-[1.05] text-transparent sm:text-6xl">
          {title}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">{subtitle}</p>
        <button className="mt-7 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background shadow-[0_10px_40px_-10px_hsl(var(--foreground)/0.6)] transition hover:scale-[1.02]">
          {cta} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}`,
};

export const ACE_GLOW_CTA: Snippet = {
  name: "Glowing border CTA button (animated gradient ring)",
  why: "Premium products mark the primary action with an animated glowing border — drives conversion.",
  uses: ["framer-motion"],
  code: `function GlowCTA({ children = "Get started", onClick }) {
  return (
    <button onClick={onClick} className="group relative inline-flex overflow-hidden rounded-full p-[1.5px] focus:outline-none">
      <span className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,hsl(var(--primary))_0%,hsl(var(--accent))_50%,hsl(var(--primary))_100%)]" />
      <span className="relative inline-flex h-full w-full items-center justify-center rounded-full bg-background px-6 py-2.5 text-sm font-semibold text-foreground backdrop-blur transition group-hover:bg-background/80">
        {children}
      </span>
    </button>
  );
}`,
};

export const ACE_SPOTLIGHT_CARD: Snippet = {
  name: "Spotlight card with cursor-tracking glow",
  why: "Mouse-following spotlight on feature cards is the Linear/Vercel signature — feels alive without being noisy.",
  uses: ["lucide-react: any feature icon"],
  code: `function SpotlightCard({ icon: Icon, title, body }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    ref.current!.style.setProperty("--x", \`\${e.clientX - r.left}px\`);
    ref.current!.style.setProperty("--y", \`\${e.clientY - r.top}px\`);
  };
  return (
    <div ref={ref} onMouseMove={onMove}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition hover:border-primary/40">
      <div aria-hidden
        className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(400px circle at var(--x) var(--y), hsl(var(--primary)/0.12), transparent 40%)" }} />
      <div className="relative">
        {Icon && <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>}
        <h3 className="mt-4 text-base font-semibold">{title}</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}`,
};

export const ACE_BENTO_GRID: Snippet = {
  name: "Bento-style asymmetric feature grid",
  why: "Apple/Linear-style bento grids communicate multiple features without feeling listy — the modern landing page standard.",
  uses: [],
  code: `function BentoGrid({ items }) {
  // items: [{ title, body, span?: 'lg' | 'md' | 'sm', accent?: boolean }]
  const spanClass = (s) => s === "lg" ? "md:col-span-2 md:row-span-2" : s === "md" ? "md:col-span-2" : "";
  return (
    <div className="grid auto-rows-[180px] grid-cols-1 gap-3 md:grid-cols-3">
      {items.map((it, i) => (
        <div key={i}
          className={\`group relative overflow-hidden rounded-2xl border border-border p-5 transition hover:-translate-y-0.5 \${spanClass(it.span)} \${it.accent ? "bg-gradient-to-br from-primary/15 via-card to-card" : "bg-card"}\`}>
          <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/10 blur-2xl opacity-0 transition group-hover:opacity-100" />
          <h3 className="relative text-base font-semibold">{it.title}</h3>
          <p className="relative mt-1.5 text-sm text-muted-foreground">{it.body}</p>
        </div>
      ))}
    </div>
  );
}`,
};

export const ACE_PARALLAX_PHONE: Snippet = {
  name: "Parallax phone mockup card",
  why: "Mobile-app landings need a phone showcase — subtle scroll/tilt parallax sells 'real product' without a screenshot.",
  uses: ["framer-motion"],
  code: `function ParallaxPhone({ children }) {
  const [t, setT] = React.useState({ x: 0, y: 0 });
  const onMove = (e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    setT({ x: ((e.clientX - r.left) / r.width - 0.5) * 14, y: ((e.clientY - r.top) / r.height - 0.5) * -14 });
  };
  return (
    <div onMouseMove={onMove} onMouseLeave={() => setT({ x: 0, y: 0 })}
      className="relative mx-auto w-[280px]" style={{ perspective: 1200 }}>
      <motion.div animate={{ rotateY: t.x, rotateX: t.y }} transition={{ type: "spring", stiffness: 120, damping: 14 }}
        className="rounded-[2.5rem] border-[10px] border-foreground/90 bg-background p-2 shadow-[0_40px_80px_-20px_hsl(var(--primary)/0.4)]"
        style={{ transformStyle: "preserve-3d" }}>
        <div className="h-1 w-16 mx-auto rounded-full bg-foreground/40 mb-2" />
        <div className="h-[480px] overflow-hidden rounded-[1.8rem] bg-card">{children}</div>
      </motion.div>
    </div>
  );
}`,
};

export const ACE_FEATURE_LIST: Snippet = {
  name: "Animated feature list with check icons",
  why: "Marketing pages need a 'why us' section — staggered entrance + check icons = instant trust.",
  uses: ["framer-motion", "lucide-react: Check"],
  code: `function FeatureList({ title, items }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
      <h2 className="text-2xl font-bold">{title}</h2>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {items.map((it, i) => (
          <motion.li key={i}
            initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }} viewport={{ once: true }}
            className="flex items-start gap-3 rounded-xl border border-border/60 bg-background p-3.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
              <Check className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-sm font-semibold">{it.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{it.body}</p>
            </div>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}`,
};

export const ACE_TESTIMONIAL_GLOW: Snippet = {
  name: "Glowing testimonial card with avatar stack",
  why: "Social proof block with subtle glow + avatar stack reads as 'real people use this' — landing-page essential.",
  uses: ["lucide-react: Star, Quote"],
  code: `function TestimonialGlow({ quote, name, role, avatars = [] }) {
  return (
    <figure className="relative overflow-hidden rounded-3xl border border-border bg-card p-7">
      <div aria-hidden className="absolute -top-20 left-1/2 h-60 w-[120%] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      <Quote className="relative h-8 w-8 text-primary/60" />
      <blockquote className="relative mt-3 text-lg font-medium leading-snug">"{quote}"</blockquote>
      <div className="relative mt-5 flex items-center justify-between">
        <figcaption>
          <p className="text-sm font-semibold">{name}</p>
          <p className="text-xs text-muted-foreground">{role}</p>
        </figcaption>
        <div className="flex -space-x-2">
          {avatars.slice(0, 4).map((a, i) => (
            <div key={i} className="h-8 w-8 rounded-full border-2 border-card bg-gradient-to-br from-primary to-accent" style={{ backgroundImage: a ? \`url(\${a})\` : undefined, backgroundSize: "cover" }} />
          ))}
        </div>
      </div>
      <div className="relative mt-3 flex gap-0.5">
        {[...Array(5)].map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-primary text-primary" />)}
      </div>
    </figure>
  );
}`,
};

export const ACE_INFINITE_LOGOS: Snippet = {
  name: "Infinite scrolling logo strip ('trusted by')",
  why: "Auto-scrolling brand strip at top of landing = instant credibility, used by every YC/SaaS site.",
  uses: [],
  code: `function InfiniteLogos({ logos }) {
  // logos: array of strings (brand names or img URLs)
  const row = [...logos, ...logos];
  return (
    <div className="relative overflow-hidden py-6 [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
      <div className="flex w-max animate-[marquee_28s_linear_infinite] gap-12 px-6">
        {row.map((l, i) => (
          <span key={i} className="text-lg font-bold tracking-tight text-muted-foreground/70 grayscale transition hover:text-foreground hover:grayscale-0">
            {l}
          </span>
        ))}
      </div>
      <style>{\`@keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }\`}</style>
    </div>
  );
}`,
};
