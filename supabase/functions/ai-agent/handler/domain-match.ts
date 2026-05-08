// ═══════════════════════════════════════════════════════════════════════════
// HANDLER — domain blueprint matching (Phase 1 hybrid: keyword + LLM tiebreak)
// ───────────────────────────────────────────────────────────────────────────
// Only fires for fresh empty-project turns (scratch builds). Selects the
// best-matching app archetype from the registry and produces a compact
// blueprint hint to inject into the iter-0 system prompt so the agent
// builds on top of a real, opinionated foundation instead of inventing a
// generic shell.
// ═══════════════════════════════════════════════════════════════════════════

import {
  matchDomainByKeyword,
  classifyDomainWithLLM,
  renderDomainHint,
  DOMAINS,
  type DomainTemplate,
} from "../domains.ts";
import { renderDomainSnippetIndex } from "../snippets.ts";
import { GATEWAY } from "../config.ts";

export type DomainMatch = { hint: string; matchedDomainId: string };

export async function matchDomain(
  userMessage: string,
  model: string,
): Promise<DomainMatch | null> {
  try {
    const kw = matchDomainByKeyword(userMessage);
    let chosen: DomainTemplate = kw.domain;
    if (kw.ambiguous) {
      // Pick the top 4 keyword candidates and ask the configured model to disambiguate.
      const text = " " + userMessage.toLowerCase() + " ";
      const candidates = DOMAINS
        .map((d) => ({
          d,
          s: d.keywords.reduce(
            (n, k) => n + (text.includes(k.toLowerCase()) ? 1 : 0),
            0,
          ),
        }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 4)
        .map((x) => x.d);
      chosen = await classifyDomainWithLLM(
        userMessage,
        candidates.length > 0 ? candidates : DOMAINS.slice(0, 8),
        async (sys, usr) => {
          const r = await fetch(GATEWAY, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${Deno.env.get("OPENROUTER_API_KEY")}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://lovable.dev",
              "X-Title": "Lovable Agent",
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: sys },
                { role: "user", content: usr },
              ],
              temperature: 0,
              max_tokens: 16,
            }),
          });
          const j = await r.json();
          return j?.choices?.[0]?.message?.content ?? "";
        },
      );
    }
    const hint = renderDomainHint(chosen) + renderDomainSnippetIndex(chosen.id);
    console.log(
      `[ai-agent] domain matched: ${chosen.id} (kw_conf=${kw.confidence.toFixed(2)}, ambiguous=${kw.ambiguous})`,
    );
    return { hint, matchedDomainId: chosen.id };
  } catch (e) {
    console.warn("[ai-agent] domain match failed, falling back:", e);
    return null;
  }
}
