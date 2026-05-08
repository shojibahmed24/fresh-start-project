// Centralised configuration constants for the AI agent edge function.
// Pulling these out of `index.ts` keeps tunables easy to find + audit, and
// lets sub-modules (callLLM, agent loop, autofix) import only what they need.

// ── LLM gateway ──────────────────────────────────────────────────────────
// We route through OpenRouter so we can swap providers without code changes.
export const GATEWAY = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_MODEL = "google/gemini-2.5-flash";
// Real fallback — different provider/model so transient Gemini failures
// don't just retry the same model. GPT-4o-mini via OpenRouter.
export const GROK_FALLBACK_MODEL = "openai/gpt-4o-mini";

// ── Loop safety + streaming timeouts ─────────────────────────────────────
// Hard safety cap — agent loop will never run more than this many turns,
// preventing runaway loops or infinite tool-calling.
export const MAX_LOOP_ITERATIONS = 40;
export const LLM_STREAM_IDLE_HEARTBEAT_MS = 15_000;
export const LLM_STREAM_BODY_TIMEOUT_MS = 480_000;
// If a model stays silent, do not just wait for minutes. Abort the idle stream
// quickly enough for the turn loop to force a fresh code-writing pass.
export const LLM_FIRST_EVENT_TIMEOUT_MS = 55_000;
export const LLM_NEXT_EVENT_TIMEOUT_MS = 55_000;
export const LLM_IDLE_NOTICE_MS = 30_000;

// Self-heal cap — if validation keeps failing after this many auto-fix turns,
// escalate to a stronger model with a fresh budget. Bumped from 5 → 10 so
// large multi-file scratch builds (where a few files cross the 400-line cap
// or have cross-file type drift) get enough rounds to actually converge
// before we give up. Each round = one focused fix attempt + re-validate.
export const MAX_AUTO_HEAL = 10;

// ── Escalation models ────────────────────────────────────────────────────
// When MAX_AUTO_HEAL is reached and issues remain, the agent automatically
// switches to a stronger model and gets a fresh budget of heal attempts.
// Designed for no-code users who can't fix issues manually.
// Order: try ESCALATION_MODEL_1 first, then ESCALATION_MODEL_2 if still
// failing. Each escalation gets MAX_AUTO_HEAL fresh attempts.
// NOTE: ESCALATION_MODEL_2 was previously "openai/gpt-5" which does not
// exist on the gateway → escalation round 2 silently failed. Pointing at
// google/gemini-3-flash-preview (the supported default) so round 2 actually
// runs a fresh, cheap, fast pass that often resolves leftover issues by
// virtue of a clean context + the fresh-budget reset.
export const ESCALATION_MODEL_1 = "anthropic/claude-sonnet-4.5";
export const ESCALATION_MODEL_2 = "google/gemini-3-flash-preview";
// Hard cap on escalation rounds per turn — bumped from 2 → 3 so we get one
// extra "different-approach" pass (splitter mode, see turn-loop) before
// surfacing a friendly fallback message to the user.
export const MAX_ESCALATION_ROUNDS = 3;

// ── Per-turn checkpoint budget ───────────────────────────────────────────
// Supabase edge functions have a wall-clock CPU limit (~150s soft / 400s
// hard). Long agentic builds can blow past it silently and the function gets
// killed mid-stream. Instead, we voluntarily checkpoint the loop after
// either of these thresholds and tell the client to resume in a fresh
// edge-function invocation. The full conversation is echoed via the
// `paused` event (reason="time_budget"), so the next invocation continues
// from the exact same OpenAI tool-call state.
// User wanted: keep iterations the same (don't reduce productivity per turn),
// just lower the elapsed-time threshold so we checkpoint BEFORE the function
// risks an upstream 502 or a hard kill. The wall-clock soft-limit on Supabase
// edge runtime is ~150s; we now bail at ~80s, leaving a comfortable cushion
// for the final flush + the resume handshake.
export const CHECKPOINT_MAX_ITERATIONS = 10;
export const CHECKPOINT_MAX_ELAPSED_MS = 110_000; // 110s — leaves >40s headroom under the 150s soft limit
// Hard ceiling on how many times a single user request can auto-resume.
// Bumped from 8 → 16 so very large multi-page generations finish silently
// without ever surfacing a "stopped — send continue" message to the user.
export const MAX_AUTO_RESUMES = 16;
