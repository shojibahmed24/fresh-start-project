// ═══════════════════════════════════════════════════════════════════════════
// RESEARCH EXEC — debugging (console logs + network requests)
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolHandler } from "./web.ts";

export const exec_read_console_logs: ToolHandler = async (args, ctx, _callId) => {
  const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 50);
  const q = ctx.supabase
    .from("project_error_history")
    .select("file_path, error_message, error_stack, fix_kind, created_at")
    .eq("project_id", ctx.projectId)
    .order("created_at", { ascending: false })
    .limit(limit);
  const { data, error } = await q;
  if (error) return { result: { error: error.message } };
  let rows = (data ?? []) as any[];
  if (typeof args.search === "string" && args.search.length > 0) {
    const needle = args.search.toLowerCase();
    rows = rows.filter((r) =>
      (r.error_message || "").toLowerCase().includes(needle),
    );
  }
  return {
    result: {
      count: rows.length,
      entries: rows.map((r) => ({
        file: r.file_path,
        kind: r.fix_kind,
        message: r.error_message,
        stack: r.error_stack ? String(r.error_stack).slice(0, 500) : null,
        at: r.created_at,
      })),
    },
  };
};

export const exec_read_network_requests: ToolHandler = async (args, ctx, _callId) => {
  const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 50);
  const errorsOnly = (args.status_filter ?? "errors") !== "all";
  const q = ctx.supabase
    .from("project_error_history")
    .select("file_path, error_message, error_stack, fix_kind, created_at")
    .eq("project_id", ctx.projectId)
    .order("created_at", { ascending: false })
    .limit(limit * 3);
  const { data, error } = await q;
  if (error) return { result: { error: error.message } };
  let rows = (data ?? []) as any[];
  rows = rows.filter((r) => {
    const msg = String(r.error_message || "");
    return /\b(fetch|network|cors|http|status\s*[45]\d\d|failed to fetch|xhr|api)\b/i.test(msg) ||
           String(r.fix_kind || "").includes("network");
  });
  if (errorsOnly) {
    rows = rows.filter((r) => /\b(fail|error|[45]\d\d)\b/i.test(String(r.error_message || "")));
  }
  rows = rows.slice(0, limit);
  return {
    result: {
      count: rows.length,
      entries: rows.map((r) => ({
        message: r.error_message,
        stack: r.error_stack ? String(r.error_stack).slice(0, 300) : null,
        at: r.created_at,
      })),
    },
  };
};
