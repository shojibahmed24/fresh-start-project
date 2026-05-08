// ═══════════════════════════════════════════════════════════════════════════
// TOOL EXECUTORS — Secrets (3 handlers)
// ───────────────────────────────────────────────────────────────────────────
// Handlers for tools defined in ../schemas/secrets.ts. Dispatched by
// ./index.ts → execTool(name, args, ctx, callId).
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolContext } from "../../types.ts";

export type ToolHandler = (
  args: any,
  ctx: ToolContext,
  callId: string,
) => Promise<{ result: any; askUser?: boolean }>;

export const exec_list_secrets: ToolHandler = async (args, ctx, callId) => {
// We can't actually query Supabase Vault from the agent (privileged).
// Best-effort: enumerate well-known secret names that are present in
// Deno.env (project edge runtime). We return only NAMES, never values.
const known = [
  "LOVABLE_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY",
  "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PUBLISHABLE_KEY",
  "RESEND_API_KEY", "SENDGRID_API_KEY",
  "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN",
  "GITHUB_TOKEN", "OPENROUTER_API_KEY",
  "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
];
const present: string[] = [];
for (const k of known) {
  try { if (Deno.env.get(k)) present.push(k); } catch { /* perms */ }
}
return {
  result: {
    note: "Names only — values are never exposed to the agent.",
    count: present.length,
    secrets: present,
  },
};
};

export const exec_request_secret: ToolHandler = async (args, ctx, callId) => {
if (typeof args.name !== "string" || typeof args.purpose !== "string") {
  return { result: { error: "name and purpose required" } };
}
const name = args.name.toUpperCase().replace(/[^A-Z0-9_]/g, "");
if (!name) return { result: { error: "invalid secret name" } };
if (/^(LOVABLE_|SUPABASE_)/.test(name)) {
  return {
    result: {
      error: `${name} is platform-managed and cannot be set by the agent. Skip request_secret for it.`,
    },
  };
}
// Already present? Tell the agent — no need to bug the user.
try {
  if (Deno.env.get(name)) {
    return { result: { already_set: true, name, note: "Secret already configured. Use it directly." } };
  }
} catch { /* env perms */ }
// Reuse the pendingAsk pause channel — emit a special "secret_request" via askUser flag.
// The client will recognise the structured payload and render a secure input.
ctx.pendingAsk = {
  id: callId,
  question: `__SECRET_REQUEST__:${name}`,
  options: [args.purpose, args.docs_url || ""],
  allow_other: false,
};
return { result: { pending: true, name, purpose: args.purpose }, askUser: true };
};

export const exec_delete_secret: ToolHandler = async (args, ctx, callId) => {
if (typeof args.name !== "string") return { result: { error: "name required" } };
const name = args.name.toUpperCase().replace(/[^A-Z0-9_]/g, "");
if (!name) return { result: { error: "invalid secret name" } };
if (/^(LOVABLE_|SUPABASE_|OPENROUTER_|SBOAUTH_)/.test(name)) {
  return { result: { error: `${name} is platform-managed and cannot be deleted by the agent.` } };
}
// We don't have direct vault write access from the agent; emit a structured
// event by reusing pendingAsk — the client surfaces it as a one-tap confirm.
ctx.pendingAsk = {
  id: callId,
  question: `__SECRET_DELETE__:${name}`,
  options: ["Confirm delete", "Cancel"],
  allow_other: false,
};
return { result: { pending: true, name }, askUser: true };
};

export const SECRETS_EXEC: Record<string, ToolHandler> = {
  list_secrets: exec_list_secrets,
  request_secret: exec_request_secret,
  delete_secret: exec_delete_secret,
};
