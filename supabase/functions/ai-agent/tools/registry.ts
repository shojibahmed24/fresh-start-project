// ═══════════════════════════════════════════════════════════════════════════
// TOOL REGISTRY — aggregates per-category tool schemas
// ───────────────────────────────────────────────────────────────────────────
// The full set of tool definitions is split across `./schemas/*.ts` files
// grouped by domain (file ops, search, database, etc.) so each file stays
// small and easy to edit. This file simply re-exports the combined `TOOLS`
// array used by the agent loop in `../index.ts`.
//
// To add a tool: edit (or create) the matching schemas/<category>.ts file.
// To add a whole new category: create schemas/<name>.ts and import below.
// ═══════════════════════════════════════════════════════════════════════════

export interface ToolSchema {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}
export type Tool = ToolSchema;

import { FILE_OPS_TOOLS } from "./schemas/file-ops.ts";
import { SEARCH_TOOLS } from "./schemas/search.ts";
import { MEMORY_TOOLS } from "./schemas/memory.ts";
import { USER_INTERACTION_TOOLS } from "./schemas/user-interaction.ts";
import { VALIDATION_TOOLS } from "./schemas/validation.ts";
import { RESEARCH_TOOLS } from "./schemas/research.ts";
import { DATABASE_TOOLS } from "./schemas/database.ts";
import { EDGE_FUNCTIONS_TOOLS } from "./schemas/edge-functions.ts";
import { SECRETS_TOOLS } from "./schemas/secrets.ts";
import { MEDIA_TOOLS } from "./schemas/media.ts";
import { SCOPE_LOCK_TOOLS } from "./schemas/scope-lock.ts";
import { RENAME_TOOLS } from "./schemas/rename.ts";

export const TOOLS: ToolSchema[] = [
  ...FILE_OPS_TOOLS,
  ...RENAME_TOOLS,
  ...SEARCH_TOOLS,
  ...MEMORY_TOOLS,
  ...USER_INTERACTION_TOOLS,
  ...VALIDATION_TOOLS,
  ...RESEARCH_TOOLS,
  ...DATABASE_TOOLS,
  ...EDGE_FUNCTIONS_TOOLS,
  ...SECRETS_TOOLS,
  ...MEDIA_TOOLS,
  ...SCOPE_LOCK_TOOLS,
];
