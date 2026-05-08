import type { Snippet } from "./types.ts";
import * as Shared from "./shared.ts";
import * as Domain from "./domain.ts";
import * as Koko from "./koko.ts";
import * as Ace from "./aceternity.ts";
import * as Magic from "./magic.ts";
import { BACKEND_SNIPPETS } from "./backend.ts";
import { EDGE_CASE_SNIPPETS } from "./patterns.ts";

// Re-export shared array for fallback use
const { SHARED, HERO_GRADIENT, STAT_PILL, SECTION_HEADER, BOTTOM_NAV } = Shared;
const { PODCAST_PLAYER, PODCAST_SHOWCARD, ECOM_PRODUCT_CARD, FITNESS_RING, BANKING_BALANCE, BANKING_TX, FOOD_DISH_CARD, CHAT_BUBBLE, SOCIAL_FEED_POST, TRAVEL_DESTINATION, NEWS_HEADLINE, CRYPTO_TICKER, TODO_TASK, WEATHER_HERO, KANBAN_COLUMN, DATING_SWIPE, AICHAT_MESSAGE, MEDITATION_SESSION, PORTFOLIO_PROJECT, EVENTS_TICKET, NOTES_CARD, VIDEO_THUMB } = Domain;
const { KOKO_PRICING_CARD, KOKO_ACTION_LIST, KOKO_ANIMATED_NUMBER_CARD, KOKO_PROFILE_HEADER, KOKO_FILE_UPLOAD, KOKO_NOTIFICATION, KOKO_ONBOARDING_STEP, KOKO_SEARCH_BAR, KOKO_TIMELINE, KOKO_OTP_INPUT, KOKO_TOAST, KOKO_BOTTOM_SHEET, KOKO_EMPTY_STATE, KOKO_SEGMENTED_CONTROL, KOKO_LEADERBOARD, KOKO_BADGE_GRID, KOKO_INVOICE_LINE, KOKO_CART_ROW, KOKO_CHECKOUT_BAR, KOKO_REVIEW_CARD, KOKO_FAQ_ACCORDION, KOKO_INTEGRATION_CARD, KOKO_GAME_HUD, KOKO_DOC_CARD, KOKO_HABIT_HEATMAP, KOKO_RIDE_DRIVER_CARD, KOKO_PASSWORD_ENTRY, KOKO_QUIZ_CARD } = Koko;
const { ACE_AURORA_HERO, ACE_GLOW_CTA, ACE_SPOTLIGHT_CARD, ACE_BENTO_GRID, ACE_PARALLAX_PHONE, ACE_FEATURE_LIST, ACE_TESTIMONIAL_GLOW, ACE_INFINITE_LOGOS } = Ace;
const { MAGIC_NUMBER_TICKER, MAGIC_GRADIENT_TEXT, MAGIC_MARQUEE, MAGIC_PARTICLES_BG, MAGIC_SHIMMER_BUTTON, MAGIC_BLUR_FADE, MAGIC_ANIMATED_BEAM, MAGIC_DOCK } = Magic;

