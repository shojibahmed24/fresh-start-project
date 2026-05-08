// ═══════════════════════════════════════════════════════════════════════════
// HANDLER — main agent turn loop
// ───────────────────────────────────────────────────────────────────────────
// Owns the iteration loop:
//   1. Build per-iter system prompt + select tool subset
//   2. Stream LLM response (with Grok fallback on failure)
//   3. Execute returned tool calls (parallel when safe, sequential for ask_user)
//   4. Auto-fix + auto-validate written files; force a heal iteration if dirty
//   5. Final-validate when LLM stops; emit `done` or another heal cycle
//
// All loop-level guards live here:
//   • per-file write/heal counters → catches truncated-output rewrite loops
//   • global consecutive-write counter → catches "rotating file set" loops
//   • per-turn write-tool-call cap → catches single-turn write floods
//   • forced tool category escalation → never lock the agent out of needed tool
// ═══════════════════════════════════════════════════════════════════════════

import {
  GATEWAY,
  GROK_FALLBACK_MODEL,
  MAX_LOOP_ITERATIONS,
  LLM_FIRST_EVENT_TIMEOUT_MS,
  LLM_IDLE_NOTICE_MS,
  MAX_AUTO_HEAL,
  CHECKPOINT_MAX_ITERATIONS,
  CHECKPOINT_MAX_ELAPSED_MS,
  ESCALATION_MODEL_1,
  ESCALATION_MODEL_2,
  MAX_ESCALATION_ROUNDS,
} from "../config.ts";
import { buildSystemPrompt } from "../prompts.ts";
import type { ToolContext, AutoFix } from "../types.ts";
import {
  normalizePath,
  stripStringsAndComments,
  bracketDelta,
  jsxTagDelta,
  requiresDefaultExport,
} from "../validation/parsers.ts";
import { validateProject } from "../validation/checks.ts";
import { autoFixBatch } from "../autofix.ts";
import { classifyRuntimeError } from "../quality-gates.ts";
import { execTool } from "../tools/exec/index.ts";
import { callLLM, consumeLLMStream } from "../llm/client.ts";
import { type Intent, classifyIntent, selectTools, TOOL_CATEGORY } from "../llm/tool-selection.ts";

export type TurnLoopOpts = {
  ctx: ToolContext;
  conversation: any[];
  apiKey: string;
  model: string;
  userMessage: string;
  isEmptyProject: boolean;
  /** Pre-detected from project_memory — controls auto-backend prompt block. */
  autoBackend?: boolean;
  domainHint?: string;
  resumedHistory: any[];
  send: (event: any) => void;
  /**
   * Optional async hook fired when the loop hits the checkpoint guard. If
   * provided, the loop will await it and the hook is responsible for
   * persisting state + scheduling the background continuation. The hook
   * should return a continuation_id (string) which the loop will include
   * in the `paused` event so the client can switch to Realtime.
   */
  onCheckpoint?: (snapshot: {
    conversation: any[];
    filesChanged: string[];
    iter: number;
    elapsedMs: number;
  }) => Promise<string | null>;
  /** Current continuation attempt index (0 for the original turn). */
  continuationAttempt?: number;
};

