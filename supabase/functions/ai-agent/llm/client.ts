// ═══════════════════════════════════════════════════════════════════════════
// LLM — Gateway client (callLLM + consumeLLMStream)
// ───────────────────────────────────────────────────────────────────────────
// Thin wrapper around the OpenAI-compatible Lovable AI Gateway:
//   • callLLM         — POSTs chat-completion request (stream or non-stream),
//                       injects Anthropic cache breakpoints for Claude models.
//   • consumeLLMStream — Parses an OpenAI-compatible streaming response,
//                       calling onTextDelta(chunk) for content deltas and
//                       assembling tool_calls into their final shape.
//                       Returns { content, tool_calls } matching
//                       choices[0].message so the caller can stay unchanged.
// ═══════════════════════════════════════════════════════════════════════════

import {
  GATEWAY,
  LLM_STREAM_IDLE_HEARTBEAT_MS,
  LLM_STREAM_BODY_TIMEOUT_MS,
  LLM_FIRST_EVENT_TIMEOUT_MS,
  LLM_NEXT_EVENT_TIMEOUT_MS,
  LLM_IDLE_NOTICE_MS,
} from "../config.ts";
import { TOOLS } from "../tools/registry.ts";
import { isClaudeModel, applyClaudeCaching } from "./caching.ts";

export async function callLLM(
  messages: any[],
  apiKey: string,
  model: string,
  stream = false,
  tools: typeof TOOLS = TOOLS,
) {
  // Inject Anthropic cache breakpoints when talking to a Claude model.
  // No-op for Gemini / GPT (they have their own automatic caching).
  let outMessages = messages;
  let outTools: any[] = tools as any[];
  if (isClaudeModel(model)) {
    const cached = applyClaudeCaching(messages, tools as any[]);
    outMessages = cached.messages;
    outTools = cached.tools;
  }

  // ── Output token cap ────────────────────────────────────────────────────
  // Without an explicit max_tokens, providers truncate long React component
  // writes mid-stream (causing unbalanced JSX / missing default exports).
  // Pick a generous cap per model family so full-file rewrites can finish.
  const m = model.toLowerCase();
  let maxTokens = 16000;
  if (m.includes("gemini")) maxTokens = 32000;          // Gemini 1.5/2.x supports very large outputs
  else if (m.includes("claude")) maxTokens = 16000;     // Anthropic hard cap is 8k–16k depending on model
  else if (m.includes("gpt-5") || m.includes("gpt-4.1") || m.includes("gpt-4o")) maxTokens = 16000;
  else if (m.includes("kimi") || m.includes("moonshot")) maxTokens = 16000;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), stream ? LLM_STREAM_BODY_TIMEOUT_MS : 60_000);
  try {
    const resp = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://lovable.dev",
        "X-Title": "Lovable Agent",
      },
      body: JSON.stringify({
        model,
        messages: outMessages,
        tools: outTools,
        tool_choice: "auto",
        temperature: 0.2,
        stream,
        max_tokens: maxTokens,
        // Ask OpenRouter to include cache usage stats in the response so we
        // can log hit rates and verify caching is actually working.
        usage: { include: true },
        // Medium reasoning gives the model enough budget to plan complete
        // components (handlers, edge cases, error states) instead of writing
        // stubs. Low effort caused frequent placeholder/TODO output.
        reasoning: { effort: "medium", exclude: true },
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    return resp;
  } catch (e: any) {
    clearTimeout(timer);
    throw new Error(`LLM request failed: ${e?.name === "AbortError" ? "timeout before response" : (e?.message ?? e)}`);
  }
}

