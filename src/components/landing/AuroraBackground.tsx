import { m } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Aurora — animated radial gradient mesh that drifts behind the hero.
 * Uses 3 large blurred orbs in brand colors. Skips animation when the
 * user has reduced-motion enabled (prevents jank on low-end devices).
 */
export const AuroraBackground = () => {
  const reduce = useReducedMotion();

  const orbs = [
    {
      className: "left-[-10%] top-[-10%] h-[60vh] w-[60vh]",
      bg: "radial-gradient(circle at center, hsl(var(--primary) / 0.45), transparent 60%)",
      anim: { x: [0, 60, -20, 0], y: [0, 40, -30, 0] },
      duration: 24,
    },
    {
      className: "right-[-15%] top-[10%] h-[55vh] w-[55vh]",
      bg: "radial-gradient(circle at center, hsl(var(--accent-cyan) / 0.40), transparent 60%)",
      anim: { x: [0, -50, 30, 0], y: [0, 60, -20, 0] },
      duration: 28,
    },
    {
      className: "left-[30%] bottom-[-20%] h-[50vh] w-[50vh]",
      bg: "radial-gradient(circle at center, hsl(280 95% 70% / 0.35), transparent 60%)",
      anim: { x: [0, -30, 50, 0], y: [0, -40, 20, 0] },
      duration: 32,
    },
  ];

  return (
    <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none [.light_&]:opacity-50" aria-hidden>
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)/0.06) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)/0.06) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
      {orbs.map((o, i) =>
        reduce ? (
          <div
            key={i}
            className={`absolute rounded-full blur-3xl ${o.className}`}
            style={{ background: o.bg }}
          />
        ) : (
          <m.div
            key={i}
            className={`absolute rounded-full blur-3xl ${o.className}`}
            style={{ background: o.bg }}
            animate={o.anim}
            transition={{ duration: o.duration, repeat: Infinity, ease: "easeInOut" }}
          />
        )
      )}
      {/* Bottom fade so the hero blends into the next section */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
};
