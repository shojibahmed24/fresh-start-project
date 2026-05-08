// ═══════════════════════════════════════════════════════════════════════════
// TOOL EXECUTORS — User Interaction (4 handlers)
// ───────────────────────────────────────────────────────────────────────────
// Handlers for tools defined in ../schemas/user-interaction.ts. Dispatched by
// ./index.ts → execTool(name, args, ctx, callId).
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolContext } from "../../types.ts";

export type ToolHandler = (
  args: any,
  ctx: ToolContext,
  callId: string,
) => Promise<{ result: any; askUser?: boolean }>;

export const exec_ask_user: ToolHandler = async (args, ctx, callId) => {
if (typeof args.question !== "string" || !Array.isArray(args.options)) {
  return { result: { error: "question and options[] required" } };
}
const opts = args.options.filter((o: any) => typeof o === "string");
if (opts.length < 2) {
  return { result: { error: "at least 2 options required" } };
}
ctx.pendingAsk = {
  id: callId,
  question: args.question,
  options: opts.slice(0, 4),
  allow_other: args.allow_other !== false,
};
// The agent loop will pause and yield this to the client.
return { result: { pending: true }, askUser: true };
};

export const exec_request_file_upload: ToolHandler = async (args, ctx, callId) => {
if (typeof args.purpose !== "string" || !args.purpose.trim()) {
  return { result: { error: "purpose required" } };
}
const accept = typeof args.accept === "string" ? args.accept : "*/*";
const multiple = args.multiple === true;
ctx.pendingAsk = {
  id: callId,
  question: `__FILE_REQUEST__:${JSON.stringify({
    purpose: args.purpose,
    accept,
    multiple,
  })}`,
  options: ["Upload file", "Skip"],
  allow_other: false,
};
return { result: { pending: true, purpose: args.purpose }, askUser: true };
};

export const exec_request_confirmation: ToolHandler = async (args, ctx, callId) => {
if (typeof args.action !== "string" || typeof args.impact !== "string") {
  return { result: { error: "action and impact required" } };
}
const severity = ["low", "medium", "high"].includes(args.severity) ? args.severity : "medium";
const confirmLabel = typeof args.confirm_label === "string" ? args.confirm_label : "Confirm";
ctx.pendingAsk = {
  id: callId,
  question: `__CONFIRM__:${JSON.stringify({
    action: args.action,
    impact: args.impact,
    severity,
    confirm_label: confirmLabel,
  })}`,
  options: [confirmLabel, "Cancel"],
  allow_other: false,
};
return { result: { pending: true, action: args.action, severity }, askUser: true };
};

export const exec_report_progress: ToolHandler = async (args, ctx, callId) => {
const total = Number.isFinite(args.total) ? Math.max(1, Math.floor(args.total)) : ctx.progress?.total;
if (!total) {
  return { result: { error: "total required on first call" } };
}
const current = Number.isFinite(args.current)
  ? Math.max(0, Math.min(total, Math.floor(args.current)))
  : (ctx.progress?.current ?? 0);
const label = typeof args.label === "string" ? args.label : ctx.progress?.label;
const startedAt = ctx.progress?.startedAt ?? Date.now();
ctx.progress = { total, current, startedAt, label };

// ETA: linear extrapolation from elapsed time (only meaningful after step 1).
let etaSeconds: number | null = null;
if (current > 0 && current < total) {
  const elapsedMs = Date.now() - startedAt;
  const perStep = elapsedMs / current;
  etaSeconds = Math.round((perStep * (total - current)) / 1000);
}
const pct = Math.round((current / total) * 100);

// Emit non-blocking progress event (the client renders a determinate bar).
ctx.send?.({
  type: "progress",
  current,
  total,
  percent: pct,
  label,
  eta_seconds: etaSeconds,
});

return {
  result: { current, total, percent: pct, eta_seconds: etaSeconds, label },
};
};

export const USER_INTERACTION_EXEC: Record<string, ToolHandler> = {
  ask_user: exec_ask_user,
  request_file_upload: exec_request_file_upload,
  request_confirmation: exec_request_confirmation,
  report_progress: exec_report_progress,
};
