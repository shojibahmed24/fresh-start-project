// ═══════════════════════════════════════════════════════════════════════════
// TOOL SCHEMAS — Scope Lock (4 tools)
// ───────────────────────────────────────────────────────────────────────────
// "Locks" are persistent commitments stored in project_memory with a
// reserved category prefix:
//   • locked_feature:<slug>  — a feature the user explicitly asked for
//   • locked_design:<slug>   — a design rule (palette, font, layout) the
//                              user explicitly committed to
// The agent MUST NOT remove or contradict these without first calling
// ask_user. The lock list is injected into every fresh-turn context block.
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolSchema } from "../registry.ts";

export const SCOPE_LOCK_TOOLS: ToolSchema[] = [
  {
    type: "function",
    function: {
      name: "lock_feature",
      description:
        "Permanently mark a feature as part of the project's locked scope. Call this when the user explicitly requests a feature in their first prompt or says 'I need X' / 'add Y permanently' / 'never remove Z'. Future agent turns will see this in the context and MUST NOT silently drop it. To remove a feature, the agent must first ask_user for permission and then call `unlock_feature`. Idempotent — re-locking the same name updates the description.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Short feature name, e.g. 'Wishlist', 'Admin dashboard', 'User reviews'. Used as the slug.",
          },
          description: {
            type: "string",
            description: "1-2 sentence description of WHAT the feature does and WHY it was requested. Helps future agents understand intent.",
          },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lock_design",
      description:
        "Permanently mark a design rule as part of the locked scope (color palette, font choice, layout style, theme, animation preference). Call when the user explicitly commits to a visual decision: 'always dark theme', 'use SF Pro for headings', 'no animations'. Future agent turns will see this and MUST NOT contradict it without permission.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Short rule name, e.g. 'Dark theme', 'Brand color palette', 'No motion'.",
          },
          rule: {
            type: "string",
            description: "The exact rule (1-3 sentences). e.g. 'Use HSL #D4AF37 as primary accent.' or 'All headings use SF Pro Display, body uses Inter.'",
          },
        },
        required: ["name", "rule"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_locks",
      description:
        "List every currently locked feature and design rule for this project. Use at the start of complex turns to remind yourself what cannot be silently changed. Returns an array of { kind, name, content }.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "unlock",
      description:
        "Remove a previously-locked feature or design rule. ONLY call this after explicitly asking the user via ask_user and receiving a yes. Never unlock silently — that defeats the purpose of locking.",
      parameters: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["feature", "design"],
            description: "Which lock list to modify",
          },
          name: {
            type: "string",
            description: "The lock name (matches the `name` used at lock time, case-insensitive).",
          },
        },
        required: ["kind", "name"],
        additionalProperties: false,
      },
    },
  },
];
