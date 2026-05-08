import { useEffect, useState } from "react";

/**
 * Detects whether the current device/user prefers reduced motion.
 * - Honors the OS-level `prefers-reduced-motion: reduce` media query.
 * - Heuristically downgrades for low-end devices (≤4 logical CPU cores or
 *   `navigator.connection.saveData === true`) so we don't burn battery on
 *   cheap Android phones / data-saver mode.
 *
 * Use this to conditionally skip animations or shorten durations.
 *
 *   const reduce = useReducedMotion();
 *   <motion.div animate={reduce ? {} : { y: 0 }} />
 */
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState<boolean>(() => detect());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduce(detect());
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  return reduce;
}

function detect(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return true;
  const nav = window.navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  // Save-Data header on by user → respect bandwidth.
  if (nav.connection?.saveData) return true;
  // Slow network (2g/slow-2g/3g) → less motion to keep UI snappy.
  if (nav.connection?.effectiveType && /^(slow-)?2g$|^3g$/.test(nav.connection.effectiveType)) return true;
  // Very low core count or low memory → likely entry-level Android.
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency > 0 && nav.hardwareConcurrency <= 4) {
    if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 2) return true;
  }
  return false;
}
