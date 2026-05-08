// ═══════════════════════════════════════════════════════════════════════════
// LLM — Intent classification + tool subset selection
// ───────────────────────────────────────────────────────────────────────────
// Each tool is tagged with a "category". Based on the user's intent + the
// current iteration, we send only the relevant subset to the LLM. This
// trims ~1,500 tokens/iteration vs. always sending all tools.
//
//   core         → always sent (read/write/bulk-write/edit/list_files, write_memory)
//   search       → grep_files (search_files dropped, redundant)
//   memory_read  → read_memory, list_memory (sent on iter 0 only)
//   interactive  → ask_user (only when request is ambiguous)
//   verify       → run_typecheck, validate_files (after iter ≥ 2 OR files changed)
//   debug        → read_console_logs (only on bug/error intent)
//   backend      → db_migration, deploy_edge_function (only on backend intent)
//   deps         → add_dependency (only on dep intent)
//   destructive  → delete_file (only on cleanup/refactor intent)
// ═══════════════════════════════════════════════════════════════════════════

import { TOOLS } from "../tools/registry.ts";

export const TOOL_CATEGORY: Record<string, string> = {
  read_file: "core",
  write_file: "core",
  bulk_write_files: "core",
  edit_file: "core",
  list_files: "core",
  write_memory: "core",
  grep_files: "search",
  search_files: "search_alt",
  read_memory: "memory_read",
  list_memory: "memory_read",
  ask_user: "interactive",
  // Phase 11 — richer interaction
  request_file_upload: "interactive",
  request_confirmation: "interactive",
  report_progress: "core",
  run_typecheck: "verify",
  validate_files: "verify",
  auto_fix_file: "verify",
  read_console_logs: "debug",
  db_migration: "backend",
  deploy_edge_function: "backend",
  add_dependency: "deps",
  delete_file: "destructive",
  get_snippet: "snippet",
  // Phase 2 — research/external & ops tools
  web_search: "research",
  fetch_url: "research",
  lookup_npm_package: "research",
  read_attachment: "core",
  read_network_requests: "debug",
  list_secrets: "backend",
  generate_image: "assets",
  read_edge_function_logs: "debug",
  // Phase 5 — database integration tools
  list_tables: "backend",
  introspect_schema: "backend",
  read_query: "backend",
  suggest_rls_policy: "backend",
  // Phase 6 — backend awareness
  request_secret: "backend",
  delete_secret: "backend",
  list_edge_functions: "backend",
  invoke_edge_function: "backend",
  // Phase 10 — Quality Gates
  run_quality_gates: "verify",
  code_quality_lint: "verify",
  accessibility_scan: "verify",
  security_audit: "verify",
  run_tests: "verify",
};

export type Intent = {
  backend: boolean;
  deps: boolean;
  debug: boolean;
  destructive: boolean;
  ambiguous: boolean;
  uiOnly: boolean;
  research: boolean;
  assets: boolean;
};

export function classifyIntent(message: string): Intent {
  const m = (message || "").toLowerCase();
  const backend = /\b(database|table|column|sql|migration|rls|policy|trigger|edge\s*function|webhook|api\s*key|auth|signup|login|server[-\s]?side|supabase\s+(table|function)|secret|env\s*var)\b/.test(m);
  const deps = /\b(install|add)\s+(?:a\s+)?(?:npm\s+|the\s+)?(?:package|library|dep(?:endency)?)|\bpackage\.json\b|\bnpm\s+install\b/.test(m);
  const debug = /\b(error|bug|broken|crash|blank\s*screen|not\s*working|fix\s+(?:the|this)|console|undefined|cannot\s+read|stack\s*trace|network|fetch\s*fail|cors|404|500)\b/.test(m);
  const destructive = /\b(delete|remove|drop)\s+(?:the\s+)?(?:file|component|page|screen)\b/.test(m);
  const ambiguous = m.trim().length < 12 || /\b(something|anything|whatever|stuff|idk|not sure)\b/.test(m);
  const uiOnly = !backend && !deps && /\b(color|colour|style|font|theme|dark|light|button|layout|ui|design|spacing|padding|margin|hero|landing|card|navbar|header|footer|responsive|mobile|tailwind)\b/.test(m);
  const research = /\b(search|look\s*up|google|docs?\s+for|documentation|how\s+to\s+(?:use|integrate)|latest\s+version|stack\s*overflow|github)\b/.test(m);
  const assets = /\b(image|illustration|icon|logo|hero\s*image|placeholder\s*image|asset|generate\s+(?:an?\s+)?(?:image|picture|photo))\b/.test(m);
  return { backend, deps, debug, destructive, ambiguous, uiOnly, research, assets };
}

export function selectTools(
  intent: Intent,
  iter: number,
  ctx: { filesChanged: { path: string; action: string }[]; matchedDomainId?: string | null },
  forced: Set<string>,
): typeof TOOLS {
  const allow = new Set<string>(["core"]);

  // search: keep grep_files only (drop literal search_files, redundant).
  allow.add("search");

  // First iteration: let the agent see what it remembers.
  if (iter === 0) allow.add("memory_read");

  // Verification tools: only after the agent has actually written files,
  // OR from iter ≥ 2 onward (where it's likely sanity-checking).
  if (ctx.filesChanged.length > 0 || iter >= 2) allow.add("verify");

  // Backend / deps / debug / destructive / research / assets — only on matching intent.
  if (intent.backend) allow.add("backend");
  if (intent.deps) allow.add("deps");
  if (intent.debug) allow.add("debug");
  if (intent.destructive) allow.add("destructive");
  if (intent.research || intent.deps || intent.backend) allow.add("research");
  if (intent.assets) allow.add("assets");

  // ask_user only when request is genuinely ambiguous.
  if (intent.ambiguous) allow.add("interactive");

  // Snippet lazy-loading: only useful when the iter-0 system prompt actually
  // listed snippet names (i.e. domain matched). Without that index, the
  // model has nothing to look up.
  if (ctx.matchedDomainId) allow.add("snippet");

  // Escalation: if a previous iteration the model tried to call a tool we
  // didn't expose, the loop adds that category to `forced` so the next call
  // includes it. Guarantees we never lock the agent out of a needed tool.
  for (const c of forced) allow.add(c);

  return TOOLS.filter((t) => {
    const cat = TOOL_CATEGORY[t.function.name] ?? "core";
    return allow.has(cat);
  });
}
