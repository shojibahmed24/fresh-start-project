// ═══════════════════════════════════════════════════════════════════════════
// EDGE-FUNCTIONS EXEC — barrel (Phase 3b.5 split)
// Implementation lives in ./edge-functions/{deploy,invoke,logs,dependencies}.ts
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolHandler } from "./edge-functions/deploy.ts";
import { exec_deploy_edge_function, exec_list_edge_functions } from "./edge-functions/deploy.ts";
import { exec_invoke_edge_function } from "./edge-functions/invoke.ts";
import { exec_read_edge_function_logs } from "./edge-functions/logs.ts";
import { exec_add_dependency } from "./edge-functions/dependencies.ts";

export type { ToolHandler };
export {
  exec_deploy_edge_function,
  exec_list_edge_functions,
  exec_invoke_edge_function,
  exec_read_edge_function_logs,
  exec_add_dependency,
};

export const EDGE_FUNCTIONS_EXEC: Record<string, ToolHandler> = {
  deploy_edge_function: exec_deploy_edge_function,
  list_edge_functions: exec_list_edge_functions,
  invoke_edge_function: exec_invoke_edge_function,
  read_edge_function_logs: exec_read_edge_function_logs,
  add_dependency: exec_add_dependency,
};