// ─── Domain → snippets mapping ──────────────────────────────────────────
// Domains not listed here fall through to SHARED only.
const DOMAIN_SNIPPETS: Record<string, Snippet[]> = {
  // Media
  podcast:      [PODCAST_PLAYER, PODCAST_SHOWCARD, SECTION_HEADER, KOKO_SEARCH_BAR],
  music:        [PODCAST_PLAYER, PODCAST_SHOWCARD, SECTION_HEADER, KOKO_SEARCH_BAR],
  video:        [VIDEO_THUMB, SECTION_HEADER, KOKO_SEARCH_BAR],
  shortvideo:   [VIDEO_THUMB, SOCIAL_FEED_POST, KOKO_BOTTOM_SHEET],

  // Commerce
  ecommerce:    [ECOM_PRODUCT_CARD, KOKO_CART_ROW, KOKO_CHECKOUT_BAR, KOKO_SEARCH_BAR, KOKO_REVIEW_CARD],
  marketplace:  [ECOM_PRODUCT_CARD, KOKO_SEARCH_BAR, KOKO_CART_ROW, BOTTOM_NAV],
  "food-delivery":  [FOOD_DISH_CARD, KOKO_CART_ROW, KOKO_CHECKOUT_BAR, KOKO_SEARCH_BAR, BOTTOM_NAV],
  "restaurant-menu": [FOOD_DISH_CARD, SECTION_HEADER, KOKO_SEGMENTED_CONTROL],
  recipe:       [FOOD_DISH_CARD, SECTION_HEADER, KOKO_SEARCH_BAR],

  // Health & wellness
  fitness:      [FITNESS_RING, KOKO_ANIMATED_NUMBER_CARD, KOKO_LEADERBOARD, KOKO_BADGE_GRID, BOTTOM_NAV],
  running:      [FITNESS_RING, KOKO_ANIMATED_NUMBER_CARD, KOKO_LEADERBOARD],
  meditation:   [MEDITATION_SESSION, SECTION_HEADER, KOKO_HABIT_HEATMAP],
  sleep:        [MEDITATION_SESSION, KOKO_ANIMATED_NUMBER_CARD, KOKO_HABIT_HEATMAP],
  habit:        [TODO_TASK, KOKO_HABIT_HEATMAP, FITNESS_RING, KOKO_BADGE_GRID],

  // Productivity
  todo:         [TODO_TASK, SECTION_HEADER, KOKO_SEGMENTED_CONTROL, KOKO_EMPTY_STATE],
  notes:        [NOTES_CARD, SECTION_HEADER, KOKO_SEARCH_BAR],
  kanban:       [KANBAN_COLUMN, TODO_TASK, KOKO_SEGMENTED_CONTROL],
  calendar:     [EVENTS_TICKET, SECTION_HEADER, KOKO_SEGMENTED_CONTROL],

  // Social & communication
  "social-feed": [SOCIAL_FEED_POST, KOKO_NOTIFICATION, KOKO_PROFILE_HEADER, BOTTOM_NAV],
  chat:         [CHAT_BUBBLE, KOKO_NOTIFICATION, BOTTOM_NAV],
  dating:       [DATING_SWIPE, KOKO_PROFILE_HEADER, BOTTOM_NAV],
  community:    [SOCIAL_FEED_POST, KOKO_PROFILE_HEADER, KOKO_LEADERBOARD],

  // Finance
  banking:      [BANKING_BALANCE, BANKING_TX, KOKO_ANIMATED_NUMBER_CARD, KOKO_TIMELINE],
  crypto:       [CRYPTO_TICKER, BANKING_BALANCE, KOKO_ANIMATED_NUMBER_CARD],
  expenses:     [BANKING_TX, KOKO_ANIMATED_NUMBER_CARD, SECTION_HEADER, KOKO_SEGMENTED_CONTROL],
  invoice:      [KOKO_INVOICE_LINE, BANKING_TX, KOKO_ANIMATED_NUMBER_CARD],

  // News & content
  news:         [NEWS_HEADLINE, SECTION_HEADER, KOKO_SEGMENTED_CONTROL],
  blog:         [NEWS_HEADLINE, SECTION_HEADER, KOKO_FAQ_ACCORDION],

  // Lifestyle
  weather:      [WEATHER_HERO, KOKO_ANIMATED_NUMBER_CARD],
  travel:       [TRAVEL_DESTINATION, SECTION_HEADER, KOKO_SEARCH_BAR],
  flights:      [TRAVEL_DESTINATION, SECTION_HEADER, KOKO_SEARCH_BAR],
  hotel:        [TRAVEL_DESTINATION, KOKO_REVIEW_CARD, KOKO_SEARCH_BAR],
  rideshare:    [KOKO_RIDE_DRIVER_CARD, HERO_GRADIENT, BOTTOM_NAV],

  // Learning
  courses:      [VIDEO_THUMB, SECTION_HEADER, KOKO_BADGE_GRID, KOKO_LEADERBOARD],
  language:     [TODO_TASK, KOKO_BADGE_GRID, KOKO_LEADERBOARD, FITNESS_RING],
  quiz:         [KOKO_QUIZ_CARD, KOKO_LEADERBOARD, KOKO_BADGE_GRID],

  // Tools & utilities
  // "ai-chat" defined below with Aceternity/Magic additions
  password:     [KOKO_PASSWORD_ENTRY, KOKO_OTP_INPUT, KOKO_SEARCH_BAR],
  realestate:   [TRAVEL_DESTINATION, KOKO_REVIEW_CARD, KOKO_SEARCH_BAR],
  jobs:         [EVENTS_TICKET, SECTION_HEADER, KOKO_SEARCH_BAR],
  events:       [EVENTS_TICKET, SECTION_HEADER, KOKO_SEARCH_BAR, BOTTOM_NAV],

  // Creator / portfolio
  portfolio:    [ACE_AURORA_HERO, ACE_BENTO_GRID, PORTFOLIO_PROJECT, ACE_SPOTLIGHT_CARD, KOKO_PROFILE_HEADER, MAGIC_GRADIENT_TEXT, MAGIC_DOCK],
  linkinbio:    [ACE_AURORA_HERO, KOKO_PROFILE_HEADER, ACE_GLOW_CTA, MAGIC_SHIMMER_BUTTON, PORTFOLIO_PROJECT],
  fundraising:  [ACE_AURORA_HERO, MAGIC_NUMBER_TICKER, KOKO_ANIMATED_NUMBER_CARD, KOKO_TIMELINE, ACE_TESTIMONIAL_GLOW],
  photo:        [PORTFOLIO_PROJECT, SECTION_HEADER, KOKO_PROFILE_HEADER],

  // Generic / cross-cutting (KOKO + ACE + MAGIC mix)
  saas:         [ACE_AURORA_HERO, ACE_BENTO_GRID, ACE_FEATURE_LIST, KOKO_PRICING_CARD, KOKO_FAQ_ACCORDION, MAGIC_NUMBER_TICKER, ACE_INFINITE_LOGOS],
  subscription: [KOKO_PRICING_CARD, KOKO_FAQ_ACCORDION, ACE_FEATURE_LIST],
  dashboard:    [KOKO_ANIMATED_NUMBER_CARD, BANKING_TX, KOKO_TIMELINE, KOKO_SEGMENTED_CONTROL, MAGIC_NUMBER_TICKER],
  settings:     [KOKO_ACTION_LIST, KOKO_INTEGRATION_CARD, KOKO_PROFILE_HEADER],
  profile:      [KOKO_PROFILE_HEADER, KOKO_ACTION_LIST, KOKO_BADGE_GRID],
  onboarding:   [KOKO_ONBOARDING_STEP, KOKO_OTP_INPUT, ACE_GLOW_CTA, MAGIC_BLUR_FADE],
  auth:         [KOKO_OTP_INPUT, KOKO_TOAST, ACE_GLOW_CTA],
  storage:      [KOKO_DOC_CARD, KOKO_FILE_UPLOAD, KOKO_SEARCH_BAR],
  files:        [KOKO_DOC_CARD, KOKO_FILE_UPLOAD, KOKO_SEARCH_BAR],
  game:         [KOKO_GAME_HUD, KOKO_LEADERBOARD, KOKO_BADGE_GRID, MAGIC_NUMBER_TICKER],
  gaming:       [KOKO_GAME_HUD, KOKO_LEADERBOARD, KOKO_BADGE_GRID, MAGIC_NUMBER_TICKER],

  // ── Aceternity / Magic UI driven (landing & marketing surfaces) ──
  landing:      [ACE_AURORA_HERO, ACE_BENTO_GRID, ACE_SPOTLIGHT_CARD, ACE_TESTIMONIAL_GLOW, ACE_INFINITE_LOGOS, MAGIC_GRADIENT_TEXT, MAGIC_NUMBER_TICKER, ACE_GLOW_CTA],
  marketing:    [ACE_AURORA_HERO, ACE_FEATURE_LIST, ACE_TESTIMONIAL_GLOW, ACE_INFINITE_LOGOS, MAGIC_MARQUEE, MAGIC_SHIMMER_BUTTON],
  startup:      [ACE_AURORA_HERO, ACE_BENTO_GRID, ACE_PARALLAX_PHONE, MAGIC_ANIMATED_BEAM, MAGIC_NUMBER_TICKER, MAGIC_GRADIENT_TEXT],
  agency:       [ACE_AURORA_HERO, ACE_BENTO_GRID, ACE_TESTIMONIAL_GLOW, MAGIC_MARQUEE, ACE_GLOW_CTA],
  app:          [ACE_PARALLAX_PHONE, ACE_FEATURE_LIST, ACE_AURORA_HERO, MAGIC_DOCK, MAGIC_BLUR_FADE],
  ai:           [ACE_AURORA_HERO, MAGIC_PARTICLES_BG, MAGIC_ANIMATED_BEAM, MAGIC_GRADIENT_TEXT, ACE_BENTO_GRID, MAGIC_SHIMMER_BUTTON],
  "ai-chat":    [AICHAT_MESSAGE, KOKO_EMPTY_STATE, MAGIC_PARTICLES_BG, MAGIC_GRADIENT_TEXT],
};

