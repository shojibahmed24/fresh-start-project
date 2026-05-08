import { m } from "framer-motion";
import logoMark from "@/assets/oneclick-mark.webp";
import logoWordmark from "@/assets/oneclick-wordmark.webp";

/**
 * OneClick Studio brand mark.
 * - `variant="mark"` (default): just the circular OS coin mark + text.
 * - `variant="wordmark"`: the full pre-rendered wordmark lockup (phone + OneClick Studio).
 */
export const Logo = ({
  size = "md",
  variant = "mark",
}: {
  size?: "sm" | "md" | "lg";
  variant?: "mark" | "wordmark";
}) => {
  const sizes = {
    sm: { box: 28, text: "text-base", wordmarkH: 28 },
    md: { box: 36, text: "text-xl", wordmarkH: 36 },
    lg: { box: 48, text: "text-3xl", wordmarkH: 56 },
  };
  const s = sizes[size];

  if (variant === "wordmark") {
    return (
      <m.img
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        src={logoWordmark}
        alt="OneClick Studio — No-code mobile app builder"
        height={s.wordmarkH}
        style={{ height: s.wordmarkH, width: "auto" }}
        className="select-none drop-shadow-[0_2px_10px_hsl(var(--primary)/0.25)]"
      />
    );
  }

  return (
    <m.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex items-center gap-2.5 select-none"
    >
      <div className="relative shrink-0" style={{ width: s.box, height: s.box }}>
        <m.span
          aria-hidden
          className="absolute inset-0 rounded-full bg-gradient-primary blur-md opacity-60"
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <img
          src={logoMark}
          alt="OneClick Studio"
          width={s.box}
          height={s.box}
          className="relative rounded-full object-contain drop-shadow-[0_2px_8px_hsl(var(--primary)/0.35)]"
        />
      </div>
      <span className={`${s.text} font-bold tracking-tight leading-none`}>
        <span className="text-gradient">OneClick</span>
        <span className="text-foreground/90"> Studio</span>
      </span>
    </m.div>
  );
};
