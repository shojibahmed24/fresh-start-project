import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Spotlight that follows the cursor across a hero / featured section.
 * Wrap the section content; the spotlight renders behind it.
 *
 * <Spotlight>
 *   <Hero />
 * </Spotlight>
 */
export const Spotlight = ({
  children,
  className,
  size = 600,
  color = "190 95% 55%",
  intensity = 0.18,
}: {
  children: ReactNode;
  className?: string;
  size?: number;
  color?: string; // HSL triplet
  intensity?: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const lightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const light = lightRef.current;
    if (!el || !light) return;

    let raf = 0;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        light.style.background = `radial-gradient(${size}px circle at ${x}px ${y}px, hsl(${color} / ${intensity}), transparent 60%)`;
        light.style.opacity = "1";
      });
    };
    const onLeave = () => {
      light.style.opacity = "0";
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [size, color, intensity]);

  return (
    <div ref={ref} className={cn("relative overflow-hidden", className)}>
      <div
        ref={lightRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300"
      />
      <div className="relative">{children}</div>
    </div>
  );
};
