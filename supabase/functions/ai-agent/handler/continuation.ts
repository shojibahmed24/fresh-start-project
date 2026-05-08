// ═══════════════════════════════════════════════════════════════════════════
// HANDLER — backend continuation (no client resume needed)
// ───────────────────────────────────────────────────────────────────────────
// When a turn hits the checkpoint guard (iter >= max OR elapsed >= budget) we
// no longer ask the client to call us back. Instead:
//
//   1. Persist the full conversation snapshot to `agent_turn_continuations`
//   2. Self-invoke this same edge function with `continuation_id` via
//      `EdgeRuntime.waitUntil` (background task → keeps running after the
//      original response is closed)
//   3. Tell the client: { type: "paused", continuation_id, mode: "background" }
//      The client switches to a Realtime subscription on `agent_turn_events`
//      and never has to re-POST.
//
// The background invocation:
//   • Loads conversation from DB
//   • Replaces `send()` so events are inserted into `agent_turn_events`
//     instead of streamed over SSE
//   • Runs the same turn-loop. If IT also hits the checkpoint, recurses
//     (chain of background invocations) until status is set to done/error.
//
// Hard cap: `MAX_CONTINUATION_ATTEMPTS` so a runaway turn can't burn the
// account forever.
// ═══════════════════════════════════════════════════════════════════════════

import type { createClient } from "npm:@supabase/supabase-js@2";

export const MAX_CONTINUATION_ATTEMPTS = 16;

type SbClient = ReturnType<typeof createClient>;

export type ContinuationRow = {
  id: string;
  project_id: string;
  user_id: string;
  model: string;
  conversation: any[];
  files_changed: string[];
  attempt: number;
  status: "pending" | "running" | "done" | "error";
  error: string | null;
};

/**
 * Persist a paused turn's state and schedule a background self-invocation.
 * Returns the continuation row id (caller emits it in the `paused` event so
 * the client can subscribe to Realtime).
 */
export async function scheduleContinuation(args: {
  supabase: SbClient;
  projectId: string;
  userId: string;
  model: string;
  conversation: any[];
  filesChanged: string[];
  attempt: number;
  authHeader: string;
  /**
   * If provided, REUSE this continuation row (chained background turn) instead
   * of inserting a new one. This is critical: the client subscribes to ONE
   * continuation_id via Realtime — every chained run must write events under
   * that same id or the client misses them entirely.
   */
  reuseId?: string | null;
}): Promise<string | null> {
  const { supabase, projectId, userId, model, conversation, filesChanged, attempt, authHeader, reuseId } = args;

  if (attempt >= MAX_CONTINUATION_ATTEMPTS) {
    console.warn(`[continuation] hit MAX_CONTINUATION_ATTEMPTS=${MAX_CONTINUATION_ATTEMPTS}, refusing to schedule`);
    return null;
  }

  let continuationId: string;
  if (reuseId) {
    const { error: upErr } = await supabase
      .from("agent_turn_continuations")
      .update({
        conversation,
        files_changed: filesChanged,
        attempt,
        status: "pending",
        error: null,
      })
      .eq("id", reuseId)
      .eq("user_id", userId);
    if (upErr) {
      console.error("[continuation] reuse update failed:", upErr);
      return null;
    }
    continuationId = reuseId;
  } else {
    const insertPayload = {
      project_id: projectId,
      user_id: userId,
      model,
      conversation,
      files_changed: filesChanged,
      attempt,
      status: "pending" as const,
    };

    const { data, error } = await supabase
      .from("agent_turn_continuations")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error || !data?.id) {
      console.error("[continuation] insert failed:", error);
      return null;
    }
    continuationId = data.id as string;
  }

  // Fire-and-forget self-invocation via EdgeRuntime.waitUntil. The background
  // task survives after the parent SSE response closes.
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const url = `${SUPABASE_URL}/functions/v1/ai-agent`;

  const body = JSON.stringify({
    projectId,
    message: "__continuation__",
    continuation_id: continuationId,
  });

  const task = (async () => {
    // Tiny delay so the parent invocation has a chance to flush its `paused`
    // SSE frame and close cleanly before we hammer ourselves.
    await new Promise((r) => setTimeout(r, 250));
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
          apikey: SUPABASE_ANON,
        },
        body,
      });
      // Drain so Deno doesn't complain about an unconsumed body.
      try { await r.text(); } catch { /* ignore */ }
      console.log(`[continuation] self-invoke status=${r.status} for ${continuationId}`);
    } catch (e) {
      console.error("[continuation] self-invoke failed:", e);
      try {
        await supabase
          .from("agent_turn_continuations")
          .update({ status: "error", error: `self-invoke failed: ${(e as Error).message}` })
          .eq("id", continuationId);
      } catch { /* ignore */ }
    }
  })();

  // EdgeRuntime is provided by Supabase edge runtime. Type-cast for Deno.
  const ER: any = (globalThis as any).EdgeRuntime;
  if (ER && typeof ER.waitUntil === "function") {
    ER.waitUntil(task);
  } else {
    // Fallback: fire-and-forget; dev-only. Best effort.
    task.catch(() => {});
  }

  return continuationId;
}

