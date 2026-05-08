import { m } from "framer-motion";

/**
 * Auto-scrolling marquee of "apps built with OneClick" rendered as
 * stylized phone mockups. No external imagery needed — every card is
 * pure CSS so it stays sharp and theme-aware.
 */
const SHOWCASES: { name: string; tag: string; gradient: string; ui: "feed" | "shop" | "fitness" | "finance" | "chat" | "music" }[] = [
  { name: "Glow Fitness", tag: "Health & Workout", gradient: "from-orange-500/30 to-rose-500/30", ui: "fitness" },
  { name: "Mint Wallet", tag: "Personal Finance", gradient: "from-emerald-400/30 to-cyan-500/30", ui: "finance" },
  { name: "Pulse Social", tag: "Community Feed", gradient: "from-fuchsia-500/30 to-violet-600/30", ui: "feed" },
  { name: "Crate Shop", tag: "E-commerce", gradient: "from-amber-400/30 to-pink-500/30", ui: "shop" },
  { name: "Echo Chat", tag: "Messaging", gradient: "from-sky-500/30 to-indigo-500/30", ui: "chat" },
  { name: "Wave Music", tag: "Audio Streaming", gradient: "from-purple-500/30 to-blue-500/30", ui: "music" },
];

const PhoneMock = ({ item }: { item: typeof SHOWCASES[number] }) => (
  <div className="shrink-0 w-[220px] mx-3">
    <div className="relative w-full h-[440px] rounded-[2.4rem] bg-[hsl(240_8%_4%)] border border-border/80 shadow-2xl overflow-hidden">
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-4 rounded-full bg-background z-20" />
      <div className={`absolute inset-1.5 rounded-[2.1rem] overflow-hidden bg-gradient-to-br ${item.gradient}`}>
        <div className="absolute inset-0 bg-background/45 backdrop-blur-sm" />
        <div className="relative h-full p-3 pt-7 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold text-foreground">{item.name}</div>
            <div className="w-5 h-5 rounded-full bg-foreground/20" />
          </div>
          <UIByType type={item.ui} />
        </div>
      </div>
    </div>
    <div className="text-center mt-3">
      <div className="text-sm font-semibold text-foreground">{item.name}</div>
      <div className="text-xs text-muted-foreground">{item.tag}</div>
    </div>
  </div>
);

const UIByType = ({ type }: { type: typeof SHOWCASES[number]["ui"] }) => {
  if (type === "fitness")
    return (
      <>
        <div className="rounded-xl bg-foreground/10 border border-foreground/10 p-2.5">
          <div className="text-[9px] text-foreground/70 mb-1">Today</div>
          <div className="text-lg font-bold text-foreground">2,481 kcal</div>
          <div className="mt-1.5 h-1 rounded-full bg-foreground/15 overflow-hidden">
            <div className="h-full w-2/3 bg-gradient-primary rounded-full" />
          </div>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg bg-foreground/10 border border-foreground/10 p-2 flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-primary" />
            <div className="flex-1">
              <div className="h-1.5 w-2/3 bg-foreground/60 rounded-full mb-1" />
              <div className="h-1 w-1/3 bg-foreground/30 rounded-full" />
            </div>
          </div>
        ))}
      </>
    );
  if (type === "finance")
    return (
      <>
        <div className="rounded-xl bg-foreground/10 border border-foreground/10 p-3">
          <div className="text-[9px] text-foreground/70">Balance</div>
          <div className="text-xl font-bold text-foreground">$12,480</div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-md bg-foreground/10 border border-foreground/10 p-1.5">
              <div className="h-1 w-full bg-foreground/40 rounded-full mb-1" />
              <div className="h-1 w-2/3 bg-foreground/20 rounded-full" />
            </div>
          ))}
        </div>
      </>
    );
  if (type === "shop")
    return (
      <div className="grid grid-cols-2 gap-1.5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-md bg-foreground/15 border border-foreground/10 aspect-square p-1 flex flex-col justify-end">
            <div className="h-1 w-3/4 bg-foreground/60 rounded-full mb-0.5" />
            <div className="h-0.5 w-1/2 bg-foreground/30 rounded-full" />
          </div>
        ))}
      </div>
    );
  if (type === "feed" || type === "chat")
    return (
      <>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg bg-foreground/10 border border-foreground/10 p-2 flex gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-primary shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="h-1 w-2/3 bg-foreground/60 rounded-full" />
              <div className="h-1 w-full bg-foreground/30 rounded-full" />
              <div className="h-1 w-1/2 bg-foreground/30 rounded-full" />
            </div>
          </div>
        ))}
      </>
    );
  // music
  return (
    <>
      <div className="rounded-xl bg-foreground/10 aspect-square border border-foreground/10" />
      <div className="space-y-1">
        <div className="h-1.5 w-3/4 bg-foreground/60 rounded-full" />
        <div className="h-1 w-1/2 bg-foreground/30 rounded-full" />
      </div>
      <div className="flex justify-around items-center mt-1">
        {[8, 14, 8].map((s, i) => (
          <div key={i} className="rounded-full bg-foreground/40" style={{ width: s, height: s }} />
        ))}
      </div>
    </>
  );
};

export const ShowcaseGallery = () => {
  // duplicate for seamless marquee
  const items = [...SHOWCASES, ...SHOWCASES];

  return (
    <section className="py-16 sm:py-24 relative overflow-hidden">
      <div className="container-page text-center mb-10 sm:mb-14">
        <m.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3"
        >
          Built with <span className="text-gradient">OneClick Studio</span>
        </m.h2>
        <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
          Real apps, shipped by founders, designers and indie hackers — in hours, not months.
        </p>
      </div>

      <div className="edge-fade overflow-hidden">
        <m.div
          className="flex w-max"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 45, ease: "linear", repeat: Infinity }}
        >
          {items.map((it, i) => (
            <PhoneMock key={`${it.name}-${i}`} item={it} />
          ))}
        </m.div>
      </div>
    </section>
  );
};
