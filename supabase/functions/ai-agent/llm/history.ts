// ═══════════════════════════════════════════════════════════════════════════
// LLM — resumed conversation history trimming
// ───────────────────────────────────────────────────────────────────────────
// When the agent paused on ask_user, the client posts back the full prior
// conversation so we can resume mid-thought. That history includes every
// tool result the agent has seen — read_file dumps, list_files arrays,
// grep matches — and can easily reach 20k+ tokens. We don't actually need
// the full body; a one-line summary preserves the tool_call_id contract
// and lets the model re-call the tool if it really needs the data again.
//
// Rules:
//   • Tool messages whose content > TOOL_TRIM_THRESHOLD chars are replaced
//     with `[Trimmed: <bytes> chars from `<tool>`. Re-call if needed.]`.
//   • Tool name resolved by walking back to the matching assistant tool_call.
//   • Assistant messages with tool_calls are kept verbatim (small + needed
//     for OpenAI tool-call referential integrity).
//   • The most recent N tool messages are LEFT INTACT so the model still has
//     fresh context to reason about its last actions.
// ═══════════════════════════════════════════════════════════════════════════

const TOOL_TRIM_THRESHOLD = 800;
const KEEP_RECENT_TOOLS = 2;

export function trimResumedHistory(history: any[]): any[] {
  if (!Array.isArray(history) || history.length === 0) return history;

  // Build a map: tool_call_id -> tool name (from assistant tool_calls).
  const idToName = new Map<string, string>();
  for (const msg of history) {
    if (msg?.role === "assistant" && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        const id = tc?.id;
        const name = tc?.function?.name;
        if (id && name) idToName.set(id, name);
      }
    }
  }

  // Find indices of all tool messages so we can preserve the last N intact.
  const toolIdxs: number[] = [];
  for (let i = 0; i < history.length; i++) {
    if (history[i]?.role === "tool") toolIdxs.push(i);
  }
  const keepFromIdx = toolIdxs.length > KEEP_RECENT_TOOLS
    ? toolIdxs[toolIdxs.length - KEEP_RECENT_TOOLS]
    : -1;

  let trimmedCount = 0;
  let savedChars = 0;
  const out = history.map((msg, i) => {
    if (msg?.role !== "tool") return msg;
    if (i >= keepFromIdx) return msg; // keep recent ones intact
    const content = typeof msg.content === "string" ? msg.content : "";
    if (content.length <= TOOL_TRIM_THRESHOLD) return msg;
    const toolName = idToName.get(msg.tool_call_id) || "tool";
    trimmedCount++;
    savedChars += content.length;
    return {
      ...msg,
      content:
        `[Trimmed: ${content.length} chars from \`${toolName}\` result. ` +
        `Re-call \`${toolName}\` if you need this data again.]`,
    };
  });

  if (trimmedCount > 0) {
    console.log(
      `[ai-agent] resume trim: ${trimmedCount} tool message(s), saved ~${savedChars} chars (~${Math.round(savedChars / 4)} tokens)`,
    );
  }
  return out;
}
