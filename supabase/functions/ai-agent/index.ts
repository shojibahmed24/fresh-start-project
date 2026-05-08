// ═══════════════════════════════════════════════════════════════════════════
// AI AGENT — Lovable-style agentic loop
// ═══════════════════════════════════════════════════════════════════════════
// This is the SOLE AI build pipeline. See header in previous revision for
// the full SSE event shape. This file additionally supports BACKGROUND
// CONTINUATION: when a turn hits the checkpoint guard we don't ask the
// client to call back — we self-invoke via EdgeRuntime.waitUntil and stream
// new events into `agent_turn_events`, which the client subscribes to via
// Realtime. See ./handler/continuation.ts for the full design.
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "./cors.ts";
import { buildUserMessage } from "./messages.ts";
import { AGENT_SYSTEM_PROMPT } from "./prompts.ts";
import type { ToolContext } from "./types.ts";

import { authenticate, verifyProjectOwnership } from "./handler/auth.ts";
import { parseRequest } from "./handler/request-parsing.ts";
import { buildFreshContext } from "./handler/context-builder.ts";
import { matchDomain } from "./handler/domain-match.ts";
import { runTurnLoop } from "./handler/turn-loop.ts";
import {
  scheduleContinuation,
  loadContinuation,
  buildEventSink,
  markContinuation,
} from "./handler/continuation.ts";

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 1. Auth + API-key check
  const authed = await authenticate(req);
  if (authed instanceof Response) return authed;
  const { supabase, userId, token, authHeader, apiKey } = authed;

  // ── BACKGROUND CONTINUATION FAST-PATH ────────────────────────────────
  // Self-invoked requests carry `continuation_id`. We respond 202 immediately
  // and run the loop inside EdgeRuntime.waitUntil, writing events to the
  // `agent_turn_events` table for the client to consume via Realtime.
  let earlyBody: any = null;
  try {
    earlyBody = await req.clone().json();
  } catch { /* parsed below */ }
  const continuationId: string | undefined = earlyBody?.continuation_id;
  if (continuationId) {
    return await handleContinuation({
      supabase,
      userId,
      authHeader,
      apiKey,
      continuationId,
    });
  }

  // 2. Parse + validate request body
  const parsed = await parseRequest(req);
  if (parsed instanceof Response) return parsed;
  const {
    projectId,
    userMessage,
    priorMessages,
    resumedHistory,
    model,
    attachments,
    imageAttachments,
    attachmentTextBlock,
  } = parsed;

  // 3. Verify project ownership
  const project = await verifyProjectOwnership(supabase, projectId, userId);
  if (project instanceof Response) return project;

  // 4. Build the SSE stream
  let __closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      let __seq = 0;
      const heartbeat = setInterval(() => {
        if (__closed) return;
        try {
          controller.enqueue(enc.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          __closed = true;
        }
      }, 10_000);
      const send = (event: any) => {
        if (__closed) return;
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ ...event, seq: __seq++ })}\n\n`));
        } catch (e) {
          __closed = true;
          console.warn("[ai-agent] stream closed by client, suppressing further writes");
        }
      };

      const ctx: ToolContext = {
        supabase,
        userId,
        projectId,
        pendingAsk: null,
        filesChanged: [],
        memoryDirty: false,
        readCache: new Map(),
        matchedDomainId: null,
        userJwt: token,
        attachments,
        send,
        progress: null,
      };

      // 5. Build initial conversation (resume vs fresh)
      let conversation: any[];
      let isEmptyProject = false;
      let autoBackend = false;

      if (resumedHistory.length > 0) {
        console.log(
          `[ai-agent] RESUME with ${resumedHistory.length} prior messages, answer="${userMessage.slice(0, 80)}"`,
        );
        conversation = [
          { role: "system", content: AGENT_SYSTEM_PROMPT },
          ...resumedHistory,
          buildUserMessage(userMessage + attachmentTextBlock, imageAttachments),
        ];
      } else {
        const fresh = await buildFreshContext(supabase, projectId);
        isEmptyProject = fresh.isEmptyProject;
        autoBackend = !!fresh.autoBackend;

        const HISTORY_KEEP = 6;
        const filteredPrior = priorMessages
          .filter((m) => m && typeof m.role === "string" && typeof m.content === "string")
          .map((m) => ({ role: m.role, content: m.content }));
        const truncatedPrior =
          filteredPrior.length > HISTORY_KEEP ? filteredPrior.slice(-HISTORY_KEEP) : filteredPrior;
        console.log(
          `[ai-agent] FRESH turn, files=${fresh.fileCount}, autoBackend=${autoBackend}, ${truncatedPrior.length}/${filteredPrior.length} prior msgs, msg="${userMessage.slice(0, 80)}"`,
        );
        conversation = [
          { role: "system", content: AGENT_SYSTEM_PROMPT },
          ...truncatedPrior,
          buildUserMessage(`${fresh.contextBlock}\n\n${userMessage}${attachmentTextBlock}`, imageAttachments),
        ];
      }

      // 6. Domain blueprint match
      let domainHint: string | undefined;
      if (isEmptyProject && resumedHistory.length === 0) {
        const matched = await matchDomain(userMessage, model);
        if (matched) {
          domainHint = matched.hint;
          ctx.matchedDomainId = matched.matchedDomainId;
        }
      }

      // 7. Run the agent loop with checkpoint → background continuation hook
      try {
        await runTurnLoop({
          ctx,
          conversation,
          apiKey,
          model,
          userMessage,
          isEmptyProject,
          autoBackend,
          domainHint,
          resumedHistory,
          send,
          continuationAttempt: 0,
          onCheckpoint: async ({ conversation: snap, filesChanged }) => {
            return await scheduleContinuation({
              supabase,
              projectId,
              userId,
              model,
              conversation: snap,
              filesChanged,
              attempt: 1,
              authHeader,
            });
          },
        });
      } catch (err: any) {
        console.error("agent loop error:", err);
        send({ type: "error", message: err?.message ?? "Agent error" });
      } finally {
        clearInterval(heartbeat);
        __closed = true;
        try { controller.close(); } catch { /* already closed by client */ }
      }
    },
    cancel() {
      __closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Background continuation entry point (self-invoked via waitUntil)
// ─────────────────────────────────────────────────────────────────────────
async function handleContinuation(args: {
  supabase: ReturnType<typeof authenticate> extends Promise<infer T> ? T extends { supabase: infer S } ? S : never : never;
  userId: string;
  authHeader: string;
  apiKey: string;
  continuationId: string;
}): Promise<Response> {
  const { supabase, userId, authHeader, apiKey, continuationId } = args as any;
  const row = await loadContinuation(supabase, continuationId, userId);
  if (!row) {
    return new Response(JSON.stringify({ error: "continuation not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (row.status === "done" || row.status === "error") {
    return new Response(JSON.stringify({ ok: true, status: row.status }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await markContinuation(supabase, continuationId, { status: "running" });

  const { send, flush } = buildEventSink({ supabase, continuationId, userId });

  // Build a context that mirrors the original turn. The conversation already
  // includes the system message? No — we strip system on persist, so re-prepend.
  const conversation = [
    { role: "system", content: AGENT_SYSTEM_PROMPT },
    ...(Array.isArray(row.conversation) ? row.conversation : []),
  ];

  const ctx: ToolContext = {
    supabase,
    userId,
    projectId: row.project_id,
    pendingAsk: null,
    filesChanged: Array.isArray(row.files_changed) ? row.files_changed : [],
    memoryDirty: false,
    readCache: new Map(),
    matchedDomainId: null,
    userJwt: "",
    attachments: [],
    send,
    progress: null,
  };

  const task = (async () => {
    let chainedTo: string | null = null;
    try {
      send({ type: "iteration", n: 0, continuation_attempt: row.attempt });
      await runTurnLoop({
        ctx,
        conversation,
        apiKey,
        model: row.model,
        userMessage: "__continuation__",
        isEmptyProject: false,
        autoBackend: false,
        resumedHistory: [],
        send,
        continuationAttempt: row.attempt,
        onCheckpoint: async ({ conversation: snap, filesChanged }) => {
          const id = await scheduleContinuation({
            supabase,
            projectId: row.project_id,
            userId,
            model: row.model,
            conversation: snap,
            filesChanged,
            attempt: row.attempt + 1,
            authHeader,
            // CRITICAL: chained continuations must reuse the SAME id the
            // client subscribed to. A fresh id would write events to a
            // channel nobody is listening on.
            reuseId: continuationId,
          });
          if (id) chainedTo = id;
          return id;
        },
      });
      // If we chained to another background run, leave status as `pending`
      // (the next run will flip it). Otherwise this turn truly finished.
      if (!chainedTo) {
        await markContinuation(supabase, continuationId, {
          status: "done",
          files_changed: ctx.filesChanged,
        });
      }
    } catch (err: any) {
      console.error("[continuation] loop error:", err);
      send({ type: "error", message: err?.message ?? "Agent error in background continuation" });
      await markContinuation(supabase, continuationId, {
        status: "error",
        error: err?.message ?? "unknown",
      });
    } finally {
      await flush();
    }
  })();

  const ER: any = (globalThis as any).EdgeRuntime;
  if (ER && typeof ER.waitUntil === "function") {
    ER.waitUntil(task);
  } else {
    task.catch(() => {});
  }

  return new Response(JSON.stringify({ ok: true, continuation_id: continuationId }), {
    status: 202,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
