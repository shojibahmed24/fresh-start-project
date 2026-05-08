// ═══════════════════════════════════════════════════════════════════════════
// RESEARCH EXEC — domain-specific code snippets
// ═══════════════════════════════════════════════════════════════════════════

import { getSnippetByName, listSnippetNamesForDomain } from "../../../snippets.ts";
import type { ToolHandler } from "./web.ts";

export const exec_get_snippet: ToolHandler = async (args, ctx, _callId) => {
  if (typeof args.name !== "string" || !args.name.trim()) {
    return { result: { error: "name (string) required" } };
  }
  const snip = getSnippetByName(args.name);
  if (!snip) {
    const suggestions = ctx.matchedDomainId
      ? listSnippetNamesForDomain(ctx.matchedDomainId)
      : [];
    return {
      result: {
        error: `Snippet "${args.name}" not found.`,
        available: suggestions,
      },
    };
  }
  return {
    result: {
      name: snip.name,
      why: snip.why,
      uses: snip.uses ?? [],
      code: snip.code,
      note:
        "Adapt — don't copy verbatim. Rename identifiers, swap colors to your palette, wire to real props from your data layer.",
    },
  };
};
