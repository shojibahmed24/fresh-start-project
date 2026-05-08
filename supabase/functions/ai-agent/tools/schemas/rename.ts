// ═══════════════════════════════════════════════════════════════════════════
// TOOL SCHEMA — rename_symbol
// ───────────────────────────────────────────────────────────────────────────
// One transactional primitive for cross-file refactors. Renames a symbol in
// the target file and rewrites EVERY importer's import clause + body usages
// (word-boundary safe). Optionally also moves the file to a new path and
// rewrites each importer's relative specifier.
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolSchema } from "../registry.ts";

export const RENAME_TOOLS: ToolSchema[] = [
  {
    type: "function",
    function: {
      name: "rename_symbol",
      description:
        "ATOMIC cross-file rename. Renames `old_name` → `new_name` inside `path` AND in every file that imports it (import clause + body usages). Optionally moves the file to `new_path` and rewrites all importer specifiers. ALWAYS prefer this over manual edit_file/write_file when renaming a component/hook/util/type — manual rewrites are the #1 cause of broken-import bugs because the agent forgets one importer. Limitations: does not rewrite string literals, dynamic imports, or JSX-as-text mentions; run `run_typecheck` after.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Project-relative path of the file that DECLARES the symbol, e.g. '/src/components/UserCard.tsx'.",
          },
          old_name: {
            type: "string",
            description: "Current identifier exported from `path` (must be a valid JS identifier).",
          },
          new_name: {
            type: "string",
            description: "New identifier (must be a valid JS identifier).",
          },
          also_rename_file: {
            type: "boolean",
            description: "If true and `new_path` is set, the file is moved AND every importer's relative path is rewritten.",
          },
          new_path: {
            type: "string",
            description: "New project-relative path when also_rename_file=true, e.g. '/src/components/ProfileCard.tsx'.",
          },
        },
        required: ["path", "old_name", "new_name"],
        additionalProperties: false,
      },
    },
  },
];
