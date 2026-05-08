// ═══════════════════════════════════════════════════════════════════════════
// DATABASE EXEC — introspection (list_tables, introspect_schema)
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolHandler } from "./migrations.ts";

export const exec_list_tables: ToolHandler = async (args, ctx, _callId) => {
  const includeColumns = args.include_columns !== false;
  const { data: link, error: linkErr } = await ctx.supabase
    .from("project_supabase_links")
    .select("schema_cache, schema_cached_at, supabase_project_ref")
    .eq("project_id", ctx.projectId)
    .maybeSingle();
  if (linkErr) return { result: { error: linkErr.message } };
  if (!link) {
    return {
      result: {
        error: "No Supabase project linked. Ask the user to connect Supabase first (Cloud is auto-linked).",
      },
    };
  }
  const cache: any = link.schema_cache || {};
  const tables = Array.isArray(cache.tables) ? cache.tables : [];
  const out = tables.map((t: any) => ({
    name: t.name,
    schema: t.schema || "public",
    rls_enabled: !!t.rls_enabled,
    row_count: t.live_rows_estimate ?? t.row_count ?? null,
    ...(includeColumns
      ? {
          columns: (t.columns || []).map((c: any) => ({
            name: c.name,
            type: c.data_type || c.format,
            nullable: c.is_nullable !== false,
            default: c.default_value ?? null,
          })),
        }
      : {}),
  }));
  return {
    result: {
      project_ref: link.supabase_project_ref,
      cached_at: link.schema_cached_at,
      count: out.length,
      tables: out,
      note: out.length === 0 ? "Schema cache empty. Run a migration or call introspect_schema for live data." : undefined,
    },
  };
};

export const exec_introspect_schema: ToolHandler = async (args, ctx, _callId) => {
  const target = String(args.target || "");
  const tableFilter = typeof args.table_name === "string" ? args.table_name.replace(/[^a-z0-9_]/gi, "") : "";
  const queries: Record<string, string> = {
    tables: `SELECT table_name, table_type FROM information_schema.tables WHERE table_schema='public' ${tableFilter ? `AND table_name='${tableFilter}'` : ""} ORDER BY table_name`,
    columns: `SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' ${tableFilter ? `AND table_name='${tableFilter}'` : ""} ORDER BY table_name, ordinal_position`,
    policies: `SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check FROM pg_policies WHERE schemaname='public' ${tableFilter ? `AND tablename='${tableFilter}'` : ""} ORDER BY tablename, policyname`,
    indexes: `SELECT schemaname, tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' ${tableFilter ? `AND tablename='${tableFilter}'` : ""} ORDER BY tablename, indexname`,
    foreign_keys: `SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public' ${tableFilter ? `AND tc.table_name='${tableFilter}'` : ""}`,
    triggers: `SELECT trigger_name, event_manipulation, event_object_table, action_timing FROM information_schema.triggers WHERE trigger_schema='public' ${tableFilter ? `AND event_object_table='${tableFilter}'` : ""} ORDER BY event_object_table, trigger_name`,
    functions: `SELECT routine_name, data_type AS return_type, security_type FROM information_schema.routines WHERE routine_schema='public' AND routine_type='FUNCTION' ORDER BY routine_name`,
  };
  const sql = queries[target];
  if (!sql) return { result: { error: `Unknown target: ${target}` } };
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
      body: JSON.stringify({ project_id: ctx.projectId, sql: sql + " LIMIT 500" }),
    });
    const json: any = await r.json().catch(() => ({}));
    if (!json?.ok) {
      return { result: { error: json?.error || json?.reason || "introspection failed", target } };
    }
    const rows = Array.isArray(json.result) ? json.result : (json.result?.rows ?? []);
    return { result: { target, count: rows.length, rows } };
  } catch (e: any) {
    return { result: { error: `introspect failed: ${e?.message ?? e}` } };
  }
};
