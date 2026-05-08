/**
 * Lightweight haptic feedback helper for mobile.
 * Uses the Vibration API where available; gracefully no-ops on desktop / unsupported browsers.
 *
 * Patterns are intentionally subtle (≤ 25ms) to feel like native iOS/Android taps,
 * not jarring buzzes. Long-press uses a stronger double-pulse for confirmation.
 */

type HapticPattern = "light" | "medium" | "heavy" | "success" | "warning" | "selection";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 8,
  medium: 14,
  heavy: 22,
  selection: 5,
  success: [10, 40, 10],
  warning: [18, 60, 18],
};

let enabled = true;

export function setHapticsEnabled(on: boolean) {
  enabled = on;
}

export function haptic(pattern: HapticPattern = "light") {
  if (!enabled) return;
  if (typeof window === "undefined") return;
  // Respect users who prefer reduced motion — they likely also prefer no buzz.
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const nav = window.navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  if (typeof nav.vibrate !== "function") return;
  try {
    nav.vibrate(PATTERNS[pattern]);
  } catch {
    /* ignore */
  }
}
