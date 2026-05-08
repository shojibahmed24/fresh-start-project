// Module-level pub-sub for the auto-heal pipeline state.
//
// Why: useBuilderHeal lives in Builder.tsx, but the visual feedback (the
// HealBadge inside individual chat messages) needs to know "what attempt
// are we on, did it succeed, did we give up?" without prop drilling
// through ChatPanel → ChatMessage. Each HealBadge subscribes by
// `detailKey` (a stable hash of the original error) and gets live status
// updates as the heal progresses.

export type HealStatus =
  | "fixing"      // attempt in progress
  | "healed"      // Claude or AI fix applied successfully
  | "stopped"     // gave up (max attempts / repeated identical error)
  | "manual";     // could not pinpoint, asked user to fix manually

export type HealState = {
  status: HealStatus;
  attempt: number;        // 1-based, current/last attempt number
  maxAttempts: number;    // configured cap
  filePath: string | null;
  reason?: string;        // human-readable note (e.g. "Same error repeated")
};

type Listener = (state: HealState) => void;

const states = new Map<string, HealState>();
const listeners = new Map<string, Set<Listener>>();

export function publishHealState(detailKey: string, state: HealState) {
  states.set(detailKey, state);
  const set = listeners.get(detailKey);
  if (set) for (const l of set) l(state);
}

export function getHealState(detailKey: string): HealState | undefined {
  return states.get(detailKey);
}

export function subscribeHealState(detailKey: string, listener: Listener): () => void {
  let set = listeners.get(detailKey);
  if (!set) {
    set = new Set();
    listeners.set(detailKey, set);
  }
  set.add(listener);
  // Fire current state immediately if known.
  const current = states.get(detailKey);
  if (current) listener(current);
  return () => {
    const s = listeners.get(detailKey);
    if (!s) return;
    s.delete(listener);
    if (s.size === 0) listeners.delete(detailKey);
  };
}

// Stable hash of an error so HealBadge (which only sees the prompt content)
// and useBuilderHeal (which sees the raw event) agree on the same key.
export function makeHealKey(errorMessage: string, filePath: string | null): string {
  const m = (errorMessage || "").trim().slice(0, 200);
  const f = (filePath || "").trim();
  return `${m}::${f}`;
}
