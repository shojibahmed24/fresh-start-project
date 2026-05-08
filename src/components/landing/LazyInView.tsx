import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * LazyInView — mounts heavy children only when their placeholder enters
 * the viewport. Combined with React.lazy() this defers both the JS chunk
 * download AND the render cost (framer-motion, large images, etc.) until
 * the user is about to see the section. Massive LCP/TBT win on landing.
 */
export const LazyInView = ({
  children,
  rootMargin = "300px",
  minHeight = 200,
  fallback = null,
}: {
  children: ReactNode;
  rootMargin?: string;
  minHeight?: number;
  fallback?: ReactNode;
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (show || !ref.current) return;
    if (typeof IntersectionObserver === "undefined") {
      setShow(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [show, rootMargin]);

  return (
    <div ref={ref} style={{ minHeight: show ? undefined : minHeight }}>
      {show ? <Suspense fallback={fallback}>{children}</Suspense> : fallback}
    </div>
  );
};
