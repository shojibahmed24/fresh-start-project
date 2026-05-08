// ─────────────────────────────────────────────────────────────────────
// Phase 3: Curated Premium Component Library — barrel
//
// The actual snippet definitions live in `./snippets/` split by family:
//   - shared.ts      Generic patterns (hero, section header, bottom nav…)
//   - domain.ts      Domain-specific (podcast, banking, fitness, …)
//   - koko.ts        KokonutUI-inspired premium blocks
//   - aceternity.ts  Aceternity-style hero / wow-effect snippets
//   - magic.ts       Magic UI animated micro-effects
//   - registry.ts    Domain → snippets mapping + render/lookup helpers
//
// Public API kept stable for existing importers.
// ─────────────────────────────────────────────────────────────────────

export type { Snippet } from "./snippets/types.ts";
export {
  renderDomainSnippets,
  renderDomainSnippetIndex,
  getSnippetByName,
  listSnippetNamesForDomain,
} from "./snippets/registry.ts";