/**
 * Render snippets for a matched domain as a markdown block to append to the
 * domain hint. Returns "" if the domain isn't in our library (the agent will
 * still get the domain DNA + signature elements from renderDomainHint).
 */
// ─── Module-scope memoization caches ────────────────────────────────────
// Edge function workers stay warm for several minutes between invocations.
// These caches turn repeat snippet lookups (called on every iter-0 request)
// into O(1) string reads instead of re-rendering markdown blocks each time.
const _renderFullCache = new Map<string, string>();
const _renderIndexCache = new Map<string, string>();
const _snippetByNameCache = new Map<string, Snippet>();
const _domainNamesCache = new Map<string, string[]>();
let _snippetIndexBuilt = false;

function _buildSnippetIndex(): void {
  if (_snippetIndexBuilt) return;
  const seen = new Set<Snippet>();
  for (const list of Object.values(DOMAIN_SNIPPETS)) {
    for (const s of list) seen.add(s);
  }
  for (const s of SHARED) seen.add(s);
  for (const s of BACKEND_SNIPPETS) seen.add(s);
  for (const s of EDGE_CASE_SNIPPETS) seen.add(s);
  for (const s of seen) _snippetByNameCache.set(s.name, s);
  _snippetIndexBuilt = true;
}

export function renderDomainSnippets(domainId: string): string {
  const cached = _renderFullCache.get(domainId);
  if (cached !== undefined) return cached;
  const list = DOMAIN_SNIPPETS[domainId] ?? SHARED.slice(0, 3);
  if (list.length === 0) {
    _renderFullCache.set(domainId, "");
    return "";
  }

  const blocks = list.map((s, i) => {
    const usesLine = s.uses?.length ? `\n_Uses: ${s.uses.join(", ")}_` : "";
    return `### Reference ${i + 1}: ${s.name}
**Why:** ${s.why}${usesLine}

\`\`\`tsx
${s.code}
\`\`\``;
  });

  const out = [
    ``,
    `---`,
    ``,
    `## Premium component references (curated, ${list.length} snippets)`,
    ``,
    `These are PRODUCTION-QUALITY reference patterns for this domain. **Adapt them — don't copy verbatim.** Rename identifiers, swap colors to match your chosen palette, and integrate with your project structure. The goal is to absorb the visual sophistication (real shadows, gradients, hierarchy, spacing) — not to ship duplicate code.`,
    ``,
    `Required imports for the patterns below (add as needed):`,
    `\`\`\`ts`,
    `import { motion } from "framer-motion";`,
    `import { /* lucide icons listed per snippet */ } from "lucide-react";`,
    `\`\`\``,
    ``,
    ...blocks,
    ``,
    `**How to use these references:**`,
    `1. Identify which snippet maps to a "must-have element" from the domain hint above.`,
    `2. Create your own component file (rename it to match your brief — e.g. ShowCard → EpisodeCard).`,
    `3. Adapt the styling to your palette + theme tokens (use semantic tokens from index.css, not raw colors).`,
    `4. Wire it to real props from your data layer.`,
    `5. NEVER ship a screen that's just "<div>{title}</div>" when one of these patterns fits — the user will notice.`,
  ].join("\n");
  _renderFullCache.set(domainId, out);
  return out;
}

