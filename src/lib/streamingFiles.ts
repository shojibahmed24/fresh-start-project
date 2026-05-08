// ═══════════════════════════════════════════════════════════════════════════
// Streaming Files Registry — frontend-only "typewriter" illusion
// ───────────────────────────────────────────────────────────────────────────
// The backend writes files atomically (bulk_write_files / write_file). To
// deliver a Lovable/v0-grade UX without the cost & fragility of real
// chunk-by-chunk DB writes, we replay the final content character-by-character
// in the UI as soon as the file_changed event lands.
//
// A lightweight pub/sub keeps any number of <FileDiffCard /> instances in
// sync without prop-drilling through useBuilderAgent.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";

export type StreamingState = {
  /** Full final content the typewriter is animating toward. */
  full: string;
  /** Number of chars already revealed. */
  revealed: number;
  /** True once revealed === full.length. */
  done: boolean;
  /** Animation start time (used to compute speed). */
  startedAt: number;
  /** True if user clicked "skip" — fast-forward to done. */
  skipped: boolean;
};

type Listener = () => void;

// path → state
const registry = new Map<string, StreamingState>();
// path → Set of listeners
const listeners = new Map<string, Set<Listener>>();
// global listeners (fire on ANY change)
const globalListeners = new Set<Listener>();
// path → animation frame handle
const rafHandles = new Map<string, number>();

const notify = (path: string) => {
  listeners.get(path)?.forEach((l) => l());
  globalListeners.forEach((l) => l());
};

// Tunable: characters revealed per second.
// Small files feel snappy, big files don't take forever.
const baseCps = 1400;

const computeStepSize = (full: number) => {
  // Bigger files reveal more chars per frame so total time stays reasonable.
  if (full < 800) return 2;        // small components → ~smooth typing
  if (full < 3000) return 6;       // medium files
  if (full < 8000) return 18;      // large files
  return 48;                        // huge files → fast-forward feel
};

const tick = (path: string) => {
  const s = registry.get(path);
  if (!s) return;
  if (s.done || s.skipped) {
    if (s.skipped && !s.done) {
      registry.set(path, { ...s, revealed: s.full.length, done: true });
      notify(path);
    }
    rafHandles.delete(path);
    return;
  }
  const step = computeStepSize(s.full.length);
  const next = Math.min(s.full.length, s.revealed + step);
  const done = next >= s.full.length;
  registry.set(path, { ...s, revealed: next, done });
  notify(path);
  if (done) {
    rafHandles.delete(path);
    return;
  }
  // Aim for ~baseCps regardless of step size.
  const delayMs = Math.max(8, (step / baseCps) * 1000);
  const handle = window.setTimeout(() => {
    requestAnimationFrame(() => tick(path));
  }, delayMs);
  rafHandles.set(path, handle as unknown as number);
};

/**
 * Begin streaming a file. If the file is already being streamed, this
 * replaces the target content (e.g. heal pass rewrites the same file).
 */
export const startStreaming = (path: string, content: string) => {
  // Cancel any previous animation for this path.
  const prev = rafHandles.get(path);
  if (prev !== undefined) {
    clearTimeout(prev);
    rafHandles.delete(path);
  }
  registry.set(path, {
    full: content,
    revealed: 0,
    done: content.length === 0,
    startedAt: Date.now(),
    skipped: false,
  });
  notify(path);
  if (content.length > 0) {
    requestAnimationFrame(() => tick(path));
  }
};

/** User clicked "Show all" — fast-forward animation to completion. */
export const skipStreaming = (path: string) => {
  const s = registry.get(path);
  if (!s || s.done) return;
  registry.set(path, { ...s, revealed: s.full.length, done: true, skipped: true });
  const h = rafHandles.get(path);
  if (h !== undefined) {
    clearTimeout(h);
    rafHandles.delete(path);
  }
  notify(path);
};

/** Drop a path from the registry once the UI no longer needs it. */
export const clearStreaming = (path: string) => {
  const h = rafHandles.get(path);
  if (h !== undefined) {
    clearTimeout(h);
    rafHandles.delete(path);
  }
  registry.delete(path);
  notify(path);
};

export const getStreaming = (path: string): StreamingState | undefined =>
  registry.get(path);

/** Subscribe to one path. Returns unsubscribe. */
export const subscribeStreaming = (path: string, fn: Listener) => {
  let set = listeners.get(path);
  if (!set) {
    set = new Set();
    listeners.set(path, set);
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) listeners.delete(path);
  };
};

/** React hook for a single file's streaming state. */
export const useStreamingFile = (path: string | undefined): StreamingState | undefined => {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    return subscribeStreaming(path, () => setTick((n) => n + 1));
  }, [path]);
  if (!path) return undefined;
  return registry.get(path);
};
