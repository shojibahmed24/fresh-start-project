// ═══════════════════════════════════════════════════════════════════════════
// LLM — Anthropic / Claude prompt caching helpers
// ───────────────────────────────────────────────────────────────────────────
// OpenRouter passes Anthropic's `cache_control: { type: "ephemeral" }`
// breakpoints straight through to the Anthropic API, giving us a 90%
// discount on cached input tokens (5-minute TTL). Anthropic allows up to
// 4 cache breakpoints per request — we use 2:
//   1. System prompt   (huge, identical across iterations of a turn)
//   2. Tools array     (also identical across iterations)
// Conversation/tool messages stay uncached because they grow every turn.
//
// Gemini does implicit caching automatically (no code change needed).
// GPT-5 does automatic caching too. So we only inject markers for Claude.
//
// References:
//   • https://openrouter.ai/docs/features/prompt-caching
//   • https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
// ═══════════════════════════════════════════════════════════════════════════

export function isClaudeModel(model: string): boolean {
  return /^anthropic\//i.test(model) || /\bclaude\b/i.test(model);
}

// Wrap a string into Anthropic's content-block array form with a cache marker
// at the end. OpenRouter accepts this shape for any provider but only Anthropic
// honours `cache_control` — others silently ignore it.
export function withCacheMarker(text: string): any {
  return [
    {
      type: "text",
      text,
      cache_control: { type: "ephemeral" },
    },
  ];
}

// Apply cache markers to the system message + tool definitions (Claude only).
// We mutate copies, never the originals, so the in-memory conversation stays
// in plain string form for everything else (history echo, trimming, etc.).
export function applyClaudeCaching(
  messages: any[],
  tools: any[],
): { messages: any[]; tools: any[] } {
  // System message → wrap content as cached block.
  const cachedMessages = messages.map((m, i) => {
    if (i === 0 && m?.role === "system" && typeof m.content === "string" && m.content.length > 1024) {
      return { ...m, content: withCacheMarker(m.content) };
    }
    return m;
  });

  // Tools → mark the LAST tool's description with cache_control. Anthropic
  // caches everything up to and including that breakpoint, so one marker
  // covers the entire tool array.
  const cachedTools = tools.length > 0
    ? tools.map((t, i) => {
        if (i !== tools.length - 1) return t;
        return {
          ...t,
          cache_control: { type: "ephemeral" },
        };
      })
    : tools;

  return { messages: cachedMessages, tools: cachedTools };
}
