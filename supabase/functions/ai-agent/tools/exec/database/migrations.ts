// ═══════════════════════════════════════════════════════════════════════════
// DATABASE EXEC — migrations
// ───────────────────────────────────────────────────────────────────────────
// 1) Saves the SQL into supabase/migrations/ as a versioned file (historical
//    record + replay on rebuild).
// 2) If the project has a linked user-owned Supabase (project_supabase_links),
//    immediately EXECUTES the SQL against that Supabase via the supabase-run-sql
//    edge function (which enforces server-side safety guards).
// 3) If no Supabase is linked, returns a clear "connect Supabase first" hint
//    so the model can surface it to the user.
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolContext } from "../../../types.ts";

export type ToolHandler = (
  args: any,
  ctx: ToolContext,
  callId: string,
) => Promise<{ result: any; askUser?: boolean }>;

export const exec_db_migration: ToolHandler = async (args, ctx, _callId) => {
  if (typeof args.name !== "string" || typeof args.sql !== "string") {
    return { result: { error: "name and sql required" } };
  }
  if (!/^[a-z0-9_]+$/i.test(args.name)) {
    return { result: { error: "name must be snake_case alphanumeric" } };
  }

  // ─── 1. Persist the migration file ──────────────────────────────────────
  const ts = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14);
  const path = `/supabase/migrations/${ts}_${args.name}.sql`;
  const header = args.description ? `-- ${args.description}\n\n` : "";
  const { error: fileErr } = await ctx.supabase.from("project_files").upsert(
    {
      project_id: ctx.projectId,
      user_id: ctx.userId,
      path,
      content: header + args.sql + "\n",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id,path" },
  );
  if (fileErr) return { result: { error: fileErr.message } };
  ctx.filesChanged.push({ path, action: "created" });

  // ─── 2. Check for a linked user Supabase ────────────────────────────────
  const { data: link } = await ctx.supabase
    .from("project_supabase_links")
    .select("supabase_project_ref, supabase_project_name")
    .eq("project_id", ctx.projectId)
    .maybeSingle();

  if (!link) {
    return {
      result: {
        success: true,
        path,
        executed: false,
        warning:
          "Migration file saved but NOT executed — no Supabase project is linked. " +
          "Ask the user to connect their Supabase account (Cloud panel → Connect Supabase) " +
          "and link a project, then call db_migration again to apply it.",
      },
    };
  }

  // ─── 3. Execute against the user's linked Supabase ──────────────────────
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
      body: JSON.stringify({ project_id: ctx.projectId, sql: args.sql }),
    });
    const json: any = await r.json().catch(() => ({}));

    if (json?.blocked) {
      return {
        result: {
          success: false,
          path,
          executed: false,
          blocked: true,
          reason: json.reason,
          hint:
            "The SQL was rejected by the safety guard (e.g. DROP, TRUNCATE, " +
            "DELETE without WHERE, or touching a reserved schema). Rewrite " +
            "the migration as a forward-only schema change.",
        },
      };
    }

    if (!json?.ok) {
      return {
        result: {
          success: false,
          path,
          executed: false,
          error: json?.error || "Migration execution failed",
          target_supabase: link.supabase_project_ref,
        },
      };
    }

    return {
      result: {
        success: true,
        path,
        executed: true,
        target_supabase: link.supabase_project_ref,
        target_supabase_name: link.supabase_project_name,
        note: `Migration saved AND executed on the user's Supabase project (${link.supabase_project_ref}).`,
      },
    };
  } catch (e: any) {
    return {
      result: {
        success: false,
        path,
        executed: false,
        error: `Execution error: ${e?.message ?? e}`,
        target_supabase: link.supabase_project_ref,
      },
    };
  }
};
