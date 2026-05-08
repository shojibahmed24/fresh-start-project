// ═══════════════════════════════════════════════════════════════════════════
// TOOL SCHEMAS — Memory (3 tools)
// ───────────────────────────────────────────────────────────────────────────
// JSON-Schema definitions for the LLM's function-calling interface.
// Execution logic lives in `../../index.ts` execTool switch (later phase: split
// alongside this file as `./memory-exec.ts`).
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolSchema } from "../registry.ts";

export const MEMORY_TOOLS: ToolSchema[] = [
  {
    type: "function",
    function: {
      name: "read_memory",
      description:
        "Read a persistent project memory entry by key. Memory survives across chat sessions. Common keys: 'design.theme', 'design.colors', 'design.fonts', 'user.preferences', 'project.purpose'. Returns the stored value or null if not set.",
      parameters: {
        type: "object",
        properties: { key: { type: "string", description: "Memory key, e.g. 'design.colors'" } },
        required: ["key"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_memory",
      description:
        "Save a persistent note about this project that future sessions can read. Use for: confirmed design decisions (palette, fonts), explicit user preferences ('always Bangla', 'no animations'), project domain ('fitness app for trainers'), or anything the user said once and shouldn't have to repeat. Overwrites existing value.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string", description: "Memory key, e.g. 'design.theme'" },
          value: { type: "string", description: "The note to remember (1-3 sentences)" },
        },
        required: ["key", "value"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_memory",
      description:
        "List all stored memory keys for this project (with short value previews). Useful at session start to see what's already known.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
];
