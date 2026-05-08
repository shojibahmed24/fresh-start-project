// ═══════════════════════════════════════════════════════════════════════════
// TOOL SCHEMAS — User Interaction (4 tools)
// ───────────────────────────────────────────────────────────────────────────
// JSON-Schema definitions for the LLM's function-calling interface.
// Execution logic lives in `../../index.ts` execTool switch (later phase: split
// alongside this file as `./user-interaction-exec.ts`).
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolSchema } from "../registry.ts";

export const USER_INTERACTION_TOOLS: ToolSchema[] = [
  {
    type: "function",
    function: {
      name: "ask_user",
      description:
        "Ask the user a clarifying multiple-choice question when their request is genuinely ambiguous and blocks meaningful work. The agent loop pauses, the user picks an option, and execution resumes with their answer. Do NOT use for questions you can answer yourself — only when user input is truly required.",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "Clear, specific question (end with '?')",
          },
          options: {
            type: "array",
            description: "2-4 concise answer choices the user can pick from",
            items: { type: "string" },
            minItems: 2,
            maxItems: 4,
          },
          allow_other: {
            type: "boolean",
            description:
              "If true, user can also type a free-text 'Other' answer. Default true.",
          },
        },
        required: ["question", "options"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_file_upload",
      description:
        "Pause the agent and ask the user to upload one or more files (image, PDF, DOCX, code, CSV, etc.) needed to continue. Use when the task explicitly requires user-provided content — e.g. 'clone this design' (need screenshot), 'use my logo', 'process this CSV'. Files arrive as attachments on the resume turn (vision for images, parsed text for PDF/DOCX). Do NOT use just for 'nice to have' inputs — only when the work is genuinely blocked.",
      parameters: {
        type: "object",
        properties: {
          purpose: {
            type: "string",
            description: "Plain-language explanation of WHY you need the file(s) — shown to the user.",
          },
          accept: {
            type: "string",
            description: "Comma-separated MIME types or extensions (e.g. 'image/*,.pdf,.docx'). Default: any.",
          },
          multiple: {
            type: "boolean",
            description: "Allow multiple file uploads. Default false.",
          },
        },
        required: ["purpose"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_confirmation",
      description:
        "Pause the agent and require explicit user confirmation BEFORE a destructive or irreversible action. Use before: deleting many files, dropping a database table, removing user data, rotating a secret, deploying a breaking change, or any action the user might regret. The user sees a high-contrast danger dialog with a clear ACCEPT / CANCEL choice. Returns the chosen option as the resume answer.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            description: "One-line summary of what's about to happen, e.g. 'Delete 14 files from /src/legacy'.",
          },
          impact: {
            type: "string",
            description: "What will change and what cannot be undone. Be specific — counts, paths, side-effects.",
          },
          severity: {
            type: "string",
            enum: ["low", "medium", "high"],
            description: "Visual severity. 'high' = red banner + typed-confirm, 'medium' = amber, 'low' = neutral.",
          },
          confirm_label: {
            type: "string",
            description: "Custom confirm button text (default 'Confirm').",
          },
        },
        required: ["action", "impact"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "report_progress",
      description:
        "Emit a non-blocking progress update so the user sees a determinate progress bar with ETA. Call ONCE at the start with `total` (the number of major steps you plan to execute), then call again per step with `current` to advance the bar. The agent loop does NOT pause. Use for long multi-step tasks (5+ steps) so the user knows the work is moving and roughly when it'll finish. For short tasks, skip this — the timeline already shows step-by-step activity.",
      parameters: {
        type: "object",
        properties: {
          total: { type: "number", description: "Total steps in this task (set on first call)." },
          current: { type: "number", description: "Steps completed so far (0..total)." },
          label: { type: "string", description: "Short label of the current step, e.g. 'Generating products page'." },
        },
        additionalProperties: false,
      },
    },
  },
];
