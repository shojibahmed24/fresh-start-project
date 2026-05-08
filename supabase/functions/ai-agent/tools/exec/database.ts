// ═══════════════════════════════════════════════════════════════════════════
// DATABASE EXEC — barrel (Phase 3b.5 split)
// Implementation lives in ./database/{migrations,introspection,query,rls}.ts
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolHandler } from "./database/migrations.ts";
import { exec_db_migration } from "./database/migrations.ts";
import { exec_list_tables, exec_introspect_schema } from "./database/introspection.ts";
import { exec_read_query } from "./database/query.ts";
import { exec_suggest_rls_policy } from "./database/rls.ts";

export type { ToolHandler };
export {
  exec_db_migration,
  exec_list_tables,
  exec_introspect_schema,
  exec_read_query,
  exec_suggest_rls_policy,
};

export const DATABASE_EXEC: Record<string, ToolHandler> = {
  db_migration: exec_db_migration,
  list_tables: exec_list_tables,
  introspect_schema: exec_introspect_schema,
  read_query: exec_read_query,
  suggest_rls_policy: exec_suggest_rls_policy,
};