export async function runTurnLoop(opts: TurnLoopOpts): Promise<void> {
  const { ctx, conversation, apiKey, model, userMessage, isEmptyProject, autoBackend, domainHint, resumedHistory, send, onCheckpoint, continuationAttempt = 0 } = opts;

  // Per-run heal/write counters
  let autoHealAttempts = 0;
  const perFileHealCount = new Map<string, number>();
  const suppressedFiles = new Set<string>();
  const perFileWriteCount = new Map<string, number>();
  // Per-file guard catches the REAL runaway pattern (same file rewritten over
  // and over). Per-turn batch caps are intentionally generous so legitimate
  // multi-page scratch builds (15–25 distinct components per PROMPT_SCRATCH_BUILD)
  // can land in 1-2 invocations instead of 4+ resumes that drift on design.
  // MAX_WRITES_PER_FILE = 5 lets legitimate split-then-fix-dependents flows
  // (1 write to split + 1 update of importers + 1 heal pass) finish without
  // hitting the suppression list.
  const MAX_WRITES_PER_FILE = 5;
  const MAX_WRITE_TOOL_CALLS_PER_TURN = 16;
  const MAX_BULK_WRITE_CALLS_PER_TURN = 10;
  const MAX_FILE_WRITES_PER_TURN = 60;
  let consecutiveBulkWriteTurns = 0;
  const MAX_CONSECUTIVE_BULK_WRITES = 8;
  let noToolForceCount = 0;

  // ── Escalation state ──────────────────────────────────────────────────
  // When MAX_AUTO_HEAL is hit and issues remain, automatically switch to a
  // stronger model and reset the heal budget. For no-code users who can't
  // fix issues manually — we keep trying with smarter models instead of
  // silently giving up.
  let escalationRound = 0; // 0 = original, 1 = ESCALATION_MODEL_1, 2 = ESCALATION_MODEL_2, 3 = splitter pass on original
  let currentModel = model;
  // Per-round approach hint surfaced via `lastEscalationHint` and consumed by
  // the next heal prompt. Each round forces a DIFFERENT strategy so we don't
  // just throw the same problem at the same kind of model again.
  let lastEscalationHint = "";

  // ── Same-error loop detector ─────────────────────────────────────────
  // Track signatures of recent validation failures. If the SAME signature
  // (same set of file:problem pairs) shows up 2 times in a row, we know the
  // current strategy is not converging on this context — force-escalate
  // immediately instead of burning the rest of the heal budget on the same
  // failed approach. Diversity > brute force.
  const recentIssueSignatures: string[] = [];
  const SAME_SIGNATURE_THRESHOLD = 2;
  const computeIssueSignature = (issues: Array<{ path: string; problem: string }>): string =>
    issues
      .map((i) => `${i.path}::${i.problem.slice(0, 80)}`)
      .sort()
      .join("|");
  const sameSignatureRepeats = (sig: string): number => {
    let n = 0;
    for (let k = recentIssueSignatures.length - 1; k >= 0; k--) {
      if (recentIssueSignatures[k] === sig) n++;
      else break;
    }
    return n;
  };

  // Files repeatedly flagged across attempts — round 3 will DELETE these and
  // force a clean rewrite from scratch instead of patching the same broken
  // surface again.
  const chronicallyFailing = new Set<string>();
  const APPROACH_HINTS: Record<number, string> = {
    1:
      "STRATEGY SWITCH — surgical mode. Stop rewriting whole files. For every remaining issue:\n" +
      "  • Use `edit_file` (search_replace) to patch ONLY the broken region.\n" +
      "  • If a file is >400 lines, FIRST extract a sub-component into a NEW small file via bulk_write_files, THEN search_replace the import in the original.\n" +
      "  • Read the affected file with read_file ONCE if you don't already have it cached.\n" +
      "  • Fix every listed issue in this single pass.",
    2:
      "STRATEGY SWITCH — splitter mode. The previous attempts failed because files are too large for one model response.\n" +
      "  • For every file >300 lines, split it into 2-3 smaller files (one per logical section) using bulk_write_files in ONE batch.\n" +
      "  • Then search_replace the original to import the new files and remove the moved code.\n" +
      "  • Do NOT touch files that already validate clean.\n" +
      "  • Aim for: every file <250 lines, single responsibility.",
    3:
      "STRATEGY SWITCH — clean-room rewrite mode. The same errors keep coming back because we keep PATCHING the same broken file. Stop patching.\n" +
      "  • For each chronically-failing file listed below, DELETE it (delete_file tool) and re-create it from scratch with bulk_write_files in ONE batch.\n" +
      "  • Use ONLY these proven imports: react, react-router-dom, lucide-react, @/components/ui/*, framer-motion, sonner, the project's own relative paths. Do NOT introduce new packages.\n" +
      "  • Keep every new file under 200 lines, single-responsibility.\n" +
      "  • Re-read any importing file BEFORE rewriting so the new export shape matches what callers expect (default vs named export, prop names).\n" +
      "  • Do NOT touch files that already validate clean.\n" +
      "  • If a file's purpose is unclear after deletion, inline a minimal stub at the call-site instead of rebuilding it.",
  };
  const tryEscalate = (reason: string): boolean => {
    if (escalationRound >= MAX_ESCALATION_ROUNDS) return false;
    escalationRound++;
    // Round 3 returns to the original model with a hard "minimal-fix" hint —
    // sometimes the issue is approach, not capability.
    const nextModel = escalationRound === 1
      ? ESCALATION_MODEL_1
      : escalationRound === 2
      ? ESCALATION_MODEL_2
      : model;
    const prevModel = currentModel;
    currentModel = nextModel;
    autoHealAttempts = 0;
    perFileHealCount.clear();
    suppressedFiles.clear();
    // Reset signature buffer too — a fresh model deserves a clean slate before
    // we accuse it of looping.
    recentIssueSignatures.length = 0;
    lastEscalationHint = APPROACH_HINTS[escalationRound] ?? "";
    console.log(
      `[ai-agent] ESCALATING model ${prevModel} → ${nextModel} (round ${escalationRound}/${MAX_ESCALATION_ROUNDS}) reason=${reason}`,
    );
    send({
      type: "escalation",
      round: escalationRound,
      from_model: prevModel,
      to_model: nextModel,
      reason,
    });
    return true;
  };

  // Wall-clock checkpoint guard. Supabase edge functions get killed at the
  // platform's soft limit (~150s) without warning. We checkpoint at 100s
  // OR after CHECKPOINT_MAX_ITERATIONS (whichever comes first) and ask the
  // client to auto-resume in a fresh invocation, preserving full state via
  // the `paused` event (history echo).
  const turnStartedAt = Date.now();
  const checkpointAndPause = async (iter: number, reason: "iter" | "time"): Promise<void> => {
    const elapsedMs = Date.now() - turnStartedAt;
    const historyEcho = conversation.slice(1); // drop system prompt
    let continuationId: string | null = null;
    if (onCheckpoint) {
      try {
        continuationId = await onCheckpoint({
          conversation: historyEcho,
          filesChanged: ctx.filesChanged,
          iter,
          elapsedMs,
        });
      } catch (e) {
        console.error("[ai-agent] onCheckpoint hook failed:", e);
      }
    }
    console.log(
      `[ai-agent] CHECKPOINT (${reason}) at iter=${iter} elapsed=${Math.round(elapsedMs / 1000)}s, continuation=${continuationId ?? "none"}`,
    );
    send({
      type: "paused",
      reason: continuationId ? "background_continuation" : "time_budget",
      checkpoint_reason: reason,
      iter,
      elapsed_ms: elapsedMs,
      files_changed: ctx.filesChanged,
      // Only echo conversation when there's no continuation_id (legacy
      // client-driven resume path). With a continuation_id the server already
      // has the conversation in DB and the client just subscribes via Realtime.
      ...(continuationId
        ? { continuation_id: continuationId, mode: "background", attempt: continuationAttempt + 1 }
        : { history: historyEcho }),
    });
  };


  // Classify the user's intent ONCE — drives tool subsetting per iter.
  // On RESUME the current `userMessage` is usually an auto-generated
  // "continue" string with no signal at all → intent would be empty and
  // backend/deps/debug tools would be wrongly hidden. To avoid that we also
  // mine the prior user messages in `resumedHistory` and union the flags.
  // As a final safety net: on any resume, force backend/deps/research/debug
  // ON regardless — the original turn could have been about anything and
  // locking the model out of db_migration / add_dependency mid-build is
  // worse than sending a few extra tool defs.
  const priorUserText = (resumedHistory || [])
    .filter((m: any) => m && m.role === "user")
    .map((m: any) => typeof m.content === "string" ? m.content : JSON.stringify(m.content))
    .join("\n");
  const baseIntent: Intent = classifyIntent(userMessage);
  const intent: Intent = priorUserText
    ? (() => {
        const prior = classifyIntent(priorUserText);
        return {
          backend: baseIntent.backend || prior.backend || true,
          deps: baseIntent.deps || prior.deps,
          debug: baseIntent.debug || prior.debug,
          destructive: baseIntent.destructive || prior.destructive,
          ambiguous: baseIntent.ambiguous && prior.ambiguous,
          uiOnly: baseIntent.uiOnly && prior.uiOnly,
          research: baseIntent.research || prior.research || true,
          assets: baseIntent.assets || prior.assets,
        };
      })()
    : baseIntent;
  const forcedCategories = new Set<string>();
  console.log(
    `[ai-agent] intent: backend=${intent.backend} deps=${intent.deps} debug=${intent.debug} destructive=${intent.destructive} ambiguous=${intent.ambiguous} uiOnly=${intent.uiOnly} (resume=${resumedHistory.length > 0})`,
  );

  // ── Auto-feed runtime/console errors on bug-report intent ─────────────
  // Heuristic trigger: explicit debug intent OR common "it's broken" phrases
  // in any language we routinely see (English + Bangla romanised). Without
  // this, the model only sees runtime errors if it remembers to call
  // read_console_logs — which it usually skips. We fetch the last 10 captured
  // errors for this project and prepend them as a [RUNTIME ERRORS] block to
  // the user message so the model has the real failure on iter 0.
  const brokenPhrase = /\b(doesn'?t work|not working|broken|blank|crash(?:es|ed)?|error|exception|fail(?:s|ed|ing)?|stuck|kaj kore na|kaaj kore na|hocche na|hochhe na|kaj korche na|somossa|problem|bug|issue|white screen|blank screen)\b/i;
  if (intent.debug || brokenPhrase.test(userMessage)) {
    try {
      const { data: recentErrs } = await ctx.supabase
        .from("project_error_history")
        .select("file_path, error_message, created_at")
        .eq("project_id", ctx.projectId)
        .order("created_at", { ascending: false })
        .limit(10);
      const rows = (recentErrs ?? []) as any[];
      if (rows.length > 0) {
        const lines = rows.map((e) => {
          const hint = classifyRuntimeError(e.error_message);
          const where = e.file_path ? ` [${e.file_path}]` : "";
          const hintTxt = hint ? `\n   → ${hint}` : "";
          return `• ${String(e.error_message || "").slice(0, 240)}${where}${hintTxt}`;
        }).join("\n");
        const block = `\n\n[RUNTIME ERRORS — auto-attached because the message looks like a bug report. Fix these FIRST before any other work.]\n${lines}`;
        // Append to the most recent user message in the conversation.
        for (let i = conversation.length - 1; i >= 0; i--) {
          if (conversation[i]?.role === "user") {
            const c = conversation[i].content;
            conversation[i].content = (typeof c === "string" ? c : JSON.stringify(c)) + block;
            break;
          }
        }
        console.log(`[ai-agent] auto-fed ${rows.length} runtime errors into turn (debug intent / broken phrase)`);
      }
    } catch (_) { /* non-fatal */ }
  }


  // ── Priority 3: Context block lifecycle ─────────────────────────
  // The big context block (file tree + memory + error history) was
  // injected into the first user message of this turn. It can be
  // 2-5k tokens and gets re-sent on every iteration. After the model
  // has had a few iterations to absorb it, we replace that first user
  // message with a slim stub and append a fresh DELTA refresh listing
  // only what changed (new files written, new auto-heal issues seen).
  const isFreshTurn = resumedHistory.length === 0;
  const firstUserIdx = conversation.length - 1; // last entry pushed
  const originalFirstUser = isFreshTurn ? conversation[firstUserIdx] : null;
  let contextStripped = false;
  let lastRefreshedFileCount = 0;
  const REFRESH_EVERY = 3;
  // Don't strip the original context block (which carries the file tree)
  // until iter ≥ STRIP_AFTER_ITER AND the model is no longer actively
  // writing files in this stretch. Without the file tree the model guesses
  // relative import paths and they fail. We track "writes since last strip
  // check" via lastWriteIterRef set lower in the loop.

  for (let iter = 0; iter < MAX_LOOP_ITERATIONS; iter++) {
    // Checkpoint guard — fire BEFORE iteration event so client knows the
    // previous iteration was the last one in this invocation. We require at
    // least 1 iteration to have completed so we never checkpoint immediately
    // on resume (would create an infinite resume loop).
    const elapsedMs = Date.now() - turnStartedAt;
    if (
      iter > 0 &&
      (iter >= CHECKPOINT_MAX_ITERATIONS || elapsedMs >= CHECKPOINT_MAX_ELAPSED_MS)
    ) {
      await checkpointAndPause(iter, iter >= CHECKPOINT_MAX_ITERATIONS ? "iter" : "time");
      return;
    }

    send({ type: "iteration", n: iter + 1 });

    const toolsForIter = selectTools(intent, iter, ctx, forcedCategories);

    // Per-iter system prompt (Priority 2): full guidance only on iter 0;
    // middle iters carry just CORE+MEMORY; only re-add FINAL_FORMAT in
    // the last few iters so wrap-up rules are present.
    // IMPORTANT: keep this DETERMINISTIC (function of `iter` only) so the
    // system prompt prefix stays byte-identical across mid-iters → Claude
    // cache_control prefix stays valid → cache_read_input_tokens > 0.
    const finalLikely = iter >= MAX_LOOP_ITERATIONS - 3;
    const isResume = resumedHistory.length > 0;
    conversation[0] = {
      role: "system",
      content: buildSystemPrompt({
        iter,
        isEmpty: isEmptyProject,
        finalLikely,
        domainHint,
        hasAttachments: Array.isArray(ctx.attachments) && ctx.attachments.length > 0,
        autoBackend,
        isResume,
      }),
    };

    // Priority 3: Strip the original context block (file tree + memory +
    // error history) only AFTER the model has had time to absorb it AND is
    // no longer actively writing files. While the model is still writing,
    // it needs the file tree so relative imports resolve — stripping early
    // makes it guess paths and they fail. Once strip happens, every
    // REFRESH_EVERY iters we append a delta listing of newly changed files.
    const writingActively =
      ctx.filesChanged.length > lastRefreshedFileCount;
    if (
      isFreshTurn &&
      originalFirstUser &&
      iter > 0 &&
      iter % REFRESH_EVERY === 0
    ) {
      if (!contextStripped && iter >= REFRESH_EVERY * 2 && !writingActively) {
        conversation[firstUserIdx] = {
          role: "user",
          content:
            `[Context block (file tree + memory + error history) shown earlier in this turn — trimmed to save tokens. The original request follows.]\n\n${userMessage}`,
        };
        contextStripped = true;
        console.log(`[ai-agent] iter ${iter}: stripped context block (no active writes)`);
      }
      const newChanges = ctx.filesChanged.slice(lastRefreshedFileCount);
      if (newChanges.length > 0) {
        const lines = newChanges.slice(0, 30).map((c) => `  • ${c.action}: ${c.path}`);
        const more = newChanges.length > 30 ? `\n  … +${newChanges.length - 30} more` : "";
        // After strip, also re-list the full set of project file paths so
        // the model can still resolve relative imports without the original
        // context block.
        let fileTreeBlock = "";
        if (contextStripped) {
          try {
            const { data: allFiles } = await ctx.supabase
              .from("project_files")
              .select("path")
              .eq("project_id", ctx.projectId);
            const paths = (allFiles ?? []).map((r: any) => r.path).sort();
            const shown = paths.slice(0, 200);
            fileTreeBlock =
              `\n\nCurrent project files (${paths.length}${paths.length > shown.length ? `, showing first ${shown.length}` : ""}):\n` +
              shown.map((p: string) => `  • ${p}`).join("\n");
          } catch (_) { /* non-fatal */ }
        }
        conversation.push({
          role: "user",
          content:
            `[Context refresh — files changed since the last refresh (${newChanges.length} total):\n${lines.join("\n")}${more}]${fileTreeBlock}`,
        });
        lastRefreshedFileCount = ctx.filesChanged.length;
        console.log(`[ai-agent] iter ${iter}: injected delta refresh (${newChanges.length} changes, fileTree=${contextStripped})`);
      }
    }

    // Stream this iteration so token-level deltas reach the UI as the
    // model thinks. We still aggregate the full message at the end so
    // the rest of the loop sees the same shape it did before.
    let activeModel = currentModel;
    let resp: Response;
    try {
      resp = await callLLM(conversation, apiKey, activeModel, true, toolsForIter);
    } catch (requestErr: any) {
      const nextModel = activeModel === GROK_FALLBACK_MODEL ? ESCALATION_MODEL_1 : GROK_FALLBACK_MODEL;
      console.warn(`[ai-agent] model request failed before streaming on ${activeModel}; forcing retry on ${nextModel}:`, requestErr?.message ?? requestErr);
      send({ type: "thinking", text: `Model did not start reliably, forcing a fresh executor pass with ${nextModel}…` });
      conversation.push({
        role: "user",
        content:
          `[RECOVERY: The previous model request did not start. Continue immediately with tool calls. ` +
          `If files must change, read only the necessary file(s), then use edit_file/write_file/bulk_write_files. Do not wait or only explain.]`,
      });
      activeModel = nextModel;
      try {
        resp = await callLLM(conversation, apiKey, activeModel, true, toolsForIter);
      } catch (retryErr: any) {
        console.error("LLM retry request failed:", retryErr);
        send({ type: "error", message: `AI model did not start after forced retry: ${retryErr?.message || "unknown"}` });
        break;
      }
    }

    if (!resp.ok && /^x-ai\/grok-4\.1-fast$/i.test(activeModel)) {
      const txt = await resp.text().catch(() => "");
      console.error("Grok gateway error, falling back:", resp.status, txt);
      send({ type: "thinking", text: "Grok did not start reliably, switching executor model…" });
      activeModel = GROK_FALLBACK_MODEL;
      resp = await callLLM(conversation, apiKey, activeModel, true, toolsForIter);
    }

    if (resp.status === 429) {
      send({ type: "error", message: "Rate limit reached. Please wait a moment and try again." });
      break;
    }
    if (resp.status === 402) {
      send({ type: "error", message: "AI credits exhausted. Top up at Lovable workspace settings." });
      break;
    }
    if (!resp.ok) {
      const txt = await resp.text();
      console.error("LLM gateway error:", resp.status, txt);
      send({ type: "error", message: `AI gateway error (${resp.status})` });
      break;
    }

    let textContent = "";
    let toolCalls: any[] = [];
    try {
      let sawVisibleOutput = false;
      const assembled = await consumeLLMStream(resp, (delta) => {
        sawVisibleOutput = true;
        send({ type: "thinking", text: delta });
      }, (elapsedMs) => {
        send({
          type: "thinking",
          text: sawVisibleOutput
            ? "\nStill waiting for the model to continue…"
            : `Waiting for ${activeModel} to start code generation (${Math.round(elapsedMs / 1000)}s)…`,
        });
      }, { firstEventTimeoutMs: LLM_FIRST_EVENT_TIMEOUT_MS, idleNoticeMs: LLM_IDLE_NOTICE_MS });
      textContent = assembled.content;
      toolCalls = assembled.tool_calls;
    } catch (streamErr: any) {
      const streamMessage = String(streamErr?.message ?? "");
      const idleStream = /No model stream events|No further model stream events|stream body timed out/i.test(streamMessage);
      if (idleStream) {
        const retryModel = /^x-ai\/grok-4\.1-fast$/i.test(activeModel) ? GROK_FALLBACK_MODEL : ESCALATION_MODEL_1;
        send({ type: "thinking", text: `Model stayed idle, forcing a fresh code-writing pass with ${retryModel}…` });
        conversation.push({
          role: "user",
          content:
            `[RECOVERY: The previous model stream went idle before making progress (${streamMessage}). ` +
            `Continue immediately. Do not wait, do not only explain. Use the available tools now; for code changes call read_file only when needed, then edit_file/write_file/bulk_write_files.]`,
        });
        activeModel = retryModel;
        try {
          const retryResp = await callLLM(conversation, apiKey, activeModel, true, toolsForIter);
          if (retryResp.ok) {
            let sawRetryOutput = false;
            const retryAssembled = await consumeLLMStream(retryResp, (delta) => {
              sawRetryOutput = true;
              send({ type: "thinking", text: delta });
            }, (elapsedMs) => {
              send({ type: "thinking", text: sawRetryOutput ? "\nStill waiting for the model to continue…" : `Waiting for ${activeModel} to start code generation (${Math.round(elapsedMs / 1000)}s)…` });
            }, { firstEventTimeoutMs: LLM_FIRST_EVENT_TIMEOUT_MS, idleNoticeMs: LLM_IDLE_NOTICE_MS });
            textContent = retryAssembled.content;
            toolCalls = retryAssembled.tool_calls;
          } else {
            const txt = await retryResp.text().catch(() => "");
            console.error("Fallback gateway error:", retryResp.status, txt);
            send({ type: "error", message: `AI gateway error (${retryResp.status})` });
            break;
          }
        } catch (retryStreamErr: any) {
          console.error("forced retry stream failed:", retryStreamErr);
          send({ type: "error", message: `AI stayed idle after forced retry: ${retryStreamErr?.message || "unknown"}` });
          break;
        }
      } else {
        console.error("stream consume error:", streamErr);
        send({ type: "error", message: `AI stream interrupted: ${streamErr?.message || "unknown"}` });
        break;
      }
    }

    // No tool calls → agent thinks it's done. Run ONE final full-project
    // validation as a safety net. If issues remain and we still have
    // self-heal budget, force one more iteration.
    if (toolCalls.length === 0) {
      const requestNeedsFileWork =
        isEmptyProject ||
        /\b(build|create|make|add|change|fix|update|edit|remove|implement|design|solve)\b|\b(koro|korbo|banai|banao|toiri|thik)\b/i.test(userMessage);
      if (ctx.filesChanged.length === 0 && requestNeedsFileWork && noToolForceCount < 2) {
        noToolForceCount++;
        conversation.push({ role: "assistant", content: textContent || "I need to act on the project files." });
        conversation.push({
          role: "user",
          content:
            `[NO FILE WORK DETECTED — this is a build/edit request, but you did not call any tools and no files changed. ` +
            `Start working now: inspect only the necessary files, then call edit_file/write_file/bulk_write_files. ` +
            `Do not provide a final summary until at least one project file has been changed or you have asked the user a blocking question with ask_user.]`,
        });
        send({ type: "thinking", text: "No code changes detected yet, forcing the agent to start editing files…" });
        continue;
      }
      if (ctx.filesChanged.length > 0) {
        const finalCheck = await validateProject(ctx);
        const liveIssues = finalCheck.issues.filter((i) => !suppressedFiles.has(i.path));
        if (!finalCheck.ok && liveIssues.length > 0) {
          // Track repeats — same set of issues twice means current strategy
          // is stuck on this context; force escalation early.
          const sig = computeIssueSignature(liveIssues);
          recentIssueSignatures.push(sig);
          if (recentIssueSignatures.length > 6) recentIssueSignatures.shift();
          const repeats = sameSignatureRepeats(sig);
          // Files seen in 2+ consecutive identical signatures get marked chronic.
          if (repeats >= 2) {
            for (const i of liveIssues) chronicallyFailing.add(i.path);
          }
          const stuckOnSameError =
            repeats >= SAME_SIGNATURE_THRESHOLD &&
            autoHealAttempts >= 3 &&
            escalationRound < MAX_ESCALATION_ROUNDS;
          // Heal budget exhausted on this model? Try escalating to a stronger
          // model with a fresh budget instead of silently giving up.
          if (autoHealAttempts >= MAX_AUTO_HEAL || stuckOnSameError) {
            const escalateReason = stuckOnSameError
              ? `same error signature repeated ${repeats}× — strategy not converging`
              : `final-check ${liveIssues.length} issues remain`;
            if (tryEscalate(escalateReason)) {
              const chronicBlock = chronicallyFailing.size > 0
                ? `\n\nFiles flagged repeatedly across attempts (treat as CHRONICALLY FAILING — apply the strategy below specifically to them):\n${[...chronicallyFailing].slice(0, 8).map((p) => `  • ${p}`).join("\n")}`
                : "";
              conversation.push({ role: "assistant", content: textContent });
              conversation.push({
                role: "user",
                content:
                  `[ESCALATION round ${escalationRound}/${MAX_ESCALATION_ROUNDS} → ${currentModel}. ` +
                  `Reason: ${escalateReason}. Fresh budget: ${MAX_AUTO_HEAL} attempts for ${liveIssues.length} remaining issue(s).\n\n` +
                  `${lastEscalationHint}${chronicBlock}\n\n` +
                  `Apply the strategy above to every listed issue, then re-validate. Do NOT repeat the previous patch attempt — the same fix has already failed ${repeats}× on the same lines.]`,
              });
              continue;
            }
            // No more escalation rounds — emit a friendly user-facing message
            // instead of dumping technical errors on a no-code user.
            const friendlySummary =
              `${textContent}\n\n` +
              `> ⚠️ I tried multiple approaches with stronger models but a few automated checks are still flagging issues. ` +
              `The app should still work — try a refresh and let me know what you see. ` +
              `If something looks broken, describe it and I'll take a different angle.`;
            conversation.push({ role: "assistant", content: friendlySummary });
            send({ type: "done", summary: friendlySummary, files_changed: ctx.filesChanged });
            break;
          }

          for (const i of liveIssues) {
            const next = (perFileHealCount.get(i.path) ?? 0) + 1;
            perFileHealCount.set(i.path, next);
            if (next >= MAX_AUTO_HEAL) {
              suppressedFiles.add(i.path);
              console.log(`[ai-agent] suppressing validator for ${i.path} after ${next} failed heal attempts (likely false positive)`);
              // Tell the user — silent suppression is the worst outcome.
              send({
                type: "thinking",
                text: `⚠️ ${i.path} could not be auto-healed after ${next} attempts. The file is saved but may have issues — review it manually if behaviour is off.`,
              });
            }
          }
          autoHealAttempts++;
          const issueText = liveIssues
            .slice(0, 12)
            .map((i) => {
              const sev = i.severity === "warn" ? "⚠️" : "❌";
              const hint = i.hint ? `\n   → ${i.hint}` : "";
              return `${sev} ${i.path}: ${i.problem}${hint}`;
            })
            .join("\n");
          send({
            type: "auto_verify",
            ok: false,
            checked: finalCheck.checked,
            issue_count: liveIssues.length,
            attempt: autoHealAttempts,
            final: true,
            issues: liveIssues.slice(0, 12).map((i) => ({ path: i.path, problem: i.problem, severity: i.severity })),
          });
          conversation.push({ role: "assistant", content: textContent });
          conversation.push({
            role: "user",
            content:
              `[Final validation failed (attempt ${autoHealAttempts}/${MAX_AUTO_HEAL}). ` +
              `${liveIssues.length} issue(s) across the project:\n\n${issueText}\n\n` +
              `Fix these now with write_file before finishing. Do NOT write a final summary yet.]`,
          });
          continue;
        }
      }
      conversation.push({ role: "assistant", content: textContent });
      send({ type: "done", summary: textContent, files_changed: ctx.filesChanged });
      break;
    }

    // Push the assistant's tool-call message into the conversation EXACTLY as
    // the LLM returned it (required by the OpenAI tool-calling spec — tool
    // results must reference these tool_call ids).
    conversation.push({ role: "assistant", content: textContent || null, tool_calls: toolCalls });

    // Pre-compute call ids + parsed args so we can fire the safe ones in
    // parallel. ask_user is the only tool that pauses the loop, so it MUST
    // run alone — if any tool call in this batch is ask_user, fall back to
    // sequential execution to preserve correctness.
    const prepared = toolCalls.map((tc) => {
      const callId: string = tc.id ?? crypto.randomUUID();
      const fnName: string = tc.function?.name ?? "";
      let args: any = {};
      try {
        args = JSON.parse(tc.function?.arguments ?? "{}");
      } catch (e) {
        console.error("tool args parse error", e, tc.function?.arguments);
      }
      return { tc, callId, fnName, args };
    });

    // Abort pathological single-turn write floods before executing them.
    const writePrepared = prepared.filter((p) => p.fnName === "write_file" || p.fnName === "bulk_write_files");
    const bulkPrepared = prepared.filter((p) => p.fnName === "bulk_write_files");
    const fileWriteCountThisBatch = writePrepared.reduce((sum, p) => {
      if (p.fnName === "write_file") return sum + 1;
      return sum + (Array.isArray(p.args?.files) ? p.args.files.length : 0);
    }, 0);
    if (
      writePrepared.length > MAX_WRITE_TOOL_CALLS_PER_TURN ||
      bulkPrepared.length > MAX_BULK_WRITE_CALLS_PER_TURN ||
      fileWriteCountThisBatch > MAX_FILE_WRITES_PER_TURN
    ) {
      const msg = `Stopped: the model attempted ${writePrepared.length} write tool calls (${bulkPrepared.length} bulk_write_files, ${fileWriteCountThisBatch} files) in one turn. This is a runaway bulk-write loop, so no more writes were executed. Please retry with a smaller scope or a stronger model.`;
      console.warn(`[ai-agent] ${msg}`);
      send({ type: "error", message: msg });
      break;
    }

    // ── Design guidelines enforcement (scratch builds only) ────────────────
    // PROMPT_SCRATCH_BUILD step 0.5 REQUIRES the agent to call
    // `write_memory({ key: "design/guidelines", ... })` BEFORE the first
    // write_file. Without it, edit-mode runs lose palette/typography/mood
    // and the app drifts. Check the project_memory table — if missing AND
    // this batch wants to write files, intercept and inject a corrective
    // tool result so the model writes memory first, then retries the writes.
    if (
      isEmptyProject &&
      writePrepared.length > 0 &&
      ctx.filesChanged.length === 0 &&
      !(ctx as any).__designGuidelinesChecked
    ) {
      (ctx as any).__designGuidelinesChecked = true;
      const { data: memRow } = await ctx.supabase
        .from("project_memory")
        .select("id")
        .eq("project_id", ctx.projectId)
        .eq("category", "agent:design/guidelines")
        .eq("source", "agent")
        .maybeSingle();
      const wroteMemoryThisBatch = prepared.some(
        (p) => p.fnName === "write_memory" && p.args?.key === "design/guidelines",
      );
      if (!memRow && !wroteMemoryThisBatch) {
        console.warn(
          "[ai-agent] DESIGN-GUIDELINES MISSING — intercepting first write batch to force memory write",
        );
        // Push the assistant message + synthetic tool error results so the
        // model sees its writes were rejected with a clear corrective hint.
        conversation.push({
          role: "assistant",
          content: textContent || null,
          tool_calls: toolCalls,
        });
        for (const p of prepared) {
          conversation.push({
            role: "tool",
            tool_call_id: p.callId,
            content: JSON.stringify({
              error:
                "BLOCKED: scratch build cannot write files until design guidelines are saved to memory.",
              required_action:
                "Call write_memory({ key: 'design/guidelines', value: '<JSON: archetype, mood, direction, palette, typography, radius, signature, notes>' }) FIRST in your next tool batch, then re-issue your write_file/bulk_write_files calls. This is mandatory per PROMPT_SCRATCH_BUILD step 0.5.",
            }),
          });
        }
        conversation.push({
          role: "user",
          content:
            `[ENFORCEMENT — design/guidelines memory not found.\n` +
            `Before ANY write_file in a scratch build you MUST call write_memory with key "design/guidelines".\n` +
            `Value MUST be a JSON string with: archetype, mood, direction, palette {primary, accent, bg, gradient}, typography {display, body}, radius, signature, notes.\n` +
            `Once saved, immediately re-issue the write_file / bulk_write_files calls you just attempted.]`,
        });
        send({
          type: "thinking",
          text:
            "⚠️ Design guidelines memory missing — blocking first write batch and asking the model to save design tokens first.",
        });
        continue; // restart the iteration with the correction in place
      }
    }


    // UI noise guard: models sometimes call read_file for the same path
    // repeatedly. The LLM still gets a valid tool result for every call_id,
    // but the timeline only shows the first visible read per path.
    const visibleToolIds = new Set<string>();
    const batchReadPaths = new Set<string>();
    let hasDuplicateReadPath = false;
    for (const p of prepared) {
      if (p.fnName !== "read_file" || typeof p.args?.path !== "string") {
        visibleToolIds.add(p.callId);
        continue;
      }
      const norm = normalizePath(p.args.path);
      if (batchReadPaths.has(norm)) hasDuplicateReadPath = true;
      const alreadyRead = ctx.readCache.has(norm) || batchReadPaths.has(norm);
      if (!alreadyRead) visibleToolIds.add(p.callId);
      batchReadPaths.add(norm);
    }

    // Escalation: if the model invoked any tool whose category was NOT
    // exposed this iteration, add that category to forcedCategories so
    // subsequent iterations include it.
    for (const p of prepared) {
      const cat = TOOL_CATEGORY[p.fnName];
      if (cat && !forcedCategories.has(cat)) {
        const exposed = toolsForIter.some((t) => t.function.name === p.fnName);
        if (!exposed) {
          forcedCategories.add(cat);
          console.log(`[ai-agent] escalating tool category "${cat}" (model called ${p.fnName})`);
        }
      }
    }

    // Any tool that pauses the loop must run alone.
    const PAUSING_TOOLS = new Set([
      "ask_user",
      "request_file_upload",
      "request_confirmation",
      "request_secret",
      "delete_secret",
    ]);
    const hasAskUser = prepared.some((p) => PAUSING_TOOLS.has(p.fnName));
    let pausedForUser = false;

    if (!hasAskUser && prepared.length > 1 && !hasDuplicateReadPath) {
      // Parallel path — emit all tool_call events first so the UI shows
      // every pending row, then run them concurrently.
      for (const p of prepared) {
        if (visibleToolIds.has(p.callId)) {
          send({ type: "tool_call", id: p.callId, name: p.fnName, args: p.args });
        }
      }
      const results = await Promise.all(
        prepared.map((p) => execTool(p.fnName, p.args, ctx, p.callId)),
      );
      for (let i = 0; i < prepared.length; i++) {
        const p = prepared[i];
        const { result } = results[i];
        if (visibleToolIds.has(p.callId)) {
          send({ type: "tool_result", id: p.callId, name: p.fnName, result });
        }
        conversation.push({ role: "tool", tool_call_id: p.callId, content: JSON.stringify(result) });
        emitFileChangedEvents(p.fnName, result, send);
      }
    } else {
      // Sequential path — preserves ask_user pause semantics.
      for (const p of prepared) {
        if (visibleToolIds.has(p.callId)) {
          send({ type: "tool_call", id: p.callId, name: p.fnName, args: p.args });
        }
        const { result, askUser } = await execTool(p.fnName, p.args, ctx, p.callId);
        if (visibleToolIds.has(p.callId)) {
          send({ type: "tool_result", id: p.callId, name: p.fnName, result });
        }
        conversation.push({ role: "tool", tool_call_id: p.callId, content: JSON.stringify(result) });
        emitFileChangedEvents(p.fnName, result, send);
        if (askUser && ctx.pendingAsk) {
          send({
            type: "ask_user",
            id: ctx.pendingAsk.id,
            question: ctx.pendingAsk.question,
            options: ctx.pendingAsk.options,
            allow_other: ctx.pendingAsk.allow_other,
          });
          pausedForUser = true;
          break;
        }
      }
    }

    if (pausedForUser) {
      // Echo the full conversation (minus system prompt) so the client can
      // pass it back verbatim on resume. Preserves all tool_call_ids and
      // prevents the LLM from "forgetting" what it already did.
      const historyEcho = conversation.slice(1);
      console.log(`[ai-agent] PAUSED for ask_user, echoing ${historyEcho.length} messages`);
      send({ type: "paused", reason: "ask_user", files_changed: ctx.filesChanged, history: historyEcho });
      break;
    }

    // ── Auto-verify written files (silent self-heal) ───────────────
    const writtenThisTurn = prepared
      .flatMap((p) => p.fnName === "write_file"
        ? [p.args?.path]
        : p.fnName === "bulk_write_files" && Array.isArray(p.args?.files)
        ? p.args.files.map((f: any) => f?.path)
        : [])
      .filter((x): x is string => typeof x === "string");

    // Track per-file write count and abort runaway loops where the LLM
    // keeps re-writing the same file (truncated output / endless retry).
    let runawayFile: string | null = null;
    for (const path of writtenThisTurn) {
      const next = (perFileWriteCount.get(path) ?? 0) + 1;
      perFileWriteCount.set(path, next);
      if (next > MAX_WRITES_PER_FILE) runawayFile = path;
    }

    // ── Truncation-recovery (auto-fix for "rewrote N times" loops) ───────
    // BEFORE the hard runaway cap, check if the most-recently written file
    // shows TRUNCATION SIGNATURES (unbalanced braces / unclosed JSX / missing
    // export default — i.e. classic mid-stream cutoffs). If so, send a precise
    // CONTINUATION instruction with the file's tail so the model can resume
    // from the cutoff instead of starting another full rewrite (which will
    // truncate again at the same boundary).
    const repeatRewrites = writtenThisTurn.filter(
      (p) => {
        const c = perFileWriteCount.get(p) ?? 0;
        return c >= 2 && c <= MAX_WRITES_PER_FILE;
      },
    );
    if (repeatRewrites.length > 0 && !runawayFile) {
      const target = repeatRewrites[0];
      const count = perFileWriteCount.get(target) ?? 0;

      // Pull the current persisted content + check truncation signatures.
      let truncationSignal: { reason: string; tail: string } | null = null;
      try {
        const { data: row } = await ctx.supabase
          .from("project_files")
          .select("content")
          .eq("project_id", ctx.projectId)
          .eq("path", target)
          .maybeSingle();
        const content: string = row?.content ?? "";
        if (content.length > 0) {
          const scrubbed = stripStringsAndComments(content);
          const delta = bracketDelta(scrubbed);
          const jsxNeedsClose = /\.(tsx|jsx)$/.test(target) && /<[A-Za-z]/.test(scrubbed)
            ? jsxTagDelta(scrubbed)
            : 0;
          const needsDefault = requiresDefaultExport(target) && !/export\s+default\s/.test(scrubbed);
          const reasons: string[] = [];
          if (delta.curly > 0) reasons.push(`${delta.curly} unclosed '{'`);
          if (delta.round > 0) reasons.push(`${delta.round} unclosed '('`);
          if (delta.square > 0) reasons.push(`${delta.square} unclosed '['`);
          if (jsxNeedsClose > 0) reasons.push(`${jsxNeedsClose} unclosed JSX tag(s)`);
          if (needsDefault) reasons.push("missing `export default`");
          if (reasons.length > 0) {
            // Capture the last ~25 lines so the model knows EXACTLY where to resume.
            const lines = content.split("\n");
            const tailLines = lines.slice(Math.max(0, lines.length - 25));
            truncationSignal = {
              reason: reasons.join(", "),
              tail: tailLines.join("\n"),
            };
          }
        }
      } catch (_) { /* non-fatal — fall through to generic hint */ }

      if (truncationSignal) {
        // Precise continuation — far more effective than another full rewrite.
        conversation.push({
          role: "user",
          content:
            `[TRUNCATION DETECTED in ${target} — your previous output was cut off mid-stream by the response cap.\n` +
            `Signatures: ${truncationSignal.reason}.\n\n` +
            `Here are the LAST 25 lines currently saved (they are syntactically broken):\n` +
            "```tsx\n" + truncationSignal.tail + "\n```\n\n" +
            `RECOVERY INSTRUCTIONS — follow exactly:\n` +
            `  1. DO NOT rewrite the whole file again — it will truncate at the same boundary.\n` +
            `  2. Use \`search_replace\` on ${target} to surgically close the open structures and append the missing tail (closing brackets, missing JSX, default export, etc.).\n` +
            `  3. If a large block is genuinely missing (e.g. an entire function body), extract it into a NEW small file (< 200 lines) and import it — keep each write small enough to fit in one response.\n` +
            `  4. After fixing, do not re-run write_file on ${target}. Verify with read_file if needed.]`,
        });
        console.warn(`[ai-agent] truncation continuation injected for ${target} (reasons: ${truncationSignal.reason})`);
      } else {
        // No clear truncation signature — fall back to the original strategy-switch nudge.
        conversation.push({
          role: "system",
          content:
            `⚠️ STRATEGY SWITCH REQUIRED — you have rewritten ${target} ${count} time(s) without making progress. ` +
            `DO NOT call write_file on ${target} again. Instead:\n` +
            `  1. Call read_file on ${target} to see the current state.\n` +
            `  2. Use search_replace for the SPECIFIC broken region only — never rewrite the whole file.\n` +
            `  3. If the file is genuinely too large (> ~400 lines), split it: extract a sub-component into a new file, then search_replace the import.\n` +
            `Failing to switch strategies will trigger a hard abort on the next attempt.`,
        });
        console.warn(`[ai-agent] strategy-switch hint injected for ${target} (count=${count})`);
      }
    }

    if (runawayFile) {
      const msg = `Stopped: the model rewrote ${runawayFile} ${perFileWriteCount.get(runawayFile)} times without progress. The file output is likely being truncated. Try a smaller scope, or split the file.`;
      console.warn(`[ai-agent] ${msg}`);
      send({ type: "error", message: msg });
      break;
    }

    // Global rotation guard — increments on EVERY turn that wrote any file.
    // Reset when validator returns ok. If we exceed the cap, abort with an
    // actionable error instead of letting the loop spin.
    const wroteAnyFile = writtenThisTurn.length > 0;
    if (wroteAnyFile) {
      consecutiveBulkWriteTurns++;
      const repeatedFileSet = writtenThisTurn.length >= 3 &&
        writtenThisTurn.every((path) => (perFileWriteCount.get(path) ?? 0) >= 3);
      if (consecutiveBulkWriteTurns > MAX_CONSECUTIVE_BULK_WRITES || repeatedFileSet) {
        const rotated = [...new Set(writtenThisTurn)].slice(0, 5).join(", ");
        const reason = repeatedFileSet
          ? "rewrote the same file set repeatedly after type-checking"
          : `performed ${consecutiveBulkWriteTurns} consecutive write turns without the project validating cleanly`;
        const msg = `Stopped: the model ${reason} (rotating through: ${rotated}) using ${activeModel}. This is a repair loop. Try a smaller scope or switch model.`;
        console.warn(`[ai-agent] ${msg}`);
        send({ type: "error", message: msg });
        break;
      }
    }

    if (writtenThisTurn.length > 0) {
      // Phase 7 — Self-Healing: deterministic auto-fixes BEFORE asking the
      // LLM to repair. Handles missing imports, @/ aliases, missing default
      // export — without burning a costly LLM round-trip.
      let autoFixed: AutoFix[] = [];
      try {
        const af = await autoFixBatch(ctx, writtenThisTurn);
        autoFixed = af.fixes;
        if (autoFixed.length > 0) {
          console.log(
            `[ai-agent] auto-fix applied ${autoFixed.length} repair(s) across ${af.changedPaths.length} file(s):\n${
              autoFixed.map((f) => `  ✓ ${f.path}: ${f.fix}`).join("\n")
            }`,
          );
          send({ type: "auto_fix", count: autoFixed.length, changed_paths: af.changedPaths, fixes: autoFixed.slice(0, 20) });
        }
      } catch (afErr) {
        console.warn("[ai-agent] auto-fix engine failed:", afErr);
      }

      // Mini-validation scope:
      //   • Default: the files written THIS iteration (cheap, fast feedback).
      //   • Every 3rd write-batch in the same turn: expand to ALL files
      //     touched in this turn — catches drift where an earlier-edited
      //     file has now been broken by a later edit elsewhere.
      const allTouchedThisTurn = [...new Set(
        ctx.filesChanged
          .map((c) => c.path)
          .filter((p) => /\.(tsx?|jsx?|css)$/.test(p)),
      )];
      const expandScope = consecutiveBulkWriteTurns > 0 && consecutiveBulkWriteTurns % 3 === 0;
      const validateScope = expandScope && allTouchedThisTurn.length > 0
        ? allTouchedThisTurn
        : writtenThisTurn;
      if (expandScope) {
        console.log(`[ai-agent] mini-validation scope expanded to all ${validateScope.length} touched files (write-batch ${consecutiveBulkWriteTurns})`);
      }
      const v = await validateProject(ctx, validateScope);
      const liveIssues = v.issues.filter((i) => !suppressedFiles.has(i.path));
      if (!v.ok && liveIssues.length > 0) {
        // Same-error loop guard (mirrors the final-check path).
        const sig = computeIssueSignature(liveIssues);
        recentIssueSignatures.push(sig);
        if (recentIssueSignatures.length > 6) recentIssueSignatures.shift();
        const repeats = sameSignatureRepeats(sig);
        if (repeats >= 2) {
          for (const i of liveIssues) chronicallyFailing.add(i.path);
        }
        const stuckOnSameError =
          repeats >= SAME_SIGNATURE_THRESHOLD &&
          autoHealAttempts >= 3 &&
          escalationRound < MAX_ESCALATION_ROUNDS;
        // Heal budget exhausted? Escalate to a stronger model with a fresh
        // budget, OR (if no escalation rounds left) silently skip injecting
        // another fix prompt — the model will likely emit its final summary
        // next iteration, where the final-check escalation logic kicks in.
        if (autoHealAttempts >= MAX_AUTO_HEAL || stuckOnSameError) {
          const escalateReason = stuckOnSameError
            ? `same auto-verify signature repeated ${repeats}× — strategy not converging`
            : `auto-verify ${liveIssues.length} issues remain`;
          if (tryEscalate(escalateReason)) {
            const chronicBlock = chronicallyFailing.size > 0
              ? `\n\nFiles flagged repeatedly across attempts (treat as CHRONICALLY FAILING — apply the strategy below specifically to them):\n${[...chronicallyFailing].slice(0, 8).map((p) => `  • ${p}`).join("\n")}`
              : "";
            conversation.push({
              role: "user",
              content:
                `[ESCALATION round ${escalationRound}/${MAX_ESCALATION_ROUNDS} → ${currentModel}. ` +
                `Reason: ${escalateReason}. Fresh budget: ${MAX_AUTO_HEAL} attempts for ${liveIssues.length} remaining issue(s) in the files you just wrote.\n\n` +
                `${lastEscalationHint}${chronicBlock}\n\n` +
                `Apply the strategy above to every listed issue, then re-validate. Do NOT repeat the previous patch attempt — the same fix has already failed ${repeats}× on the same lines.]`,
            });
            continue;
          }
          // Out of escalation rounds — let the model finish; the final-check
          // path will emit a friendly user-facing summary.
          send({
            type: "auto_verify",
            ok: false,
            checked: v.checked,
            issue_count: liveIssues.length,
            attempt: autoHealAttempts,
            auto_fixes_applied: autoFixed.length,
            escalation_exhausted: true,
            issues: liveIssues.slice(0, 12).map((i) => ({ path: i.path, problem: i.problem, severity: i.severity })),
          });
          // Fall through — don't push another fix prompt; model will wrap up.
        } else {
        for (const i of liveIssues) {
          const next = (perFileHealCount.get(i.path) ?? 0) + 1;
          perFileHealCount.set(i.path, next);
          if (next >= MAX_AUTO_HEAL) {
            suppressedFiles.add(i.path);
            console.log(`[ai-agent] suppressing validator for ${i.path} after ${next} failed heal attempts (likely false positive)`);
            send({
              type: "thinking",
              text: `⚠️ ${i.path} could not be auto-healed after ${next} attempts. The file is saved but may have issues — review it manually if behaviour is off.`,
            });
          }
        }
        autoHealAttempts++;
        const issueText = liveIssues
          .slice(0, 12)
          .map((i) => {
            const sev = i.severity === "warn" ? "⚠️" : "❌";
            const hint = i.hint ? `\n   → ${i.hint}` : "";
            return `${sev} ${i.path}: ${i.problem}${hint}`;
          })
          .join("\n");

        // Pull recent runtime errors and translate to actionable hints.
        let runtimeHintBlock = "";
        try {
          const { data: recentErrs } = await ctx.supabase
            .from("project_error_history")
            .select("file_path, error_message")
            .eq("project_id", ctx.projectId)
            .order("created_at", { ascending: false })
            .limit(5);
          const hints: string[] = [];
          for (const e of (recentErrs ?? []) as any[]) {
            const hint = classifyRuntimeError(e.error_message);
            if (hint) hints.push(`  • ${(e.file_path || "?")}: ${hint}`);
          }
          if (hints.length > 0) {
            runtimeHintBlock = "\n\nRuntime/console errors detected — actionable hints:\n" + hints.join("\n");
          }
        } catch (_) { /* non-fatal */ }

        const fixedBlock = autoFixed.length > 0
          ? `\n\n✅ Auto-fix engine already applied ${autoFixed.length} repair(s):\n${
              autoFixed.slice(0, 8).map((f) => `  • ${f.path}: ${f.fix}`).join("\n")
            }\n(These are saved — do not re-do them.)`
          : "";

        console.log(
          `[ai-agent] auto-verify FAILED attempt=${autoHealAttempts}/${MAX_AUTO_HEAL} model=${activeModel} issues=${liveIssues.length}:\n${issueText}`,
        );
        send({
          type: "auto_verify",
          ok: false,
          checked: v.checked,
          issue_count: liveIssues.length,
          attempt: autoHealAttempts,
          auto_fixes_applied: autoFixed.length,
          issues: liveIssues.slice(0, 12).map((i) => ({ path: i.path, problem: i.problem, severity: i.severity })),
        });
        conversation.push({
          role: "user",
          content:
            `[Auto-verify failed (attempt ${autoHealAttempts}/${MAX_AUTO_HEAL}). ` +
            `${liveIssues.length} issue(s) remaining in files you just wrote:\n\n${issueText}` +
            `${fixedBlock}${runtimeHintBlock}\n\n` +
            `Read the affected file(s) if needed, then fix all REMAINING issues with write_file/edit_file. ` +
            `Do NOT write a final summary until validation passes.]`,
        });
        continue;
        }
      } else {
        // Validation green — reset the consecutive-write counter so the next
        // batch of legitimate writes isn't punished.
        consecutiveBulkWriteTurns = 0;
        send({
          type: "auto_verify",
          ok: true,
          checked: v.checked,
          issue_count: 0,
          auto_fixes_applied: autoFixed.length,
        });
      }
    }

    if (iter === MAX_LOOP_ITERATIONS - 1) {
      send({
        type: "error",
        message: `Agent loop hit the safety limit of ${MAX_LOOP_ITERATIONS} iterations without finishing.`,
      });
      break;
    }
  }
}

// Helper: emit file_changed / memory_updated events from a tool result.
// Keeps the loop body lean by deduplicating the parallel/sequential branches.
function emitFileChangedEvents(fnName: string, result: any, send: (event: any) => void): void {
  if (fnName === "write_file" && result?.success) {
    send({ type: "file_changed", path: result.path, action: result.action });
  }
  if (fnName === "bulk_write_files" && result?.success && Array.isArray(result.files)) {
    for (const f of result.files) send({ type: "file_changed", path: f.path, action: f.action });
  }
  if (fnName === "write_memory" && result?.saved) {
    send({ type: "memory_updated", key: result.key });
  }
}

// Re-export GATEWAY so callers needing it (e.g. domain matching) keep working.
export { GATEWAY };