/**
 * Lazy-load variant: render ONLY snippet names + why + uses for the matched
 * domain. The full code is fetched on demand via the `get_snippet` tool.
 * Cuts iter-0 system prompt by ~10-25K tokens vs renderDomainSnippets().
 */
export function renderDomainSnippetIndex(domainId: string): string {
  const cached = _renderIndexCache.get(domainId);
  if (cached !== undefined) return cached;
  const list = DOMAIN_SNIPPETS[domainId] ?? SHARED.slice(0, 3);
  if (list.length === 0) {
    _renderIndexCache.set(domainId, "");
    return "";
  }

  const rows = list.map((s, i) => {
    const usesLine = s.uses?.length ? ` _(uses: ${s.uses.join(", ")})_` : "";
    return `${i + 1}. **${s.name}** — ${s.why}${usesLine}`;
  });

  const out = [
    ``,
    `---`,
    ``,
    `## Premium component references available (${list.length} snippets)`,
    ``,
    `Production-quality reference patterns curated for this domain. The full code is NOT inlined to save tokens — call the \`get_snippet\` tool with the exact name to fetch any snippet's TSX when you're ready to adapt it.`,
    ``,
    ...rows,
    ``,
    `**Workflow:**`,
    `1. Pick the snippet(s) that map to a "must-have element" from the domain hint above.`,
    `2. Call \`get_snippet({ name: "<exact name>" })\` — returns the TSX + required imports.`,
    `3. Adapt: rename identifiers, swap colors to your palette, wire to real props. Never copy verbatim.`,
    `4. NEVER ship a screen that's just "<div>{title}</div>" when one of these patterns fits.`,
  ].join("\n");
  _renderIndexCache.set(domainId, out);
  return out;
}

/**
 * Look up a snippet by exact name across ALL snippets (domain + shared).
 * Backed by an O(1) name→Snippet map built once per worker.
 */
export function getSnippetByName(name: string): Snippet | null {
  _buildSnippetIndex();
  return _snippetByNameCache.get(name) ?? null;
}

/**
 * Return all snippet names available for a domain — used by the tool handler
 * when the agent passes an unknown name (we suggest valid options).
 */
export function listSnippetNamesForDomain(domainId: string): string[] {
  const cached = _domainNamesCache.get(domainId);
  if (cached) return cached;
  const list = DOMAIN_SNIPPETS[domainId] ?? SHARED;
  const names = list.map((s) => s.name);
  _domainNamesCache.set(domainId, names);
  return names;
}
