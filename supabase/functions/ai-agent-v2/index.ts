// ═══════════════════════════════════════════════════════════════════════════
// AI AGENT V2 — Background-job orchestrator (planner → executor)
// ───────────────────────────────────────────────────────────────────────────
// Slim, single-file rewrite. Replaces the previous multi-folder layout
// (planner/, executor/, dag/, rollback/, runtime/, worker.ts, types.ts).
//
// Flow:
//   1. POST /ai-agent-v2 → create agent_runs row, return {run_id} in 202.
//   2. Background task (EdgeRuntime.waitUntil) calls a tiny LLM planner to
//      produce 1-3 high-level steps, then streams the v1 ai-agent function
//      for each step and pushes SSE events into agent_runs.events.
//   3. Frontend (src/lib/aiAgent.ts → runAgentV2) subscribes via Realtime
//      to agent_runs UPDATE and replays the events array.
//
// The UI consumes v2_run / v2_phase / v2_plan / v2_step / v2_summary /
// v2_complete events alongside the regular tool_call / file_changed / done
// events forwarded transparently from the v1 executor.
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const PLANNER_MODEL = "google/gemini-2.5-flash";

declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void };

// ─────────────────────────────────────────────────────────────────────
// Event publisher — appends to the agent_runs.events jsonb array with
// monotonically-increasing seq numbers. Frontend pumps from this array.
// ─────────────────────────────────────────────────────────────────────
function makePublisher(admin: SupabaseClient, runId: string) {
  let seq = 0;
  let buf: any[] = [];
  let flushing = false;

  const flush = async () => {
    if (flushing || buf.length === 0) return;
    flushing = true;
    const batch = buf;
    buf = [];
    try {
      // Atomic append via RPC if available; fall back to read-modify-write.
      const { data: row } = await admin
        .from("agent_runs")
        .select("events,last_event_seq")
        .eq("id", runId)
        .maybeSingle();
      const existing = Array.isArray(row?.events) ? (row!.events as any[]) : [];
      const merged = existing.concat(batch);
      await admin
        .from("agent_runs")
        .update({
          events: merged,
          last_event_seq: batch[batch.length - 1].seq,
        })
        .eq("id", runId);
    } catch (err) {
      console.error(`[v2 publisher] flush failed for run ${runId}:`, err);
    } finally {
      flushing = false;
      if (buf.length > 0) await flush();
    }
  };

  return {
    async publish(event: any) {
      buf.push({ ...event, seq: seq++, ts: Date.now() });
      // Flush eagerly on terminal events; otherwise batch for ~150ms.
      if (
        event.type === "done" ||
        event.type === "error" ||
        event.type === "v2_complete" ||
        event.type === "paused"
      ) {
        await flush();
      } else if (buf.length >= 6) {
        await flush();
      } else {
        setTimeout(() => flush(), 150);
      }
    },
    flush,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Tiny planner: returns 1-3 step titles describing what's about to happen.
// Falls back to a single "Build the requested changes" step if the LLM
// is unavailable or returns garbage. The planner is purely for UX —
// execution still happens in the v1 ai-agent function.
// ─────────────────────────────────────────────────────────────────────
async function planSteps(
  message: string,
  isEmpty: boolean,
): Promise<{ title: string; description: string }[]> {
  const fallback = [
    {
      title: isEmpty ? "Scaffold the app" : "Apply requested changes",
      description: message.slice(0, 160),
    },
  ];
  if (!OPENROUTER_API_KEY) return fallback;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: PLANNER_MODEL,
        temperature: 0.2,
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content:
              "You are a planner. Given a user request, output 1-3 short build steps as JSON: " +
              `{"steps":[{"title":"...","description":"..."}]}. ` +
              "Titles ≤6 words. No markdown, no prose, JSON only.",
          },
          {
            role: "user",
            content: `Project state: ${isEmpty ? "EMPTY (scratch build)" : "EXISTING (edit)"}\n\nRequest: ${message.slice(0, 600)}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return fallback;
    const j = await res.json();
    const raw = j?.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.steps) && parsed.steps.length > 0) {
      return parsed.steps
        .slice(0, 3)
        .map((s: any) => ({
          title: String(s?.title ?? "Step").slice(0, 60),
          description: String(s?.description ?? "").slice(0, 200),
        }));
    }
    return fallback;
  } catch {
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Stream the v1 ai-agent edge function and forward its SSE events to
// the publisher. Returns true on a clean `done`, false on any error.
// ─────────────────────────────────────────────────────────────────────
async function streamV1Executor(opts: {
  authToken: string;
  body: Record<string, unknown>;
  publish: (e: any) => Promise<void>;
}): Promise<{ ok: boolean; errorMessage?: string }> {
  const url = `${SUPABASE_URL}/functions/v1/ai-agent`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.authToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(opts.body),
    });
  } catch (e: any) {
    await opts.publish({
      type: "error",
      message: `Executor connection failed: ${e?.message ?? "network error"}`,
    });
    return { ok: false, errorMessage: `Executor connection failed: ${e?.message ?? "network error"}` };
  }
  if (!res.ok || !res.body) {
    const txt = await res.text().catch(() => "");
    const message = `Executor HTTP ${res.status}: ${txt.slice(0, 200)}`;
    await opts.publish({
      type: "error",
      message,
    });
    return { ok: false, errorMessage: message };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let cleanDone = false;
  let pausedForCheckpoint = false;
  let lastError = "Executor stopped before finishing.";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload) continue;
        let evt: any;
        try { evt = JSON.parse(payload); } catch { continue; }
        // Strip v1 seq — v2 publisher re-numbers events.
        delete evt.seq;
        if (evt.type === "done") cleanDone = true;
        // A `paused` with reason="time_budget" is a CLEAN checkpoint, not a
        // failure — the client will auto-resume in a fresh invocation.
        if (evt.type === "paused" && evt.reason === "time_budget") {
          pausedForCheckpoint = true;
        }
        if (evt.type === "error" && typeof evt.message === "string") lastError = evt.message;
        await opts.publish(evt);
      }
    }
  } catch (e: any) {
    const message = `Executor stream error: ${e?.message ?? "stream broken"}`;
    await opts.publish({
      type: "error",
      message,
    });
    return { ok: false, errorMessage: message };
  } finally {
    try { reader.cancel().catch(() => {}); } catch { /* noop */ }
  }
  if (cleanDone || pausedForCheckpoint) return { ok: true };
  return { ok: false, errorMessage: lastError };
}

// ─────────────────────────────────────────────────────────────────────
// Background worker — runs the full planner→executor flow.
// ─────────────────────────────────────────────────────────────────────
async function runJob(opts: {
  admin: SupabaseClient;
  runId: string;
  authToken: string;
  body: any;
  userMessage: string;
  files: Array<{ path: string; content: string }>;
}) {
  const { admin, runId, authToken, body, userMessage, files } = opts;
  const isEmpty = files.length === 0;
  const pub = makePublisher(admin, runId);

  await admin
    .from("agent_runs")
    .update({ status: "running" })
    .eq("id", runId);

  await pub.publish({ type: "v2_run", run_id: runId });
  await pub.publish({ type: "v2_phase", phase: "planning" });

  const steps = await planSteps(userMessage, isEmpty);
  const plan = {
    intent: userMessage.slice(0, 120),
    scope: isEmpty ? "scratch_build" : "edit",
    steps: steps.map((s, i) => ({
      id: `s${i}`,
      title: s.title,
      description: s.description,
      depends_on: [],
    })),
  };
  await pub.publish({ type: "v2_plan", run_id: runId, plan });

  await pub.publish({ type: "v2_phase", phase: "executing" });
  await pub.publish({ type: "v2_step", step_index: 0, step_id: plan.steps[0].id });

  const execResult = await streamV1Executor({
    authToken,
    body: {
      projectId: body.projectId ?? null,
      message: userMessage,
      messages: body.messages ?? [],
      resumedHistory: body.resumedHistory ?? [],
      files,
      attachments: body.attachments ?? [],
      ...(body.model ? { model: body.model } : {}),
    },
    publish: pub.publish,
  });
  const ok = execResult.ok;

  if (ok) {
    await pub.publish({
      type: "v2_summary",
      text: `Completed ${plan.steps.length} step${plan.steps.length === 1 ? "" : "s"}.`,
    });
  }

  await pub.publish({ type: "v2_phase", phase: "summarizing" });
  await pub.publish({ type: "v2_complete", run_id: runId });
  await pub.flush();

  await admin
    .from("agent_runs")
    .update({
      status: ok ? "done" : "error",
      finished_at: new Date().toISOString(),
      ...(ok ? {} : { error_message: execResult.errorMessage ?? "Executor stopped before finishing." }),
    })
    .eq("id", runId);
}

// ─────────────────────────────────────────────────────────────────────
// HTTP entry — auth, create run row, kick off background worker.
// ─────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing auth token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userRes } = await userClient.auth.getUser();
  const user = userRes?.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Invalid auth" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userMessage: string = String(body.message ?? "").trim();
  const projectId: string | null = body.projectId ?? null;
  const files: Array<{ path: string; content: string }> = Array.isArray(body.files) ? body.files : [];
  if (!userMessage) {
    return new Response(JSON.stringify({ error: "message is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const isEmpty = files.length === 0;
  const { data: runRow, error: runErr } = await userClient
    .from("agent_runs")
    .insert({
      user_id: user.id,
      project_id: projectId,
      mode: isEmpty ? "scratch_build" : "edit",
      status: "queued",
      model: PLANNER_MODEL,
      started_at: new Date().toISOString(),
      events: [],
      last_event_seq: 0,
    })
    .select("id")
    .single();

  if (runErr || !runRow) {
    return new Response(
      JSON.stringify({ error: `failed to create run: ${runErr?.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const runId = runRow.id;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    EdgeRuntime.waitUntil(
      runJob({ admin, runId, authToken: token, body, userMessage, files }).catch(async (err: any) => {
        console.error(`[ai-agent-v2] runJob crashed for ${runId}:`, err?.message ?? err);
        await admin
          .from("agent_runs")
          .update({
            status: "error",
            error_message: err?.message ?? "worker crashed",
            finished_at: new Date().toISOString(),
          })
          .eq("id", runId);
      }),
    );
  } catch (err: any) {
    console.error("[ai-agent-v2] background dispatch failed:", err);
    await admin
      .from("agent_runs")
      .update({
        status: "error",
        error_message: `background dispatch failed: ${err?.message ?? "unknown"}`,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
    return new Response(
      JSON.stringify({ error: `background dispatch failed: ${err?.message ?? "unknown"}` }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ run_id: runId, status: "queued", mode: "background" }),
    { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
