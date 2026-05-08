import { m } from "framer-motion";
import { Plus, ArrowRight, Sparkles } from "lucide-react";

type Props = {
  onCreate: () => void;
};

/**
 * Custom empty-state illustration for the project list. Hand-crafted SVG
 * showing a stylised "blank canvas" with a glowing spark + an animated arrow
 * pointing at the primary CTA. No external assets required.
 */
export const EmptyProjectsState = ({ onCreate }: Props) => {
  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden glass rounded-3xl px-6 py-12 sm:py-16 text-center border border-border/60"
    >
      {/* Background glow orbs */}
      <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 right-10 h-32 w-32 rounded-full bg-cyan-500/15 blur-3xl" />

      {/* Illustration */}
      <div className="relative mx-auto mb-6 w-[180px] h-[140px]">
        <svg viewBox="0 0 200 160" className="w-full h-full" aria-hidden>
          <defs>
            <linearGradient id="ep-card" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="ep-stroke" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(190 95% 60%)" />
            </linearGradient>
          </defs>

          {/* Back card (tilted) */}
          <m.g
            initial={{ rotate: -6, y: 4 }}
            animate={{ rotate: [-6, -4, -6], y: [4, 2, 4] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "60px 70px" }}
          >
            <rect x="20" y="36" width="80" height="100" rx="10" fill="url(#ep-card)" stroke="hsl(var(--border))" strokeWidth="1" />
            <rect x="30" y="48" width="50" height="6" rx="3" fill="hsl(var(--muted-foreground) / 0.3)" />
            <rect x="30" y="60" width="40" height="4" rx="2" fill="hsl(var(--muted-foreground) / 0.2)" />
          </m.g>

          {/* Front card */}
          <m.g
            initial={{ rotate: 4, y: 0 }}
            animate={{ rotate: [4, 6, 4], y: [0, -2, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "140px 80px" }}
          >
            <rect x="100" y="20" width="80" height="120" rx="12" fill="hsl(var(--card))" stroke="url(#ep-stroke)" strokeWidth="1.5" />
            <rect x="112" y="34" width="48" height="6" rx="3" fill="hsl(var(--primary) / 0.6)" />
            <rect x="112" y="46" width="56" height="4" rx="2" fill="hsl(var(--muted-foreground) / 0.3)" />
            <rect x="112" y="56" width="38" height="4" rx="2" fill="hsl(var(--muted-foreground) / 0.2)" />
            <rect x="112" y="78" width="56" height="40" rx="6" fill="hsl(var(--primary) / 0.12)" />
          </m.g>

          {/* Sparkle */}
          <m.g
            animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ transformOrigin: "160px 22px" }}
          >
            <path d="M160 12 L162 20 L170 22 L162 24 L160 32 L158 24 L150 22 L158 20 Z" fill="hsl(var(--primary))" />
          </m.g>
        </svg>
      </div>

      <h2 className="relative text-xl sm:text-2xl font-bold mb-2 inline-flex items-center gap-2">
        <Sparkles size={18} className="text-primary" />
        Build your first app
      </h2>
      <p className="relative text-sm text-muted-foreground mb-6 max-w-md mx-auto">
        Start from scratch or open the <span className="font-semibold text-foreground">Templates</span> menu in the header. Our AI will turn your idea into a working mobile app in minutes.
      </p>

      <div className="relative inline-flex items-center gap-3">
        <m.div
          animate={{ x: [-4, 0, -4] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="text-primary"
          aria-hidden
        >
          <ArrowRight size={20} />
        </m.div>
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:opacity-95 active:scale-95 transition"
        >
          <Plus size={18} />
          Create project
        </button>
      </div>
    </m.div>
  );
};
