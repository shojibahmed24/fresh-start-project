// ═══════════════════════════════════════════════════════════════════════════
// TOOL EXECUTORS — Search (3 handlers)
// ───────────────────────────────────────────────────────────────────────────
// Handlers for tools defined in ../schemas/search.ts. Dispatched by
// ./index.ts → execTool(name, args, ctx, callId).
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolContext } from "../../types.ts";

export type ToolHandler = (
  args: any,
  ctx: ToolContext,
  callId: string,
) => Promise<{ result: any; askUser?: boolean }>;

export const exec_list_files: ToolHandler = async (args, ctx, callId) => {
const { data, error } = await ctx.supabase
  .from("project_files")
  .select("path")
  .eq("project_id", ctx.projectId)
  .order("path");
if (error) return { result: { error: error.message } };
return { result: { files: (data ?? []).map((r: any) => r.path) } };
};

export const exec_search_files: ToolHandler = async (args, ctx, callId) => {
if (typeof args.query !== "string" || args.query.length === 0) {
  return { result: { error: "query must be a non-empty string" } };
}
const { data, error } = await ctx.supabase
  .from("project_files")
  .select("path, content")
  .eq("project_id", ctx.projectId);
if (error) return { result: { error: error.message } };
const matches: { path: string; line: number; preview: string }[] = [];
for (const row of data ?? []) {
  const lines = (row.content as string).split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(args.query)) {
      matches.push({
        path: row.path,
        line: i + 1,
        preview: lines[i].trim().slice(0, 200),
      });
      if (matches.length >= 50) break;
    }
  }
  if (matches.length >= 50) break;
}
return { result: { query: args.query, matches } };
};

export const exec_grep_files: ToolHandler = async (args, ctx, callId) => {
if (typeof args.pattern !== "string" || args.pattern.length === 0) {
  return { result: { error: "pattern required" } };
}
let re: RegExp;
try {
  re = new RegExp(args.pattern, args.flags || "g");
} catch (e: any) {
  return { result: { error: `invalid regex: ${e?.message}` } };
}
const { data, error } = await ctx.supabase
  .from("project_files")
  .select("path, content")
  .eq("project_id", ctx.projectId);
if (error) return { result: { error: error.message } };
const filter = typeof args.path_filter === "string" ? args.path_filter : "";
const matches: { path: string; line: number; preview: string }[] = [];
for (const row of data ?? []) {
  if (filter && !(row.path as string).includes(filter)) continue;
  const lines = (row.content as string).split("\n");
  for (let i = 0; i < lines.length; i++) {
    re.lastIndex = 0;
    if (re.test(lines[i])) {
      matches.push({
        path: row.path as string,
        line: i + 1,
        preview: lines[i].trim().slice(0, 200),
      });
      if (matches.length >= 60) break;
    }
  }
  if (matches.length >= 60) break;
}
return { result: { pattern: args.pattern, matches } };
};

export const SEARCH_EXEC: Record<string, ToolHandler> = {
  list_files: exec_list_files,
  search_files: exec_search_files,
  grep_files: exec_grep_files,
};
