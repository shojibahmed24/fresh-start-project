// Agent SSE client — talks to the `ai-agent` edge function and parses the
// structured event stream into typed events the UI can render.
//
// The agent runs a multi-turn loop with tool calls (read_file, write_file,
// ask_user…), can pause and wait for the user to answer a multiple-choice
// question, and emits richer events (thinking, tool_call, tool_result,
// file_changed…). It is the only AI build pipeline.
import { supabase } from "@/integrations/supabase/client";

export type AgentMessage = { role: "user" | "assistant" | "system"; content: string };

export type AgentEvent =
  | { type: "iteration"; n: number }
  | { type: "thinking"; text: string }
  | { type: "tool_call"; id: string; name: string; args: any }
  | { type: "tool_result"; id: string; name: string; result: any }
  | { type: "ask_user"; id: string; question: string; options: string[]; allow_other?: boolean }
  | { type: "file_changed"; path: string; action: "created" | "updated" }
  | { type: "memory_updated"; key: string }
  | {
      type: "paused";
      reason: string;
      files_changed?: string[];
      history?: any[];
      continuation_id?: string;
      mode?: "background" | "client_resume";
      attempt?: number;
    }
  | {
      type: "auto_verify";
      ok: boolean;
      checked: number;
      issue_count: number;
      attempt?: number;
      final?: boolean;
      auto_fixes_applied?: number;
      escalation_exhausted?: boolean;
      issues?: { path: string; problem: string; severity?: "warn" | "error" }[];
    }
  | {
      type: "auto_fix";
      count: number;
      changed_paths: string[];
      fixes: { path: string; fix: string }[];
    }
  | {
      type: "progress";
      current: number;
      total: number;
      percent: number;
      label?: string;
      eta_seconds?: number | null;
    }
  | { type: "done"; summary: string; files_changed?: string[] }
  | { type: "error"; message: string }
  | {
      type: "escalation";
      round: number;
      from_model: string;
      to_model: string;
      reason?: string;
    }
  // V2 orchestrator events (legacy — emitted by ai-agent-v2 edge function
  // when present. Kept in the union so timeline UI keeps compiling even
  // when V2 is disabled at runtime.)
  | { type: "v2_run"; run_id: string }
  | { type: "v2_phase"; phase: "planning" | "executing" | "retrying" | "summarizing" }
  | { type: "v2_plan"; run_id: string; plan: any }
  | { type: "v2_step"; step_index: number; step_id?: string }
  | { type: "v2_summary"; text: string }
  | { type: "v2_rollback"; step_id: string; restored: number; deleted: number; hint?: string }
  | { type: "v2_complete"; run_id: string };

export type AgentRunInput = {
  projectId: string;
  message: string;
  history?: AgentMessage[];
  resumedHistory?: any[];
  /** Legacy flag kept for callers — V2 routing now happens server-side. */
  useV2?: boolean;
  files?: Array<{ path: string; content: string }>;
  attachments?: Array<{ id?: string; name: string; kind: "file" | "image"; size?: number; content: string; mime?: string }>;
};

