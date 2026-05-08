import { useRef, useState, ReactNode, MouseEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * Subtle 3D tilt + glare on hover. Disables on touch / reduced-motion.
 * Children render inside a perspective wrapper.
 */
export const TiltCard = ({
  children,
  className,
  glow = false,
  max = 8,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  max?: number;
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [t, setT] = useState({ rx: 0, ry: 0, mx: 50, my: 50, active: false });

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width; // 0..1
    const y = (e.clientY - r.top) / r.height;
    const ry = (x - 0.5) * 2 * max; // rotateY
    const rx = -(y - 0.5) * 2 * max; // rotateX
    setT({ rx, ry, mx: x * 100, my: y * 100, active: true });
  };

  const reset = () => setT({ rx: 0, ry: 0, mx: 50, my: 50, active: false });

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      className={cn("group relative [perspective:1000px] motion-reduce:[perspective:none]", className)}
    >
      <div
        className={cn(
          "relative h-full w-full transition-transform duration-200 ease-out will-change-transform",
          "motion-reduce:transition-none",
        )}
        style={{
          transform: `rotateX(${t.rx}deg) rotateY(${t.ry}deg) translateZ(0)`,
          transformStyle: "preserve-3d",
        }}
      >
        {children}
        {/* Glare overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-200 group-hover:opacity-100 motion-reduce:hidden"
          style={{
            background: `radial-gradient(circle at ${t.mx}% ${t.my}%, hsl(0 0% 100% / 0.10), transparent 45%)`,
          }}
        />
        {glow && (
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-px rounded-[inherit] opacity-60 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:hidden"
            style={{
              background:
                "conic-gradient(from 180deg at 50% 50%, hsl(var(--primary) / 0.45), hsl(280 90% 65% / 0.35), hsl(190 95% 55% / 0.45), hsl(var(--primary) / 0.45))",
              filter: "blur(14px)",
              zIndex: -1,
            }}
          />
        )}
      </div>
    </div>
  );
};