/**
 * Build a `send()` function that writes events to `agent_turn_events` instead
 * of an SSE stream. Used by background continuation invocations.
 *
 * Writes are batched (best-effort) but never blocking — if the insert fails
 * we log and move on. The bigserial `id` plus our own `seq` give the client
 * a strict ordering guarantee.
 */
export function buildEventSink(args: {
  supabase: SbClient;
  continuationId: string;
  userId: string;
}): {
  send: (event: any) => void;
  flush: () => Promise<void>;
} {
  const { supabase, continuationId, userId } = args;
  let seq = 0;
  const queue: any[] = [];
  let flushing = false;

  const flushOnce = async () => {
    if (flushing || queue.length === 0) return;
    flushing = true;
    const batch = queue.splice(0, queue.length);
    try {
      const rows = batch.map((event) => ({
        continuation_id: continuationId,
        user_id: userId,
        seq: event.__seq,
        event: { ...event, seq: event.__seq, __seq: undefined },
      }));
      // Strip the helper key
      for (const r of rows) delete (r.event as any).__seq;
      const { error } = await supabase.from("agent_turn_events").insert(rows);
      if (error) console.error("[continuation:sink] insert failed:", error);
    } catch (e) {
      console.error("[continuation:sink] flush threw:", e);
    } finally {
      flushing = false;
      if (queue.length > 0) {
        // Drain anything that arrived while we were inserting.
        flushOnce().catch(() => {});
      }
    }
  };

  const send = (event: any) => {
    queue.push({ ...event, __seq: seq++ });
    // Microtask flush — coalesces bursts but still ships within ~ms.
    Promise.resolve().then(() => flushOnce().catch(() => {}));
  };

  const flush = async () => {
    // Block until queue is fully drained.
    let guard = 0;
    while ((queue.length > 0 || flushing) && guard++ < 200) {
      await flushOnce().catch(() => {});
      if (queue.length === 0 && !flushing) break;
      await new Promise((r) => setTimeout(r, 25));
    }
  };

  return { send, flush };
}

export async function loadContinuation(
  supabase: SbClient,
  continuationId: string,
  userId: string,
): Promise<ContinuationRow | null> {
  const { data, error } = await supabase
    .from("agent_turn_continuations")
    .select("id, project_id, user_id, model, conversation, files_changed, attempt, status, error")
    .eq("id", continuationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as ContinuationRow;
}

export async function markContinuation(
  supabase: SbClient,
  continuationId: string,
  patch: Partial<Pick<ContinuationRow, "status" | "error" | "files_changed" | "attempt" | "conversation">>,
): Promise<void> {
  try {
    await supabase.from("agent_turn_continuations").update(patch).eq("id", continuationId);
  } catch (e) {
    console.error("[continuation] markContinuation failed:", e);
  }
}