export async function consumeLLMStream(
  resp: Response,
  onTextDelta: (delta: string) => void,
  onIdle?: (elapsedMs: number) => void,
  opts?: { firstEventTimeoutMs?: number; idleNoticeMs?: number },
): Promise<{ content: string; tool_calls: any[] }> {
  const reader = resp.body!.getReader();
  const dec = new TextDecoder();
  let buffer = "";
  let content = "";
  const startedAt = Date.now();
  let sawModelEvent = false;
  let lastModelEventAt = startedAt;
  let lastIdleNoticeAt = 0;
  // tool_calls arrive as deltas keyed by `index`. We assemble each one then
  // sort by index at the end so the outgoing array matches OpenAI's order.
  const toolCallsByIndex = new Map<
    number,
    { id?: string; type?: string; function: { name?: string; arguments: string } }
  >();

  try {
    while (true) {
      const remaining = LLM_STREAM_BODY_TIMEOUT_MS - (Date.now() - startedAt);
      if (remaining <= 0) throw new Error("LLM stream body timed out");
      let idleTimer: number | undefined;
      const chunk = await Promise.race([
        reader.read().then((result) => ({ kind: "read" as const, result })),
        new Promise<{ kind: "idle" }>((resolve) => {
          idleTimer = setTimeout(() => resolve({ kind: "idle" }), Math.min(LLM_STREAM_IDLE_HEARTBEAT_MS, remaining));
        }),
      ]);
      if (idleTimer !== undefined) clearTimeout(idleTimer);
      if (chunk.kind === "idle") {
        const elapsed = Date.now() - startedAt;
        if (!sawModelEvent && elapsed >= (opts?.firstEventTimeoutMs ?? LLM_FIRST_EVENT_TIMEOUT_MS)) {
          throw new Error(`No model stream events after ${Math.round(elapsed / 1000)}s`);
        }
        if (sawModelEvent && Date.now() - lastModelEventAt >= LLM_NEXT_EVENT_TIMEOUT_MS) {
          throw new Error(`No further model stream events for ${Math.round((Date.now() - lastModelEventAt) / 1000)}s`);
        }
        if (elapsed - lastIdleNoticeAt >= (opts?.idleNoticeMs ?? LLM_IDLE_NOTICE_MS)) {
          lastIdleNoticeAt = elapsed;
          onIdle?.(elapsed);
        }
        continue;
      }
      const { done, value } = chunk.result;
      if (done) break;
      buffer += dec.decode(value, { stream: true });

      let sepIdx: number;
      while ((sepIdx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, sepIdx).trim();
        buffer = buffer.slice(sepIdx + 1);
        if (!line || !line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        let json: any;
        try {
          json = JSON.parse(payload);
        } catch {
          continue;
        }

        // Log Anthropic cache stats when present (final SSE chunk usually carries `usage`).
        // Helps verify caching is actually working — look for `cache_read_input_tokens > 0`.
        const u = json.usage;
        if (u && (u.cache_read_input_tokens != null || u.cache_creation_input_tokens != null)) {
          console.log(
            `[cache] read=${u.cache_read_input_tokens ?? 0} created=${u.cache_creation_input_tokens ?? 0} input=${u.prompt_tokens ?? u.input_tokens ?? 0} output=${u.completion_tokens ?? u.output_tokens ?? 0}`,
          );
        }

        const delta = json.choices?.[0]?.delta;
        if (!delta) continue;
        sawModelEvent = true;
        lastModelEventAt = Date.now();

        if (typeof delta.content === "string" && delta.content.length > 0) {
          content += delta.content;
          onTextDelta(delta.content);
        }
        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx = typeof tc.index === "number" ? tc.index : 0;
            let acc = toolCallsByIndex.get(idx);
            if (!acc) {
              acc = { function: { arguments: "" } };
              toolCallsByIndex.set(idx, acc);
            }
            if (tc.id) acc.id = tc.id;
            if (tc.type) acc.type = tc.type;
            if (tc.function?.name) acc.function.name = tc.function.name;
            if (typeof tc.function?.arguments === "string") {
              acc.function.arguments += tc.function.arguments;
            }
          }
        }
      }
    }
  } finally {
    try { reader.cancel().catch(() => {}); } catch { /* noop */ }
  }

  const tool_calls = [...toolCallsByIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => ({
      id: v.id ?? crypto.randomUUID(),
      type: v.type ?? "function",
      function: {
        name: v.function.name ?? "",
        arguments: v.function.arguments ?? "{}",
      },
    }));

  return { content, tool_calls };
}
