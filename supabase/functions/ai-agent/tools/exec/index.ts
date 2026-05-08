// ═══════════════════════════════════════════════════════════════════════════
// TOOL EXECUTOR DISPATCHER
// ───────────────────────────────────────────────────────────────────────────
// Aggregates every per-category handler map into one `EXEC_REGISTRY` and
// exposes `execTool(name, args, ctx, callId)` — a drop-in replacement for
// the old monolithic switch in `../../index.ts`.
//
// To add a tool: add its handler to the matching schemas/<cat>.ts (schema)
// AND tools/exec/<cat>.ts (handler). Both register automatically.
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolContext } from "../../types.ts";
import type { ToolHandler } from "./file-ops.ts";

import { FILE_OPS_EXEC } from "./file-ops.ts";
import { SEARCH_EXEC } from "./search.ts";
import { MEMORY_EXEC } from "./memory.ts";
import { USER_INTERACTION_EXEC } from "./user-interaction.ts";
import { VALIDATION_EXEC } from "./validation.ts";
import { RESEARCH_EXEC } from "./research.ts";
import { DATABASE_EXEC } from "./database.ts";
import { EDGE_FUNCTIONS_EXEC } from "./edge-functions.ts";
import { SECRETS_EXEC } from "./secrets.ts";
import { MEDIA_EXEC } from "./media.ts";
import { SCOPE_LOCK_EXEC } from "./scope-lock.ts";
import { RENAME_EXEC } from "./rename.ts";

export const EXEC_REGISTRY: Record<string, ToolHandler> = {
  ...FILE_OPS_EXEC,
  ...RENAME_EXEC,
  ...SEARCH_EXEC,
  ...MEMORY_EXEC,
  ...USER_INTERACTION_EXEC,
  ...VALIDATION_EXEC,
  ...RESEARCH_EXEC,
  ...DATABASE_EXEC,
  ...EDGE_FUNCTIONS_EXEC,
  ...SECRETS_EXEC,
  ...MEDIA_EXEC,
  ...SCOPE_LOCK_EXEC,
};

export async function execTool(
  name: string,
  args: any,
  ctx: ToolContext,
  callId: string,
): Promise<{ result: any; askUser?: boolean }> {
  const handler = EXEC_REGISTRY[name];
  if (!handler) {
    return { result: { error: `Unknown tool: ${name}` } };
  }
  try {
    return await handler(args, ctx, callId);
  } catch (e: any) {
    return { result: { error: e?.message ?? String(e) } };
  }
}
