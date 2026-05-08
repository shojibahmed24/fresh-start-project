// ─────────────────────────────────────────────────────────────────────
// Phase 3: Curated Premium Component Library — shared types
// ─────────────────────────────────────────────────────────────────────

export interface Snippet {
  name: string;        // human label, e.g. "Sticky mini-player with scrub bar"
  why: string;         // one line: why this matters for the domain
  code: string;        // self-contained JSX (no imports — listed in `uses`)
  uses?: string[];     // npm deps + lucide icons used
}
