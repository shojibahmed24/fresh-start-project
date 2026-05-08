// Agent-mode runtime: drives the multi-step ai-agent loop, renders timeline
// updates, persists session for reload safety, and handles ask_user resumes.
//
// Returns the imperative `handleAgent` + `submitAgentAnswer` plus the
// reactive state needed by the page (timeline, pending question, retry banner).

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { runAgent, type AgentMessage } from "@/lib/aiAgent";
import { getAgentVersionCached, warmAgentVersionCache } from "./useAgentVersion";
import {
  saveAgentSession,
  loadAgentSession,
  clearAgentSession,
  purgeExpiredAgentSessions,
} from "@/lib/agentSession";
import { addMessage, createProject, loadProject, autoTitleProject, type Project } from "@/lib/store";
import type { TimelineStep } from "@/components/builder/AgentTimeline";
import { mergeProjectSnapshot, isBuildLogMessage } from "./useBuilderResume";
import {
  scoreVisualReview,
  waitForPreviewReady,
  collectPreviewConsoleErrors,
  clearPreviewConsoleErrors,
} from "@/lib/visualReview";
import { checkCompleteness } from "@/lib/completenessCheck";
import { runInteractionAudit } from "@/lib/interactionAudit";
import { runFormAudit } from "@/lib/formAudit";

// Phase 2 — Visual Review Auto-loop config.
// Now runs after BOTH scratch builds AND edits, but with different caps:
//   - scratch build → up to 2 polish passes (bigger surface, needs more love)
//   - edit run      → up to 1 polish pass (focused, don't over-iterate)
// Console runtime errors ALWAYS trigger a polish pass regardless of score.
const POLISH_THRESHOLD = 35;          // 35/50 — anything below triggers a polish pass
const MAX_POLISH_ITERATIONS_SCRATCH = 2;
const MAX_POLISH_ITERATIONS_EDIT = 1;

type AgentQuestion = {
  id: string;
  question: string;
  options: string[];
  allowOther?: boolean;
} | null;

type Deps = {
  project: Project | null;
  setProject: React.Dispatch<React.SetStateAction<Project | null>>;
  projectRef: React.MutableRefObject<Project | null>;
  navigate: (path: string, opts?: { replace?: boolean }) => void;
  setActivePath: (p: string) => void;
  setRightView: (v: "code" | "preview" | "cloud") => void;
  setMobileView: (v: "chat" | "code" | "preview") => void;
  isMobile: boolean;
  online: boolean;
  setLoading: (b: boolean) => void;
  abortRef: React.MutableRefObject<AbortController | null>;
  // Build-mode resume hook — when the pending question came from build mode,
  // the page calls handleSend with a wrapped answer instead of handleAgent.
  onBuildResume: (wrapped: string) => Promise<void>;
};

const mergeFreshProjectWithLocalMessages = (fresh: Project, current: Project | null): Project => {
  if (!current || current.id !== fresh.id) return fresh;
  const byId = new Map(fresh.messages.map((message) => [message.id, message]));
  for (const message of current.messages) {
    const persisted = byId.get(message.id);
    if (!persisted) {
      byId.set(message.id, message);
    } else if (!persisted.timelineSteps && message.timelineSteps) {
      byId.set(message.id, { ...persisted, timelineSteps: message.timelineSteps });
    }
  }
  return {
    ...fresh,
    messages: [...byId.values()].sort((a, b) => a.createdAt - b.createdAt),
  };
};

