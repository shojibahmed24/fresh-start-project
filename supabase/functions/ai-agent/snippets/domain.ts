// ─────────────────────────────────────────────────────────────────────
// Domain-specific snippets — barrel
//
// Snippets grouped by vertical so each file stays focused & under ~120 lines:
//   - media.ts         podcast / video patterns
//   - commerce.ts      ecommerce / food / travel cards
//   - health.ts        fitness ring, meditation session
//   - finance.ts       banking balance/tx, crypto ticker
//   - social.ts        chat, social feed, dating, AI chat message
//   - productivity.ts  todo, kanban, notes, events
//   - lifestyle.ts     news, weather, portfolio
// ─────────────────────────────────────────────────────────────────────

export * from "./domain/media.ts";
export * from "./domain/commerce.ts";
export * from "./domain/health.ts";
export * from "./domain/finance.ts";
export * from "./domain/social.ts";
export * from "./domain/productivity.ts";
export * from "./domain/lifestyle.ts";
