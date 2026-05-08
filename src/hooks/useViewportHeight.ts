import { useEffect } from "react";

/**
 * Mobile-aware viewport height manager.
 *
 * Sets a CSS variable `--app-height` on <html> equal to the *visible* viewport height
 * (i.e. real screen height MINUS the on-screen keyboard, browser chrome, etc.).
 * Also exposes `--keyboard-inset` so we can pad bottom-fixed bars (chat input,
 * tab bar) above the keyboard.
 *
 * Why: iOS Safari's `100vh` does not shrink when the keyboard opens, so any
 * full-screen layout (`h-screen`) ends up with its bottom hidden behind the
 * keyboard. Using `visualViewport` gives us the true usable area.
 *
 * Mount once near the app root.
 */
export function useViewportHeight() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    const vv = window.visualViewport;

    const update = () => {
      // Visible height (includes notch handling via visualViewport when present).
      const visible = vv ? vv.height : window.innerHeight;
      const layout = window.innerHeight;
      // Keyboard inset = how much the layout viewport is taller than the visible viewport.
      // ≈ keyboard height. Clamp negative noise to 0.
      const keyboard = Math.max(0, layout - visible);
      root.style.setProperty("--app-height", `${visible}px`);
      root.style.setProperty("--keyboard-inset", `${keyboard}px`);
      root.classList.toggle("keyboard-open", keyboard > 80);
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
    }
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      if (vv) {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      }
    };
  }, []);
}
