// ═══════════════════════════════════════════════════════════════════════════
// EDGE-FUNCTIONS EXEC — deploy + list
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolContext } from "../../../types.ts";

export type ToolHandler = (
  args: any,
  ctx: ToolContext,
  callId: string,
) => Promise<{ result: any; askUser?: boolean }>;

export const exec_deploy_edge_function: ToolHandler = async (args, ctx, _callId) => {
  if (typeof args.name !== "string" || typeof args.code !== "string") {
    return { result: { error: "name and code required" } };
  }
  if (!/^[a-z0-9-]+$/.test(args.name)) {
    return { result: { error: "name must be kebab-case (a-z, 0-9, -)" } };
  }
  const path = `/supabase/functions/${args.name}/index.ts`;
  const { data: existing } = await ctx.supabase
    .from("project_files")
    .select("id")
    .eq("project_id", ctx.projectId)
    .eq("path", path)
    .maybeSingle();
  const action = existing ? "updated" : "created";
  const { error } = await ctx.supabase.from("project_files").upsert(
    {
      project_id: ctx.projectId,
      user_id: ctx.userId,
      path,
      content: args.code,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id,path" },
  );
  if (error) return { result: { error: error.message } };
  ctx.filesChanged.push({ path, action });
  let configNote = "";
  if (args.verify_jwt === false) {
    const { data: cfgRow } = await ctx.supabase
      .from("project_files")
      .select("content")
      .eq("project_id", ctx.projectId)
      .eq("path", "/supabase/config.toml")
      .maybeSingle();
    const block = `\n[functions.${args.name}]\nverify_jwt = false\n`;
    const newCfg = (cfgRow?.content as string ?? "") + block;
    await ctx.supabase.from("project_files").upsert(
      {
        project_id: ctx.projectId,
        user_id: ctx.userId,
        path: "/supabase/config.toml",
        content: newCfg,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,path" },
    );
    ctx.filesChanged.push({ path: "/supabase/config.toml", action: "updated" });
    configNote = " config.toml updated (verify_jwt=false).";
  }
  return {
    result: {
      success: true,
      path,
      action,
      note: `Edge function ${action}. The build pipeline will deploy it.${configNote}`,
    },
  };
};

export const exec_list_edge_functions: ToolHandler = async (_args, ctx, _callId) => {
  const { data, error } = await ctx.supabase
    .from("project_files")
    .select("path, updated_at")
    .eq("project_id", ctx.projectId)
    .like("path", "/supabase/functions/%/index.ts");
  if (error) return { result: { error: error.message } };
  const fns = (data ?? []).map((row: any) => {
    const m = String(row.path).match(/\/supabase\/functions\/([^/]+)\/index\.ts$/);
    return { name: m?.[1] ?? row.path, path: row.path, updated_at: row.updated_at };
  });
  return { result: { count: fns.length, functions: fns } };
};
