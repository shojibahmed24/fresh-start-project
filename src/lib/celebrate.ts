// canvas-confetti is dynamically imported on first call so the library
// never enters the main bundle — only loaded when something celebrates.

type ConfettiOptions = Record<string, unknown>;
type Preset = "subtle" | "project" | "build" | "purchase" | "custom";

const REDUCE = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

const COLORS = ["#a855f7", "#22d3ee", "#f0abfc", "#7dd3fc", "#fef08a", "#ffffff"];

let confettiPromise: Promise<(opts: ConfettiOptions) => void> | null = null;
const loadConfetti = () => {
  if (!confettiPromise) {
    confettiPromise = import("canvas-confetti").then((m) => m.default as any);
  }
  return confettiPromise;
};

export async function celebrate(
  preset: Preset = "subtle",
  overrides: ConfettiOptions = {},
) {
  if (typeof window === "undefined" || REDUCE()) return;
  const confetti = await loadConfetti();

  const base: ConfettiOptions = {
    spread: 70,
    startVelocity: 38,
    ticks: 180,
    gravity: 0.95,
    scalar: 0.9,
    colors: COLORS,
    disableForReducedMotion: true,
    zIndex: 9999,
  };

  switch (preset) {
    case "subtle":
      confetti({ ...base, particleCount: 60, origin: { y: 0.85 }, ...overrides });
      return;
    case "project":
      confetti({ ...base, particleCount: 110, spread: 80, origin: { y: 0.75 }, ...overrides });
      return;
    case "purchase":
      confetti({ ...base, particleCount: 140, spread: 90, startVelocity: 45, origin: { y: 0.7 }, ...overrides });
      return;
    case "build": {
      const opts: ConfettiOptions = {
        ...base,
        particleCount: 90,
        spread: 60,
        startVelocity: 50,
        ticks: 220,
        ...overrides,
      };
      confetti({ ...opts, angle: 60, origin: { x: 0.05, y: 0.85 } });
      confetti({ ...opts, angle: 120, origin: { x: 0.95, y: 0.85 } });
      setTimeout(
        () => confetti({ ...base, particleCount: 70, origin: { y: 0.8 } }),
        220,
      );
      return;
    }
    default:
      confetti({ ...base, ...overrides });
  }
}
