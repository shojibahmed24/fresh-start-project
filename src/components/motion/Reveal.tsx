import { m, useReducedMotion as useFramerReduce } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Direction = "up" | "down" | "left" | "right" | "none";

interface RevealProps {
  children: ReactNode;
  /** Direction of slide before reveal. Default `up`. */
  direction?: Direction;
  /** Pixels of slide. Default 16. */
  distance?: number;
  /** Animation delay in seconds. */
  delay?: number;
  /** Animation duration in seconds. Default 0.55. */
  duration?: number;
  /** Replay every time it enters the viewport. Default false (one-shot). */
  once?: boolean;
  /** Viewport margin for IntersectionObserver. Default `-10% 0px`. */
  amount?: number | "some" | "all";
  className?: string;
  as?: "div" | "section" | "article" | "li" | "header" | "footer";
}

/**
 * Fade + slide a section into view as it enters the viewport.
 * Built on framer-motion's `whileInView` (IntersectionObserver under the hood).
 * Honors `prefers-reduced-motion` automatically.
 *
 *   <Reveal>...</Reveal>
 *   <Reveal direction="left" delay={0.1}>...</Reveal>
 */
export const Reveal = ({
  children,
  direction = "up",
  distance = 16,
  delay = 0,
  duration = 0.55,
  once = true,
  amount = 0.2,
  className,
  as = "div",
}: RevealProps) => {
  const reduce = useFramerReduce();
  const offset = reduce
    ? { x: 0, y: 0 }
    : direction === "up"   ? { y: distance,  x: 0 }
    : direction === "down" ? { y: -distance, x: 0 }
    : direction === "left" ? { x: distance,  y: 0 }
    : direction === "right"? { x: -distance, y: 0 }
    : { x: 0, y: 0 };

  const MotionTag = m[as] as typeof m.div;

  return (
    <MotionTag
      className={cn(className)}
      initial={{ opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, amount }}
      transition={{
        duration: reduce ? 0 : duration,
        ease: [0.22, 1, 0.36, 1],
        delay: reduce ? 0 : delay,
      }}
    >
      {children}
    </MotionTag>
  );
};

/**
 * Container that staggers the reveal of its <Reveal> / motion children.
 * Place direct motion children inside; each one's `transition.delay` will
 * cascade automatically.
 */
export const RevealGroup = ({
  children,
  stagger = 0.08,
  delay = 0,
  className,
}: {
  children: ReactNode;
  stagger?: number;
  delay?: number;
  className?: string;
}) => {
  const reduce = useFramerReduce();
  return (
    <m.div
      className={cn(className)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: reduce ? 0 : stagger,
            delayChildren: reduce ? 0 : delay,
          },
        },
      }}
    >
      {children}
    </m.div>
  );
};