export async function runAgent(
  input: AgentRunInput,
  onEvent: (e: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;

  if (!token) {
    onEvent({ type: "error", message: "Sign in required to use the agent." });
    return;
  }

  // ───────── V2 path: background job + Realtime subscription ─────────
  if (input.useV2) {
    return runAgentV2(input, token, onEvent, signal);
  }

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent`;

  // Read user-selected model override from localStorage (set via the
  // ModelSettingsMenu dropdown in the builder header). Empty/missing →
  // backend uses its default.
  const modelOverride =
    typeof window !== "undefined"
      ? (window.localStorage.getItem("lovable_agent_model") || "").trim() || undefined
      : undefined;

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        projectId: input.projectId,
        message: input.message,
        messages: input.history ?? [],
        resumedHistory: input.resumedHistory ?? [],
        files: input.files ?? [],
        attachments: input.attachments ?? [],
        ...(modelOverride ? { model: modelOverride } : {}),
      }),
      signal,
    });
  } catch (err: any) {
    onEvent({
      type: "error",
      message: `Connection failed: ${err?.message || "network error"}`,
    });
    return;
  }

  if (!resp.ok || !resp.body) {
    let msg = `Agent request failed (${resp.status})`;
    try {
      const j = await resp.json();
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    if (resp.status === 429) msg = "Rate limit reached. Please wait a moment.";
    if (resp.status === 402) msg = "AI credits exhausted.";
    onEvent({ type: "error", message: msg });
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawTerminal = false;
  let backgroundContinuation: { id: string } | null = null;

  // Sequence-based reorder buffer (mirrors src/lib/ai.ts).
  let nextSeq = 0;
  const pending = new Map<number, AgentEvent>();
  const interceptPaused = (ev: AgentEvent): boolean => {
    // When the server pauses with a continuation_id, the rest of the work
    // happens in a background invocation that streams events into the
    // `agent_turn_events` table. Swallow the `paused` event from the user's
    // perspective and switch to Realtime — the turn isn't really over.
    if (
      ev.type === "paused" &&
      (ev as any).continuation_id &&
      (ev as any).mode === "background"
    ) {
      backgroundContinuation = { id: (ev as any).continuation_id as string };
      return true; // intercepted — do not forward
    }
    return false;
  };
  const flushPending = () => {
    while (pending.has(nextSeq)) {
      const ev = pending.get(nextSeq)!;
      pending.delete(nextSeq);
      nextSeq++;
      if (interceptPaused(ev)) continue;
      if (ev.type === "done" || ev.type === "error" || ev.type === "paused") sawTerminal = true;
      onEvent(ev);
    }
  };
  const dispatch = (raw: any) => {
    const seq = typeof raw?.seq === "number" ? raw.seq : null;
    const { seq: _s, ...event } = raw as any;
    const ev = event as AgentEvent;
    if (seq === null) {
      if (interceptPaused(ev)) return;
      if (ev.type === "done" || ev.type === "error" || ev.type === "paused") sawTerminal = true;
      onEvent(ev);
      return;
    }
    if (seq < nextSeq) return;
    pending.set(seq, ev);
    flushPending();
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sepIdx: number;
      while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (!json) continue;
          try {
            dispatch(JSON.parse(json));
          } catch (e) {
            console.warn("agent: bad SSE json", json);
          }
        }
      }
    }
    if (pending.size > 0) {
      const sorted = [...pending.entries()].sort((a, b) => a[0] - b[0]);
      for (const [, ev] of sorted) {
        if (interceptPaused(ev)) continue;
        if (ev.type === "done" || ev.type === "error" || ev.type === "paused") sawTerminal = true;
        onEvent(ev);
      }
      pending.clear();
    }
  } catch (err: any) {
    if (!sawTerminal && !backgroundContinuation) {
      onEvent({
        type: "error",
        message: `Stream interrupted: ${err?.message || "network error"}`,
      });
    }
    if (!backgroundContinuation) return;
  }

  // ── Background continuation: switch to Realtime on agent_turn_events ──
  if (backgroundContinuation) {
    await consumeContinuation(backgroundContinuation.id, onEvent, signal);
    return;
  }

  if (!sawTerminal) {
    onEvent({
      type: "error",
      message: "Agent stream closed unexpectedly. Try again.",
    });
  }
}

/**
 * Subscribe to `agent_turn_events` for a continuation_id and forward events.
 * Falls back to polling. Resolves when terminal event seen, status flips,
 * or caller aborts. The user never has to re-POST — even tab close + reopen
 * (with the same continuation_id remembered) would let us catch up.
 */
async function consumeContinuation(
  continuationId: string,
  onEvent: (e: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  let lastSeq = -1;
  let sawTerminal = false;
  let aborted = false;
  signal?.addEventListener("abort", () => { aborted = true; });

  const dispatchRow = (row: { seq: number; event: any }) => {
    if (sawTerminal) return;
    if (typeof row.seq !== "number" || row.seq <= lastSeq) return;
    lastSeq = row.seq;
    const ev = row.event as AgentEvent;
    onEvent(ev);
    if (ev.type === "done" || ev.type === "error") sawTerminal = true;
    if (ev.type === "paused" && !(ev as any).continuation_id) sawTerminal = true;
  };

  const fetchAll = async () => {
    if (sawTerminal || aborted) return;
    const { data } = await supabase
      .from("agent_turn_events")
      .select("seq, event")
      .eq("continuation_id", continuationId)
      .gt("seq", lastSeq)
      .order("seq", { ascending: true });
    if (Array.isArray(data)) for (const r of data) dispatchRow(r as any);
    if (sawTerminal) return;
    const { data: status } = await supabase
      .from("agent_turn_continuations")
      .select("status, error")
      .eq("id", continuationId)
      .maybeSingle();
    if (status?.status === "error") {
      onEvent({ type: "error", message: status.error || "Background agent failed" });
      sawTerminal = true;
    } else if (status?.status === "done") {
      sawTerminal = true;
    }
  };

  await fetchAll();
  if (sawTerminal) return;

  const channel = supabase
    .channel(`turn_continuation:${continuationId}`)
    .on(
      "postgres_changes" as any,
      {
        event: "INSERT",
        schema: "public",
        table: "agent_turn_events",
        filter: `continuation_id=eq.${continuationId}`,
      },
      (payload: any) => {
        const row = payload?.new;
        if (!row) return;
        dispatchRow({ seq: row.seq, event: row.event });
      },
    )
    .subscribe();

  const startedAt = Date.now();
  const MAX_WAIT_MS = 30 * 60 * 1000;
  while (!sawTerminal && !aborted) {
    await new Promise((r) => setTimeout(r, 4000));
    if (sawTerminal || aborted) break;
    if (Date.now() - startedAt > MAX_WAIT_MS) {
      onEvent({ type: "error", message: "Background agent timed out after 30 minutes." });
      break;
    }
    await fetchAll();
  }

  try { await supabase.removeChannel(channel); } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// V2 BACKGROUND-JOB CLIENT
// ───────────────────────────────────────────────────────────────────────────
// V2 is queued — the edge function returns `{ run_id }` immediately and the
// real work happens inside `EdgeRuntime.waitUntil`. We then subscribe to
// Realtime UPDATEs on `agent_runs` and replay any new entries from the
// `events` jsonb array. A polling fallback covers Realtime hiccups.
// ═══════════════════════════════════════════════════════════════════════════
async function runAgentV2(
  input: AgentRunInput,
  token: string,
  onEvent: (e: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent-v2`;
  const modelOverride =
    typeof window !== "undefined"
      ? (window.localStorage.getItem("lovable_agent_model") || "").trim() || undefined
      : undefined;
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        projectId: input.projectId,
        message: input.message,
        messages: input.history ?? [],
        resumedHistory: input.resumedHistory ?? [],
        files: input.files ?? [],
        attachments: input.attachments ?? [],
        ...(modelOverride ? { model: modelOverride } : {}),
      }),
      signal,
    });
  } catch (err: any) {
    onEvent({ type: "error", message: `Connection failed: ${err?.message || "network error"}` });
    return;
  }

  if (!resp.ok) {
    let msg = `Agent request failed (${resp.status})`;
    try { const j = await resp.json(); if (j?.error) msg = j.error; } catch {}
    if (resp.status === 429) msg = "Rate limit reached. Please wait a moment.";
    if (resp.status === 402) msg = "AI credits exhausted.";
    onEvent({ type: "error", message: msg });
    return;
  }

  let queued: { run_id?: string };
  try { queued = await resp.json(); }
  catch { onEvent({ type: "error", message: "Invalid queue response" }); return; }

  const runId = queued.run_id;
  if (!runId) {
    onEvent({ type: "error", message: "No run_id returned from v2" });
    return;
  }

  let lastSeq = -1;
  let sawTerminal = false;
  let aborted = false;
  let lastMeaningfulProgressAt = Date.now();

  const isIdleNotice = (ev: AgentEvent) =>
    ev.type === "thinking" &&
    /^\s*(Still waiting for the model to continue|Waiting for .*to start code generation)/.test(String((ev as any).text ?? ""));

  const pumpEvents = (events: any[] | null | undefined) => {
    if (sawTerminal || !Array.isArray(events)) return;
    const fresh = events
      .filter((e) => typeof e?.seq === "number" && e.seq > lastSeq)
      .sort((a, b) => a.seq - b.seq);
    for (const e of fresh) {
      lastSeq = e.seq;
      const { seq: _s, ts: _t, ...payload } = e;
      const ev = payload as AgentEvent;
      onEvent(ev);
      if (!isIdleNotice(ev)) lastMeaningfulProgressAt = Date.now();
      if (
        ev.type === "done" ||
        ev.type === "error" ||
        ev.type === "paused" ||
        (ev as any).type === "v2_complete"
      ) {
        sawTerminal = true;
        break;
      }
    }
  };

  const fetchOnce = async () => {
    if (sawTerminal || aborted) return;
    const { data } = await supabase
      .from("agent_runs")
      .select("events,status,error_message")
      .eq("id", runId)
      .maybeSingle();
    if (!data) return;
    pumpEvents(data.events as any[]);
    if (!sawTerminal && (data.status === "done" || data.status === "error")) {
      if (data.status === "error") {
        onEvent({ type: "error", message: data.error_message ?? "agent failed" });
      } else {
        onEvent({ type: "done", summary: "" });
      }
      sawTerminal = true;
    }
  };

  await fetchOnce();
  if (sawTerminal) return;

  const channelName = `agent_run:${runId}:${Math.random().toString(36).slice(2, 8)}`;
  const channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes" as any,
      { event: "UPDATE", schema: "public", table: "agent_runs", filter: `id=eq.${runId}` },
      (payload: any) => {
        const row: any = payload?.new;
        if (!row) return;
        pumpEvents(row.events);
        if (!sawTerminal && (row.status === "done" || row.status === "error")) {
          if (row.status === "error") {
            onEvent({ type: "error", message: row.error_message ?? "agent failed" });
          } else {
            onEvent({ type: "done", summary: "" });
          }
          sawTerminal = true;
        }
      },
    )
    .subscribe();

  signal?.addEventListener("abort", () => { aborted = true; });

  const pollIntervalMs = 3000;
  const maxWaitMs = 560 * 1000;
  const startedAt = Date.now();
  while (!sawTerminal && !aborted) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    if (sawTerminal || aborted) break;
    if (Date.now() - startedAt > maxWaitMs || Date.now() - lastMeaningfulProgressAt > 270 * 1000) {
      onEvent({ type: "error", message: "Code generation stalled after several minutes without a new event." });
      break;
    }
    await fetchOnce();
  }

  try { await supabase.removeChannel(channel); } catch { /* ignore */ }
}
