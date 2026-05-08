// ═══════════════════════════════════════════════════════════════════════════
// TOOL SCHEMAS — File Ops (5 tools)
// ───────────────────────────────────────────────────────────────────────────
// JSON-Schema definitions for the LLM's function-calling interface.
// Execution logic lives in `../../index.ts` execTool switch (later phase: split
// alongside this file as `./file-ops-exec.ts`).
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolSchema } from "../registry.ts";

export const FILE_OPS_TOOLS: ToolSchema[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Read the current content of a file in the project. Use BEFORE editing existing files. Returns the full file content as a string, or an error if the file does not exist.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Project-relative file path, e.g. '/src/App.tsx'",
          },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description:
        "Create a new file or REPLACE an existing file with the provided content. The entire file is overwritten — you must provide the complete new content. Use after read_file when modifying existing files.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Project-relative file path, e.g. '/src/App.tsx'",
          },
          content: {
            type: "string",
            description: "Complete new file content (entire file is replaced)",
          },
        },
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_write_files",
      description:
        "Create or replace multiple files in ONE tool call. Prefer this for scratch builds and multi-file features so code generation finishes before the Edge Function time limit. Each file content must be complete.",
      parameters: {
        type: "object",
        properties: {
          files: {
            type: "array",
            description: "Files to create or replace",
            minItems: 1,
            maxItems: 12,
            items: {
              type: "object",
              properties: {
                path: { type: "string", description: "Project-relative file path, e.g. '/src/App.tsx'" },
                content: { type: "string", description: "Complete new file content" },
              },
              required: ["path", "content"],
              additionalProperties: false,
            },
          },
        },
        required: ["files"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_file",
      description:
        "Make a small, targeted edit to an existing file using literal search-and-replace. MUCH cheaper than write_file when changing only a few lines. You MUST read_file first and copy `search` from the raw file content exactly. Do not invent stale context, do not HTML/JSON-escape JSX, and do not reuse snippets from previous failed edits. The `search` text must appear EXACTLY ONCE in the file (use enough surrounding context to make it unique). If this fails, read_file once and retry with a fresh exact raw block; for large rewrites use write_file instead.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Project-relative file path, e.g. '/src/App.tsx'" },
          search: { type: "string", description: "Exact existing raw source text copied from read_file (must match once; no escaped JSX/HTML)" },
          replace: { type: "string", description: "New raw source text to put in its place (no JSON/HTML escaping beyond normal tool-call string encoding)" },
        },
        required: ["path", "search", "replace"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description:
        "Permanently remove a file. The tool REFUSES the delete if other files still import this path (returns a dependents list). Migrate or rewrite every importer first (use rename_symbol or bulk_write_files) — then either the dependents list is empty or you pass `force: true` to override.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Project-relative file path to delete" },
          force: {
            type: "boolean",
            description: "Bypass the dependents-still-importing safety check. Only set true after you have already updated every importer in this same turn.",
          },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
];
