// Plan Mode client — calls the `plan-chat` edge function and streams the
// assistant reply token-by-token. The server reads project files & errors
// from the database directly (we just send projectId), so the client doesn't
// need to forward any code.

import { supabase } from "@/integrations/supabase/client";

export type PlanChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type PlanChatInput = {
  projectId?: string;
  message: string;
  history?: PlanChatMessage[];
};

/**
 * Stream a Plan Mode reply. Calls `onToken` for each delta and resolves with
 * the complete text once the stream finishes. Throws on transport / API errors.
 */
export async function streamPlanChat(
  input: PlanChatInput,
  onToken: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("Sign in required to use Plan mode.");

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plan-chat`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      projectId: input.projectId,
      message: input.message,
      history: input.history ?? [],
    }),
    signal,
  });

  if (!resp.ok || !resp.body) {
    let msg = `Plan chat failed (${resp.status})`;
    try {
      const j = await resp.json();
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let full = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data:")) continue;
      const jsonStr = line.slice(5).trim();
      if (jsonStr === "[DONE]") {
        streamDone = true;
        break;
      }
      try {
        const parsed = JSON.parse(jsonStr);
        const content: string | undefined = parsed?.choices?.[0]?.delta?.content;
        if (content) {
          full += content;
          onToken(content);
        }
      } catch {
        // Partial JSON split across chunks — re-buffer and wait for more data.
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  // Flush any trailing buffered lines.
  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data:")) continue;
      const jsonStr = raw.slice(5).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content: string | undefined = parsed?.choices?.[0]?.delta?.content;
        if (content) {
          full += content;
          onToken(content);
        }
      } catch {
        /* ignore partial leftover */
      }
    }
  }

  return full;
}
