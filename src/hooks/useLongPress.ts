import { useCallback, useRef } from "react";
import { haptic } from "@/lib/haptics";

type Options = {
  /** ms before long-press fires. Default 500ms (iOS-like). */
  delay?: number;
  /** px of finger movement allowed before cancelling. Default 10. */
  moveTolerance?: number;
  /** trigger haptic feedback on fire. Default true. */
  hapticFeedback?: boolean;
};

/**
 * Touch-friendly long-press hook. Returns props you spread on the target element.
 * Cancels on move beyond tolerance, scroll, or pointer up before delay.
 *
 * Usage:
 *   const longPress = useLongPress(() => openMenu());
 *   <div {...longPress}>...</div>
 */
export function useLongPress(onLongPress: () => void, options: Options = {}) {
  const { delay = 500, moveTolerance = 10, hapticFeedback = true } = options;
  const timerRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
  }, []);

  const start = useCallback(
    (e: React.PointerEvent) => {
      // Only react to primary touch / mouse — ignore right-click etc.
      if (e.pointerType === "mouse" && e.button !== 0) return;
      firedRef.current = false;
      startPosRef.current = { x: e.clientX, y: e.clientY };
      timerRef.current = window.setTimeout(() => {
        firedRef.current = true;
        if (hapticFeedback) haptic("medium");
        onLongPress();
      }, delay);
    },
    [delay, hapticFeedback, onLongPress],
  );

  const move = useCallback(
    (e: React.PointerEvent) => {
      if (!startPosRef.current) return;
      const dx = Math.abs(e.clientX - startPosRef.current.x);
      const dy = Math.abs(e.clientY - startPosRef.current.y);
      if (dx > moveTolerance || dy > moveTolerance) clear();
    },
    [clear, moveTolerance],
  );

  return {
    onPointerDown: start,
    onPointerMove: move,
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    /** Read after a click handler to know if long-press already fired (suppress click). */
    didFireRef: firedRef,
  };
}
