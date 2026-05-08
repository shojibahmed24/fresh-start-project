// ═══════════════════════════════════════════════════════════════════════════
// RESEARCH EXEC — barrel (Phase 3b.5 split)
// Implementation lives in ./research/{web,attachments,debugging,snippets}.ts
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolHandler } from "./research/web.ts";
import { exec_web_search, exec_fetch_url, exec_lookup_npm_package } from "./research/web.ts";
import { exec_read_attachment } from "./research/attachments.ts";
import { exec_read_console_logs, exec_read_network_requests } from "./research/debugging.ts";
import { exec_get_snippet } from "./research/snippets.ts";

export type { ToolHandler };
export {
  exec_web_search,
  exec_fetch_url,
  exec_lookup_npm_package,
  exec_read_attachment,
  exec_read_console_logs,
  exec_read_network_requests,
  exec_get_snippet,
};

export const RESEARCH_EXEC: Record<string, ToolHandler> = {
  web_search: exec_web_search,
  fetch_url: exec_fetch_url,
  lookup_npm_package: exec_lookup_npm_package,
  read_attachment: exec_read_attachment,
  read_console_logs: exec_read_console_logs,
  read_network_requests: exec_read_network_requests,
  get_snippet: exec_get_snippet,
};
