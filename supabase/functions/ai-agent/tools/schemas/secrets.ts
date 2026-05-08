// ═══════════════════════════════════════════════════════════════════════════
// TOOL SCHEMAS — Secrets (3 tools)
// ───────────────────────────────────────────────────────────────────────────
// JSON-Schema definitions for the LLM's function-calling interface.
// Execution logic lives in `../../index.ts` execTool switch (later phase: split
// alongside this file as `./secrets-exec.ts`).
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolSchema } from "../registry.ts";

export const SECRETS_TOOLS: ToolSchema[] = [
  {
    type: "function",
    function: {
      name: "list_secrets",
      description:
        "List the NAMES of secrets already configured for this project (Supabase Edge Function secrets). Returns names only — never values, for security. Use BEFORE asking the user to add an API key, to check if they already have it. Common names: STRIPE_SECRET_KEY, OPENAI_API_KEY, RESEND_API_KEY, LOVABLE_API_KEY.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "request_secret",
      description:
        "Ask the user to add or update a secret (API key, token) for an integration. NEVER includes the value — emits a UI banner the user clicks to enter it securely. Use BEFORE calling list_secrets confirms the key is missing AND the user clearly wants this integration. After this call returns, the agent loop pauses; the user is prompted out-of-band, and on resume the secret will be present in list_secrets.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Secret env-var name (UPPER_SNAKE_CASE), e.g. 'STRIPE_SECRET_KEY'" },
          purpose: { type: "string", description: "1-line plain-English reason shown to the user, e.g. 'Required to charge customers via Stripe.'" },
          docs_url: { type: "string", description: "Optional URL where the user can find this secret in the provider's dashboard" },
        },
        required: ["name", "purpose"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_secret",
      description:
        "Delete a user-managed secret. Use ONLY when the user explicitly asks to remove an integration (e.g. 'remove Stripe', 'I no longer use Resend'). Refuses to delete platform-managed secrets (LOVABLE_*, SUPABASE_*).",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Secret env-var name to delete" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
];