export function useBuilderAgent(deps: Deps) {
  const {
    project,
    setProject,
    projectRef,
    navigate,
    setActivePath,
    setRightView,
    setMobileView,
    isMobile,
    online,
    setLoading,
    abortRef,
    onBuildResume,
  } = deps;

  const [agentSteps, setAgentSteps] = useState<TimelineStep[]>([]);
  const [agentQuestion, setAgentQuestion] = useState<AgentQuestion>(null);
  const [agentAnswerError, setAgentAnswerError] = useState<{ answer: string; message: string } | null>(null);
  // Live iteration counter so the UI can show "Step 3" while the agent loops.
  const [agentIteration, setAgentIteration] = useState<number>(0);
  // Phase 11: determinate progress (set by `report_progress` tool calls).
  const [agentProgress, setAgentProgress] = useState<{
    current: number;
    total: number;
    percent: number;
    label?: string;
    eta_seconds?: number | null;
  } | null>(null);

  const agentHistoryRef = useRef<AgentMessage[]>([]);
  const agentResumedHistoryRef = useRef<any[]>([]);
  const agentOriginalMessageRef = useRef<string>("");
  const agentPendingQuestionRef = useRef<string>("");
  const pendingQuestionModeRef = useRef<"agent" | "build">("agent");
  const agentRunningRef = useRef(false);
  const lastAgentAnswerRef = useRef<{ answer: string; question: AgentQuestion } | null>(null);
  const createProjectPromiseRef = useRef<Promise<Project> | null>(null);

  // Phase 2 — auto-polish loop tracking.
  // wasScratchBuildRef: was the project empty when the user kicked off this run?
  // polishIterationsRef: how many polish passes have we already triggered for this run?
  // originalDescriptionRef: the user's first prompt — sent to the visual reviewer for context.
  const wasScratchBuildRef = useRef(false);
  const polishIterationsRef = useRef(0);
  const originalDescriptionRef = useRef("");
  // Completeness validator — fires at most once per scratch build, BEFORE the
  // visual review polish loop, and is independent of the polish budget.
  const completenessHealUsedRef = useRef(false);

  // Sweep stale sessions once on mount.
  useEffect(() => {
    purgeExpiredAgentSessions();
  }, []);

  // Persist while a question is pending or timeline has rows.
  useEffect(() => {
    const projectId = project?.id;
    if (!projectId) return;
    if (!agentQuestion && agentSteps.length === 0) return;
    saveAgentSession(projectId, {
      pendingQuestion: agentQuestion,
      agentSteps,
      conversationHistory: agentResumedHistoryRef.current,
      originalMessage: agentOriginalMessageRef.current,
      pendingQuestionText: agentPendingQuestionRef.current,
    });
  }, [project?.id, agentQuestion, agentSteps]);

  // Restore a session when a project is freshly loaded.
  const restoreAgentSession = (projectId: string) => {
    const session = loadAgentSession(projectId);
    if (!session) return;
    if (session.agentSteps.length) setAgentSteps(session.agentSteps);
    if (session.pendingQuestion) setAgentQuestion(session.pendingQuestion);
    agentResumedHistoryRef.current = session.conversationHistory ?? [];
    agentPendingQuestionRef.current = session.pendingQuestionText ?? "";
    agentOriginalMessageRef.current = session.originalMessage ?? "";
    if (session.pendingQuestion) toast.info("Restored your pending agent question.");
  };

  // Track auto-resumes (server-initiated checkpoints) for the current
  // user request, to bound runaway resume chains.
  const autoResumeCountRef = useRef(0);
  const MAX_AUTO_RESUMES = 16;
  // Silent retry on transient stream drops (network blip, edge-function
  // restart, upstream 502). We retry up to 3 times with short backoff
  // BEFORE showing the user anything — they should just see the run
  // continue, not an "Agent stream closed" error.
  const streamDropRetryRef = useRef(0);
  const MAX_STREAM_DROP_RETRIES = 3;

  const handleAgent = async (
    text: string,
    isResumeAnswer = false,
    isPolishPass = false,
    attachments?: Array<{ id?: string; name: string; kind: "file" | "image"; size?: number; content: string; mime?: string }>,
    isAutoResume = false,
  ) => {
    const latestProject = mergeProjectSnapshot(projectRef.current ?? project);
    if (!latestProject) return;
    if (!online) {
      toast.warning("Offline — agent needs an internet connection.");
      return;
    }

    let workingProject = latestProject;
    if (!workingProject.id) {
      try {
        const derivedName = text.trim().split("\n")[0].slice(0, 60) || "Agent run";
        const created = await (createProjectPromiseRef.current ??= createProject(derivedName, ""));
        createProjectPromiseRef.current = null;
        workingProject = { ...created, messages: [], files: [], plan: null };
        setProject(workingProject);
        window.history.replaceState(window.history.state, "", `/dashboard/${created.id}`);
      } catch (err: any) {
        createProjectPromiseRef.current = null;
        toast.error(err?.message ?? "Could not create project");
        return;
      }
    }

    let agentMessage = text;
    let resumedHistory: any[] = [];

    if (isAutoResume) {
      // Server-initiated checkpoint resume. Continue the SAME logical request:
      //   • do NOT add a user message to chat (UX would show "__CONTINUE__")
      //   • do NOT reset timeline or polish counters
      //   • use resumedHistory as-is + a thin continue prompt
      agentMessage = "[CONTINUE — previous turn was checkpointed for time budget. Resume exactly where you left off without re-doing finished work.]";
      resumedHistory = agentResumedHistoryRef.current;
    } else if (isPolishPass) {
      // Polish pass: same project, fresh agent run. We KEEP scratch-build +
      // polish-iteration counters (already incremented by the caller).
      // Don't persist the polish prompt as a user message — it's auto-generated
      // and would clutter the chat. The score message is enough context.
      agentPendingQuestionRef.current = "";
      agentResumedHistoryRef.current = [];
      agentHistoryRef.current = [];
      setAgentSteps([]); setAgentProgress(null);
      setAgentIteration(0);
      autoResumeCountRef.current = 0;
      streamDropRetryRef.current = 0;
      agentOriginalMessageRef.current = text;
      agentPendingQuestionRef.current = "";
      agentResumedHistoryRef.current = [];
      // Seed agent history from the project's persisted chat so the backend
      // sees prior user/assistant turns. Without this, "continue from where
      // you left off" looks like a brand-new project to the agent. Filter out
      // legacy build-log noise and cap to the last ~20 turns to stay within
      // the LLM context window (backend trims further to ~6).
      const priorChat = (latestProject.messages ?? [])
        .filter((m: any) => (m.role === "user" || m.role === "assistant"))
        .filter((m: any) => !isBuildLogMessage({ role: m.role, content: m.content }))
        .map((m: any) => ({ role: m.role as "user" | "assistant", content: String(m.content ?? "") }))
        .filter((m) => m.content.trim().length > 0);
      agentHistoryRef.current = priorChat.slice(-20);
      setAgentSteps([]); setAgentProgress(null);
      setAgentIteration(0);
      // Phase 2 — only the user's first turn counts as a scratch build. Project
      // is "empty" if it had no files at the moment they hit send. Polish loop
      // does NOT trigger for follow-up edit prompts.
      const fileCountAtStart = (latestProject.files?.length ?? 0);
      wasScratchBuildRef.current = fileCountAtStart === 0;
      polishIterationsRef.current = 0;
      completenessHealUsedRef.current = false;
      autoResumeCountRef.current = 0;
      streamDropRetryRef.current = 0;
      originalDescriptionRef.current = text;
      // Wipe any stale runtime errors from a previous run so they don't
      // pollute this run's "did it actually work?" check.
      clearPreviewConsoleErrors();
      try {
        const userMsg = await addMessage(workingProject.id, { role: "user", content: text, mode: "agent" });
        setProject((prev) => (prev ? { ...prev, messages: [...prev.messages, userMsg] } : prev));
        // Auto-generate a conversation title from the first user message.
        // Runs in the background; non-blocking.
        if ((latestProject.messages?.length ?? 0) === 0) {
          autoTitleProject(workingProject.id, text)
            .then((title) => {
              if (title) {
                setProject((prev) => (prev ? { ...prev, name: title } : prev));
              }
            })
            .catch(() => {/* fallback handled inside */});
        }
      } catch {
        /* persistence failure shouldn't block the agent */
      }
    } else {
      const q = agentPendingQuestionRef.current || "previous question";
      agentMessage = `[Answer to "${q}"]: ${text}`;
      resumedHistory = agentResumedHistoryRef.current;
      try {
        const userMsg = await addMessage(workingProject.id, { role: "user", content: text, mode: "agent" });
        setProject((prev) => (prev ? { ...prev, messages: [...prev.messages, userMsg] } : prev));
      } catch {
        /* ignore */
      }
    }

    setAgentQuestion(null);
    setLoading(true);
    agentRunningRef.current = true;

    const controller = new AbortController();
    abortRef.current = controller;

    const toolIndex = new Map<string, number>();
    const filesTouched = new Set<string>();
    // Track whether this run completed naturally (done) vs was interrupted
    // (paused on ask_user, errored, aborted). Polish loop only runs after `done`.
    let runCompletedNaturally = false;

    try {
      // Agent-version selection.
      //   - Admins can toggle between v1 (single-pass executor, stable) and
      //     v2 (background-queue planner, experimental) via Model Settings.
      //   - Non-admins always get v1 — the cached helper enforces this.
      // We warm the cache once (no-op on subsequent calls) so the first
      // request after page load reflects the persisted preference.
      await warmAgentVersionCache().catch(() => undefined);
      const { isAdmin, preferV2 } = getAgentVersionCached();
      const useV2 = isAdmin && preferV2;

      await runAgent(
        {
          projectId: workingProject.id,
          message: agentMessage,
          history: agentHistoryRef.current,
          resumedHistory,
          useV2,
          // Phase 9: forward chat attachments (images for vision, text for context).
          attachments: attachments ?? undefined,
          // V2 planner uses the file list to decide scratch vs edit.
          files: (workingProject.files ?? []).map((f: any) => ({
            path: f.path,
            content: "",
          })),
        },
        (event) => {
          if (event.type === "iteration") {
            setAgentIteration(event.n);
          } else if (event.type === "thinking" && event.text) {
            // Token-stream coalescing — backend now sends thinking deltas
            // (often single tokens). If the previous step is already a
            // thinking block AND no tool call has landed since, append to
            // it instead of creating a new paragraph per delta.
            setAgentSteps((prev) => {
              const last = prev[prev.length - 1];
              if (last?.kind === "thinking") {
                const merged: TimelineStep = {
                  ...last,
                  text: last.text + event.text,
                };
                return [...prev.slice(0, -1), merged];
              }
              return [
                ...prev,
                { kind: "thinking", id: `t-${prev.length}`, text: event.text },
              ];
            });
          } else if (event.type === "tool_call") {
            setAgentSteps((prev) => {
              toolIndex.set(event.id, prev.length);
              return [
                ...prev,
                { kind: "tool", id: event.id, name: event.name, args: event.args, status: "running" },
              ];
            });
            // Kick off the typewriter animation as soon as we see a write tool
            // — UX-wise this feels like the AI is "typing" the file in real time.
            // Backend still writes atomically; this is a frontend illusion.
            try {
              const a: any = event.args ?? {};
              if (event.name === "write_file" && typeof a.path === "string" && typeof a.content === "string") {
                import("@/lib/streamingFiles").then(({ startStreaming }) => {
                  startStreaming(a.path, a.content);
                });
              } else if (event.name === "bulk_write_files" && Array.isArray(a.files)) {
                import("@/lib/streamingFiles").then(({ startStreaming }) => {
                  for (const f of a.files) {
                    if (typeof f?.path === "string" && typeof f?.content === "string") {
                      startStreaming(f.path, f.content);
                    }
                  }
                });
              } else if (event.name === "edit_file" && typeof a.path === "string" && typeof a.replace === "string") {
                // For surgical edits, animate just the replacement snippet.
                import("@/lib/streamingFiles").then(({ startStreaming }) => {
                  startStreaming(a.path, a.replace);
                });
              }
            } catch {
              /* streaming is purely cosmetic — never break the run */
            }
          } else if (event.type === "tool_result") {
            const idx = toolIndex.get(event.id);
            if (idx === undefined) return;
            const ok = !(event.result && event.result.error);
            setAgentSteps((prev) => {
              const next = [...prev];
              const step = next[idx];
              if (step?.kind === "tool") {
                next[idx] = { ...step, status: ok ? "ok" : "error", result: event.result };
              }
              return next;
            });
          } else if (event.type === "file_changed") {
            filesTouched.add(event.path);
            loadProject(workingProject.id).then((p) => {
              if (!p) return;
              setProject((prev) => mergeFreshProjectWithLocalMessages(p, prev));
              setActivePath(event.path);
              // Desktop: jump to code so the user can watch files stream in.
              // Mobile: stay in chat — the user explicitly asked NOT to be
              // pulled away from the conversation while generation runs.
              // We auto-switch to preview only when the run completes (see "done" branch).
              setRightView("code");
            });
          } else if (event.type === "ask_user") {
            agentPendingQuestionRef.current = event.question;
            pendingQuestionModeRef.current = "agent";
            setAgentQuestion({
              id: event.id,
              question: event.question,
              options: event.options,
              allowOther: event.allow_other,
            });
          } else if (event.type === "memory_updated") {
            setAgentSteps((prev) => [
              ...prev,
              { kind: "memory", id: `mem-${prev.length}`, key: event.key },
            ]);
          } else if (event.type === "auto_verify") {
            setAgentSteps((prev) => [
              ...prev,
              {
                kind: "verify",
                id: `av-${prev.length}`,
                ok: event.ok,
                checked: event.checked,
                issueCount: event.issue_count,
                attempt: event.attempt,
                final: event.final,
                issues: event.issues,
              },
            ]);
          } else if (event.type === "auto_fix") {
            // Phase 7: surface deterministic self-healing fixes in the timeline.
            setAgentSteps((prev) => [
              ...prev,
              {
                kind: "thinking",
                id: `afx-${prev.length}`,
                text: `🔧 Auto-fix engine applied ${event.count} repair(s):\n${
                  event.fixes.slice(0, 6).map((f) => `  • ${f.path}: ${f.fix}`).join("\n")
                }`,
              },
            ]);
            // Refresh changed file paths so subsequent reads see the fixed content.
            for (const p of event.changed_paths) filesTouched.add(p);
          } else if (event.type === "progress") {
            // Phase 11: determinate progress bar with ETA. Non-blocking.
            setAgentProgress({
              current: event.current,
              total: event.total,
              percent: event.percent,
              label: event.label,
              eta_seconds: event.eta_seconds ?? null,
            });
          } else if (event.type === "paused") {
            agentResumedHistoryRef.current = event.history ?? [];
            // Server-side checkpoint (wall-clock budget). Auto-resume in a
            // fresh edge-function invocation so the user doesn't have to do
            // anything. Bounded by MAX_AUTO_RESUMES to avoid infinite loops.
            if (
              (event as any).reason === "time_budget" &&
              autoResumeCountRef.current < MAX_AUTO_RESUMES
            ) {
              autoResumeCountRef.current += 1;
              // Reset stream-drop budget on a clean checkpoint — the
              // server pause itself proves the previous leg succeeded.
              streamDropRetryRef.current = 0;
              const elapsedSec = Math.round(((event as any).elapsed_ms ?? 0) / 1000);
              console.log(
                `[agent] auto-resume #${autoResumeCountRef.current} after checkpoint at ~${elapsedSec}s`,
              );
              // Silent resume — user wanted no visible "Continuing…" toast.
              // The build should look like one continuous run from their POV.
              // Defer so the current event handler returns first; the runAgent
              // promise will resolve and `finally` will run before the next
              // handleAgent call recurses.
              setTimeout(() => {
                handleAgent("__AUTO_RESUME__", false, false, undefined, true).catch(() => {
                  /* error already toasted by inner call */
                });
              }, 50);
            } else if ((event as any).reason === "time_budget") {
              toast.warning(
                `Reached ${MAX_AUTO_RESUMES} auto-resumes — stopping. Send "continue" to keep going.`,
              );
            }
          } else if (event.type === "done") {
            runCompletedNaturally = true;
            // Successful turn — reset silent-retry budget for the next leg.
            streamDropRetryRef.current = 0;
            const summary = event.summary || "Done.";
            // Snapshot the live timeline so we can attach it to the persisted
            // assistant message — lets the user re-expand any tool row later.
            let stepsSnapshot: TimelineStep[] = [];
            setAgentSteps((prev) => {
              stepsSnapshot = prev;
              return prev;
            });
            const metadata = stepsSnapshot.length > 0
              ? { timelineSteps: stepsSnapshot }
              : undefined;
            addMessage(workingProject.id, {
              role: "assistant",
              content: summary,
              mode: "agent",
              ...(metadata ? { metadata } : {}),
            } as any)
              .then((saved) => {
                const enriched = stepsSnapshot.length > 0
                  ? { ...saved, timelineSteps: stepsSnapshot }
                  : saved;
                setProject((prev) => (prev ? { ...prev, messages: [...prev.messages, enriched] } : prev));
              })
              .catch(() => {
                /* ignore */
              });
            if (filesTouched.size > 0) {
              loadProject(workingProject.id).then((p) => {
                if (p) setProject((prev) => mergeFreshProjectWithLocalMessages(p, prev));
              });
              setRightView("preview");
              if (isMobile) setMobileView("preview");
            }
            setAgentSteps([]); setAgentProgress(null);
            setAgentIteration(0);
            agentHistoryRef.current = [];
            agentResumedHistoryRef.current = [];
            agentPendingQuestionRef.current = "";
            agentOriginalMessageRef.current = "";
            clearAgentSession(workingProject.id);
          } else if (event.type === "escalation") {
            // Server bumped to a stronger model after heal cap. Show a
            // friendly status pill so the user knows we're still trying.
            const fromShort = String(event.from_model || "").split("/").pop();
            const toShort = String(event.to_model || "").split("/").pop();
            const label = `🚀 Switching to a stronger model (${toShort}) to fix remaining issues — pass ${event.round}`;
            toast.info(label, { duration: 4000 });
            setAgentSteps((prev) => [
              ...prev,
              {
                kind: "info",
                id: `esc-${event.round}-${Date.now()}`,
                label,
              } as any,
            ]);
          } else if (event.type === "error") {
            // ─── Silent stream-drop retry ──────────────────────────────
            // Transient SSE drops ("Stream interrupted", "Agent stream
            // closed unexpectedly", network error, BodyStreamBuffer) are
            // almost always upstream/edge restarts. Retry up to N times
            // with short backoff BEFORE telling the user anything. The
            // user should just see the build keep going.
            const msg = String(event.message || "");
            const isTransientStreamDrop =
              /stream (?:interrupted|closed unexpectedly)|network error|fetch failed|connection (?:closed|reset|aborted)|body ?stream|terminated|EPIPE|ECONNRESET|502|503|504/i.test(
                msg,
              );
            if (
              isTransientStreamDrop &&
              streamDropRetryRef.current < MAX_STREAM_DROP_RETRIES
            ) {
              streamDropRetryRef.current += 1;
              const attempt = streamDropRetryRef.current;
              const backoff = 800 * attempt; // 0.8s, 1.6s, 2.4s
              console.warn(
                `[agent] silent stream-drop retry ${attempt}/${MAX_STREAM_DROP_RETRIES} in ${backoff}ms — "${msg}"`,
              );
              // Treat this exactly like a checkpointed pause: resume in a
              // fresh edge invocation, no toast, no error step in timeline.
              setTimeout(() => {
                handleAgent("__AUTO_RESUME__", false, false, undefined, true).catch(() => {
                  /* swallowed — next attempt or final error will surface */
                });
              }, backoff);
              return;
            }

            // Real, user-visible error path (not a transient drop, or
            // we've exhausted silent retries).
            toast.error(event.message);
            const errorStep = {
              kind: "tool" as const,
              id: `err-${Date.now()}`,
              name: "executor_error",
              args: {},
              status: "error" as const,
              result: event.message,
            };
            setAgentSteps((prev) => [...prev, errorStep as any]);
            // Persist a recoverable assistant message so the run is visible
            // after reload / navigation. Without this, the user sees their
            // own message but no AI response (looks like a ghost turn).
            try {
              const stepsSoFar: TimelineStep[] = [];
              setAgentSteps((prev) => { stepsSoFar.push(...prev); return prev; });
              const errorBody =
                `> ⚠️ The previous attempt was interrupted: ${event.message}\n\n` +
                `Send another message to continue, or describe what you wanted differently.`;
              addMessage(workingProject.id, {
                role: "assistant",
                content: errorBody,
                mode: "agent",
                metadata: stepsSoFar.length > 0 ? { timelineSteps: stepsSoFar, error: event.message } : { error: event.message },
              } as any)
                .then((saved) => {
                  const enriched = stepsSoFar.length > 0
                    ? { ...saved, timelineSteps: stepsSoFar }
                    : saved;
                  setProject((prev) =>
                    prev ? { ...prev, messages: [...prev.messages, enriched] } : prev,
                  );
                })
                .catch(() => { /* ignore */ });
            } catch { /* ignore */ }
          } else if (event.type === "v2_run") {
            // Initial run id — no UI yet, but log for debugging.
            console.log("[v2] run started", event.run_id);
          } else if (event.type === "v2_phase") {
            // Replace any previous phase pill with the latest one (single
            // pill at the top of the timeline tracking current phase).
            setAgentSteps((prev) => {
              const filtered = prev.filter((s) => s.kind !== "v2_phase");
              return [
                ...filtered,
                {
                  kind: "v2_phase",
                  id: `v2-phase-${event.phase}-${Date.now()}`,
                  phase: event.phase as any,
                  active: true,
                },
              ];
            });
          } else if (event.type === "v2_plan") {
            // Insert/replace the plan card.
            setAgentSteps((prev) => {
              const filtered = prev.filter((s) => s.kind !== "v2_plan");
              return [
                ...filtered,
                {
                  kind: "v2_plan",
                  id: `v2-plan-${event.run_id}`,
                  plan: event.plan,
                  currentStepIndex: 0,
                  active: true,
                },
              ];
            });
          } else if (event.type === "v2_step") {
            setAgentSteps((prev) =>
              prev.map((s) =>
                s.kind === "v2_plan"
                  ? { ...s, currentStepIndex: event.step_index, active: true }
                  : s,
              ),
            );
          } else if (event.type === "v2_rollback") {
            // Mark the step as rolled back inside the plan card.
            setAgentSteps((prev) =>
              prev.map((s) => {
                if (s.kind !== "v2_plan") return s;
                const existing = s.rolledBackStepIds ?? [];
                if (existing.includes(event.step_id)) return s;
                return { ...s, rolledBackStepIds: [...existing, event.step_id] };
              }),
            );
          } else if (event.type === "v2_summary") {
            setAgentSteps((prev) => [
              ...prev,
              {
                kind: "v2_summary",
                id: `v2-summary-${prev.length}`,
                text: event.text,
              },
            ]);
          } else if (event.type === "v2_complete") {
            // Mark phase pill + plan as inactive so spinners stop.
            setAgentSteps((prev) =>
              prev.map((s) => {
                if (s.kind === "v2_phase") {
                  return { ...s, phase: "complete", active: false };
                }
                if (s.kind === "v2_plan") {
                  return {
                    ...s,
                    currentStepIndex: s.plan.steps.length,
                    active: false,
                  };
                }
                return s;
              }),
            );
          }
        },
        controller.signal,
      );
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        const msg = String(err?.message ?? "Agent run failed");
        const isTransientStreamDrop =
          /stream (?:interrupted|closed unexpectedly)|network error|fetch failed|connection (?:closed|reset|aborted)|body ?stream|terminated|EPIPE|ECONNRESET|502|503|504/i.test(
            msg,
          );
        if (
          isTransientStreamDrop &&
          streamDropRetryRef.current < MAX_STREAM_DROP_RETRIES
        ) {
          streamDropRetryRef.current += 1;
          const attempt = streamDropRetryRef.current;
          const backoff = 800 * attempt;
          console.warn(
            `[agent] silent stream-drop retry (catch) ${attempt}/${MAX_STREAM_DROP_RETRIES} in ${backoff}ms — "${msg}"`,
          );
          abortRef.current = null;
          agentRunningRef.current = false;
          setLoading(false);
          setTimeout(() => {
            handleAgent("__AUTO_RESUME__", false, false, undefined, true).catch(() => {});
          }, backoff);
          return;
        }
        toast.error(msg);
      }
    } finally {
      abortRef.current = null;
      agentRunningRef.current = false;
      setLoading(false);
    }

    // ─── Phase 1.5: Completeness validator (scratch builds only) ────────
    // Cheap structural checks on generated files BEFORE the vision-model
    // pass. If the build is missing essentials (component count, images,
    // useState, header/nav) we force one extra heal turn — independent of
    // the visual-review polish budget. Fires at most once per scratch build.
    if (
      runCompletedNaturally &&
      wasScratchBuildRef.current &&
      filesTouched.size > 0 &&
      !completenessHealUsedRef.current
    ) {
      const latest = mergeProjectSnapshot(projectRef.current ?? project);
      const result = checkCompleteness(latest?.files ?? []);
      if (!result.passed && result.healPrompt) {
        completenessHealUsedRef.current = true;
        const failedLabels = result.failed.map((f) => f.label).join(", ");
        toast.warning(`Incomplete build — fixing: ${failedLabels}`);
        setAgentSteps((prev) => [
          ...prev,
          {
            kind: "info",
            id: `completeness-${Date.now()}`,
            label: `🔧 Completeness check failed: ${failedLabels}`,
          } as any,
        ]);
        try {
          const saved = await addMessage(workingProject.id, {
            role: "assistant",
            content: `🔧 Completeness check found gaps: **${failedLabels}**. Running an automatic fix turn.`,
            mode: "agent",
          });
          setProject((prev) => (prev ? { ...prev, messages: [...prev.messages, saved] } : prev));
        } catch { /* non-fatal */ }
        // Force a heal turn. isPolishPass=true keeps scratch-build context.
        await handleAgent(result.healPrompt, false, true);
        return; // The recursive call will run visual review afterwards.
      }
    }

    // ─── Phase 2: Visual Review Auto-loop (now runs on edits too) ───────
    // Fires when:
    //   1. The run completed naturally (no abort, no pending question, no error)
    //   2. Files were actually written this run
    //   3. We haven't exhausted the polish budget for this run-mode
    // Scratch builds get up to 2 polish passes; edit runs get 1.
    // Runtime console errors detected during the review window also force a
    // polish pass (so the agent gets a chance to self-fix broken UI).
    const maxPolish = wasScratchBuildRef.current
      ? MAX_POLISH_ITERATIONS_SCRATCH
      : MAX_POLISH_ITERATIONS_EDIT;


    if (
      runCompletedNaturally &&
      filesTouched.size > 0 &&
      polishIterationsRef.current < maxPolish
    ) {
      try {
        // Wait for Sandpack to mount + paint after the file writes.
        // Poll up to 5× with 2s gaps so we don't bail early when the
        // preview is just slow to compile a fresh scratch build.
        let previewEl: HTMLElement | null = null;
        const POLL_RETRIES = 5;
        const POLL_GAP_MS = 2000;
        for (let attempt = 1; attempt <= POLL_RETRIES; attempt++) {
          previewEl = await waitForPreviewReady(POLL_GAP_MS);
          if (previewEl) break;
          console.log(`[auto-polish] preview not ready (attempt ${attempt}/${POLL_RETRIES})`);
        }
        if (!previewEl) {
          console.log("[auto-polish] preview never became ready after 5 retries, skipping review");
          return;
        }
        // Brief settle so animations/images can render before capture.
        await new Promise((r) => setTimeout(r, 800));

        // Capture runtime console errors from the preview iframe BEFORE the
        // visual review — gives us the "did this actually work?" signal a
        // pure screenshot cannot. We tap into the iframe's window.console.
        const consoleErrors = collectPreviewConsoleErrors(previewEl);

        toast.info("Reviewing the design…", { duration: 2500 });
        const [result, audit, formAudit] = await Promise.all([
          scoreVisualReview({
            element: previewEl,
            appDescription: originalDescriptionRef.current,
          }),
          // Runtime click probe — finds dead buttons + handlers that throw.
          // Errors during the audit are non-fatal; we still run visual review.
          runInteractionAudit(previewEl).catch((e) => {
            console.log("[interaction-audit] failed:", e?.message);
            return { buttonsTested: 0, dead: [], healPrompt: null } as Awaited<ReturnType<typeof runInteractionAudit>>;
          }),
          // Form fill+submit probe — fills each form with dummy data, submits,
          // and verifies user-visible feedback (toast/nav/dialog/success text).
          runFormAudit(previewEl).catch((e) => {
            console.log("[form-audit] failed:", e?.message);
            return { formsTested: 0, failures: [], healPrompt: null } as Awaited<ReturnType<typeof runFormAudit>>;
          }),
        ]);

        if (result.error) {
          console.log("[auto-polish] review failed:", result.error);
          return;
        }

        const attempt = polishIterationsRef.current + 1;
        const auditDeadCount = audit.dead.length;
        const formFailureCount = formAudit.failures.length;
        const willPolish =
          (!result.passed && !!result.polishPrompt) ||
          consoleErrors.length > 0 ||
          auditDeadCount > 0 ||
          formFailureCount > 0;

        // Push a visual step into the timeline so user sees the verification.
        setAgentSteps((prev) => [
          ...prev,
          {
            kind: "visual",
            id: `vis-${Date.now()}`,
            total: result.total,
            max: result.max,
            passed:
              result.passed &&
              consoleErrors.length === 0 &&
              auditDeadCount === 0 &&
              formFailureCount === 0,
            summary: result.summary,
            attempt,
            polishing: willPolish,
            consoleErrors: consoleErrors.length,
            deadButtons: auditDeadCount,
            brokenForms: formFailureCount,
          } as any,
        ]);

        // Surface the score in the chat as an assistant info line so the user
        // can see what the auto-loop decided. Include console error count when
        // present — that's the "did it actually work?" verdict.
        const errLine =
          consoleErrors.length > 0
            ? `\n\n⚠️ Detected ${consoleErrors.length} runtime error${consoleErrors.length === 1 ? "" : "s"} in preview console — will attempt a fix.`
            : "";
        const auditLine =
          auditDeadCount > 0
            ? `\n\n🖱️ Interaction audit: clicked ${audit.buttonsTested} button${audit.buttonsTested === 1 ? "" : "s"}, ${auditDeadCount} produced no effect or threw — fixing in backend.`
            : audit.buttonsTested > 0
              ? `\n\n🖱️ Interaction audit: ${audit.buttonsTested} button${audit.buttonsTested === 1 ? "" : "s"} all responded ✓`
              : "";
        const formLine =
          formFailureCount > 0
            ? `\n\n📝 Form audit: tested ${formAudit.formsTested} form${formAudit.formsTested === 1 ? "" : "s"}, ${formFailureCount} failed to confirm success — fixing in backend.`
            : formAudit.formsTested > 0
              ? `\n\n📝 Form audit: ${formAudit.formsTested} form${formAudit.formsTested === 1 ? "" : "s"} submitted successfully ✓`
              : "";
        const visualErrors = (result.issues || []).filter((i: any) => i.severity === "error");
        const visualErrorLine =
          visualErrors.length > 0
            ? `\n\n👁️ Vision review found ${visualErrors.length} design issue${visualErrors.length === 1 ? "" : "s"}:\n${visualErrors.slice(0, 3).map((i: any, idx: number) => `  ${idx + 1}. ${i.message}`).join("\n")}`
            : "";
        const scoreMsg = `🎨 Visual quality score: **${result.total}/50** (${result.passed ? "passed ✓" : "below threshold"})\n\n${result.summary}${visualErrorLine}${errLine}${auditLine}${formLine}`;
        try {
          const saved = await addMessage(workingProject.id, {
            role: "assistant",
            content: scoreMsg,
            mode: "agent",
          });
          setProject((prev) => (prev ? { ...prev, messages: [...prev.messages, saved] } : prev));
        } catch { /* non-fatal */ }

        if (!willPolish) return;

        // Trigger polish iteration. Increment BEFORE recursing to bound depth.
        polishIterationsRef.current += 1;
        toast.info(
          `Polishing design (pass ${polishIterationsRef.current}/${maxPolish})…`,
        );
        // Build the combined polish prompt: visual issues + console errors
        // + dead-button audit findings + broken-form audit. Order = priority.
        const errorBlock =
          consoleErrors.length > 0
            ? `\n\n[RUNTIME ERRORS FROM PREVIEW CONSOLE — fix these FIRST]\n${consoleErrors
                .slice(0, 5)
                .map((e, i) => `${i + 1}. ${e}`)
                .join("\n")}`
            : "";
        const auditBlock = audit.healPrompt ? `\n\n${audit.healPrompt}` : "";
        const formBlock = formAudit.healPrompt ? `\n\n${formAudit.healPrompt}` : "";
        const fullPrompt =
          (result.polishPrompt ??
            (consoleErrors.length > 0 || auditDeadCount > 0 || formFailureCount > 0
              ? "[Auto-fix pass — visual review found no design issues, but the preview has runtime errors, dead UI controls, or broken form submits. Read the failing files and fix them so every button and form works end-to-end.]"
              : "")) +
          errorBlock +
          auditBlock +
          formBlock;

        // isResumeAnswer=true keeps wasScratchBuildRef + polishIterationsRef intact.
        await handleAgent(fullPrompt, false, true);
      } catch (e: any) {
        console.log("[auto-polish] error:", e?.message);
      }
    }
  };

  const submitAgentAnswer = async (answer: string, question: AgentQuestion) => {
    setAgentAnswerError(null);
    const questionText = question?.question || agentPendingQuestionRef.current || "previous question";
    setAgentSteps((prev) => {
      const last = prev[prev.length - 1];
      if (last?.kind === "answered_question" && last.question === questionText && last.answer === answer) {
        return prev;
      }
      return [
        ...prev,
        {
          kind: "answered_question",
          id: `answered-${Date.now()}`,
          question: questionText,
          answer,
        },
      ];
    });
    setAgentQuestion(null);
    try {
      // Phase 11: decode `__FILES__:` answer back into structured attachments.
      let resumeAttachments:
        | Array<{ name: string; kind: "file" | "image"; size?: number; content: string; mime?: string }>
        | undefined;
      let answerForAgent = answer;
      if (answer.startsWith("__FILES__:")) {
        try {
          resumeAttachments = JSON.parse(answer.replace(/^__FILES__:/, ""));
          answerForAgent = `Uploaded ${resumeAttachments?.length ?? 0} file(s).`;
        } catch { /* keep raw answer */ }
      }
      if (pendingQuestionModeRef.current === "build") {
        const original = agentOriginalMessageRef.current || "";
        const wrapped = original
          ? `${original}\n\n[Answer to '${questionText}']: ${answerForAgent}`
          : `[Answer to '${questionText}']: ${answerForAgent}`;
        await onBuildResume(wrapped);
      } else {
        await handleAgent(answerForAgent, true, false, resumeAttachments);
      }
    } catch (err: any) {
      const message = err?.message || "Network error — please retry.";
      setAgentAnswerError({ answer, message });
      setAgentQuestion(question);
    }
  };

  const handleAgentAnswer = (answer: string) => {
    lastAgentAnswerRef.current = { answer, question: agentQuestion };
    submitAgentAnswer(answer, agentQuestion);
  };

  const handleRetryAgentAnswer = () => {
    const last = lastAgentAnswerRef.current;
    if (!last) return;
    submitAgentAnswer(last.answer, last.question);
  };

  // Expose setters needed by build mode to surface its own ask_user questions
  // through the same QuestionCard UI.
  const setBuildModeQuestion = (q: AgentQuestion, originalText: string) => {
    if (q) {
      agentPendingQuestionRef.current = q.question;
      agentOriginalMessageRef.current = originalText;
      pendingQuestionModeRef.current = "build";
    }
    setAgentQuestion(q);
  };

  return {
    // state
    agentSteps,
    agentQuestion,
    agentAnswerError,
    agentIteration,
    agentProgress,
    // commands
    handleAgent,
    handleAgentAnswer,
    handleRetryAgentAnswer,
    setBuildModeQuestion,
    restoreAgentSession,
  };
}
