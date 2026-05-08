// ═══════════════════════════════════════════════════════════════════════════
// DATABASE EXEC — read_query (SELECT-only with safety guards)
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolHandler } from "./migrations.ts";

export const exec_read_query: ToolHandler = async (args, ctx, _callId) => {
  const sqlRaw = typeof args.sql === "string" ? args.sql.trim() : "";
  if (!sqlRaw) return { result: { error: "sql required" } };
  const probe = sqlRaw.replace(/;+\s*$/, "").trim();
  if (/;/.test(probe)) {
    return { result: { error: "Only a single statement is allowed (no inner semicolons)." } };
  }
  if (!/^\s*(SELECT|WITH)\b/i.test(probe)) {
    return { result: { error: "read_query is SELECT-only. Use db_migration for schema changes." } };
  }
  if (/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|COPY)\b/i.test(probe)) {
    return { result: { error: "Write/DDL keywords not allowed in read_query." } };
  }
  const limit = Math.min(Math.max(Number(args.limit) || 100, 1), 1000);
  const finalSql = /\bLIMIT\s+\d+\s*$/i.test(probe) ? probe : `${probe} LIMIT ${limit}`;
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const r = await fetch(`${SUPABASE_URL}/functions/v1/supabase-run-sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ctx.userJwt || ANON}`,
        apikey: ANON,
      },
      body: JSON.stringify({ project_id: ctx.projectId, sql: finalSql }),
    });
    const json: any = await r.json().catch(() => ({}));
    if (!json?.ok) {
      return { result: { error: json?.error || json?.reason || "query failed" } };
    }
    const rows = Array.isArray(json.result) ? json.result : (json.result?.rows ?? []);
    return { result: { count: rows.length, rows: rows.slice(0, limit) } };
  } catch (e: any) {
    return { result: { error: `query failed: ${e?.message ?? e}` } };
  }
};
