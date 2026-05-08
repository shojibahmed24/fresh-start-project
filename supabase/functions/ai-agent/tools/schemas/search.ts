// ═══════════════════════════════════════════════════════════════════════════
// TOOL SCHEMAS — Search (3 tools)
// ───────────────────────────────────────────────────────────────────────────
// JSON-Schema definitions for the LLM's function-calling interface.
// Execution logic lives in `../../index.ts` execTool switch (later phase: split
// alongside this file as `./search-exec.ts`).
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolSchema } from "../registry.ts";

export const SEARCH_TOOLS: ToolSchema[] = [
  {
    type: "function",
    function: {
      name: "list_files",
      description:
        "List all files currently in the project. Use to discover what exists before making changes. Returns an array of file paths.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_files",
      description:
        "Search for a substring across all project files. Returns matching file paths and the line where the match was found. Use to locate where a function, import, or pattern is used.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Literal substring to search for (case-sensitive)",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "grep_files",
      description:
        "Regex search across project files. More powerful than search_files (literal). Use to find usages of a hook, component, import path. Returns matches with line context.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "JavaScript regex source (no /.../)" },
          flags: { type: "string", description: "Regex flags, e.g. 'i'. Default 'g'." },
          path_filter: {
            type: "string",
            description: "Optional substring to filter file paths (e.g. '.tsx', '/components/').",
          },
        },
        required: ["pattern"],
        additionalProperties: false,
      },
    },
  },
];
