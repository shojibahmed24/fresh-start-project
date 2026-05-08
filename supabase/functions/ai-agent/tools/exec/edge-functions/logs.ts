// ═══════════════════════════════════════════════════════════════════════════
// EDGE-FUNCTIONS EXEC — read logs (Mgmt API → Logflare, falls back to local)
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolHandler } from "./deploy.ts";

export const exec_read_edge_function_logs: ToolHandler = async (args, ctx, _callId) => {
  if (typeof args.function_name !== "string") {
    return { result: { error: "function_name required" } };
  }
  const fnName = args.function_name.replace(/[^a-z0-9-]/gi, "");
  const limit = Math.min(Math.max(Number(args.limit) || 30, 1), 100);
  try {
    const { data: link } = await ctx.supabase
      .from("project_supabase_links")
      .select("supabase_project_ref")
      .eq("project_id", ctx.projectId)
      .maybeSingle();
    if (link?.supabase_project_ref) {
      try {
        const { getValidAccessToken, SBOAUTH_API_BASE } = await import("../../_shared/sboauth.ts");
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const { createClient } = await import("npm:@supabase/supabase-js@2.45.0");
        const admin = createClient(SUPABASE_URL, SERVICE);
        const accessToken = await getValidAccessToken(admin, ctx.userId);
        const sql = `select id, timestamp, event_message, metadata from function_logs where event_message is not null order by timestamp desc limit ${limit}`;
        const r = await fetch(
          `${SBOAUTH_API_BASE}/projects/${link.supabase_project_ref}/analytics/endpoints/logs.all?sql=${encodeURIComponent(sql)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (r.ok) {
          const json: any = await r.json().catch(() => ({}));
          const allRows = Array.isArray(json?.result) ? json.result : [];
          const filtered = allRows.filter((row: any) => {
            const meta = Array.isArray(row?.metadata) ? row.metadata[0] : row?.metadata;
            return !fnName || (meta?.function_id || meta?.execution_id || row?.event_message || "").toString().includes(fnName);
          }).slice(0, limit);
          return {
            result: {
              function: fnName,
              source: "supabase_management_api",
              count: filtered.length,
              logs: filtered.map((row: any) => ({
                timestamp: row.timestamp,
                message: row.event_message,
              })),
            },
          };
        }
      } catch (_e) { /* fall through to local table */ }
    }
    const { data, error } = await ctx.supabase
      .from("edge_function_logs" as any)
      .select("level, message, timestamp")
      .eq("function_name", fnName)
      .order("timestamp", { ascending: false })
      .limit(limit);
    if (error) {
      return {
        result: {
          note: "No live logs available. Link Supabase via the connect button, or check the dashboard manually.",
          function: fnName,
          source: "none",
        },
      };
    }
    return {
      result: {
        function: fnName,
        source: "local_cache",
        count: (data ?? []).length,
        logs: data ?? [],
      },
    };
  } catch (e: any) {
    return { result: { error: `logs error: ${e?.message ?? e}` } };
  }
};
