// ═══════════════════════════════════════════════════════════════════════════
// TOOL EXECUTORS — Memory (3 handlers)
// ───────────────────────────────────────────────────────────────────────────
// Handlers for tools defined in ../schemas/memory.ts. Dispatched by
// ./index.ts → execTool(name, args, ctx, callId).
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolContext } from "../../types.ts";

export type ToolHandler = (
  args: any,
  ctx: ToolContext,
  callId: string,
) => Promise<{ result: any; askUser?: boolean }>;

export const exec_read_memory: ToolHandler = async (args, ctx, callId) => {
if (typeof args.key !== "string") return { result: { error: "key required" } };
const { data } = await ctx.supabase
  .from("project_memory")
  .select("content")
  .eq("project_id", ctx.projectId)
  .eq("category", `agent:${args.key}`)
  .eq("source", "agent")
  .maybeSingle();
return { result: { key: args.key, value: data?.content ?? null } };
};

export const exec_write_memory: ToolHandler = async (args, ctx, callId) => {
if (typeof args.key !== "string" || typeof args.value !== "string") {
  return { result: { error: "key and value must be strings" } };
}
const category = `agent:${args.key}`;
// Upsert by (project_id, category) — find existing then update/insert.
const { data: existing } = await ctx.supabase
  .from("project_memory")
  .select("id")
  .eq("project_id", ctx.projectId)
  .eq("category", category)
  .eq("source", "agent")
  .maybeSingle();
if (existing?.id) {
  const { error } = await ctx.supabase
    .from("project_memory")
    .update({ content: args.value, updated_at: new Date().toISOString() })
    .eq("id", existing.id);
  if (error) return { result: { error: error.message } };
} else {
  const { error } = await ctx.supabase.from("project_memory").insert({
    project_id: ctx.projectId,
    user_id: ctx.userId,
    category,
    content: args.value,
    source: "agent",
    weight: 1,
  });
  if (error) return { result: { error: error.message } };
}
ctx.memoryDirty = true;
return { result: { success: true, key: args.key } };
};

export const exec_list_memory: ToolHandler = async (args, ctx, callId) => {
const { data, error } = await ctx.supabase
  .from("project_memory")
  .select("category, content, updated_at")
  .eq("project_id", ctx.projectId)
  .eq("source", "agent")
  .order("updated_at", { ascending: false })
  .limit(40);
if (error) return { result: { error: error.message } };
const entries = (data ?? []).map((r: any) => ({
  key: String(r.category).replace(/^agent:/, ""),
  preview: String(r.content).slice(0, 200),
}));
return { result: { entries } };
};

export const MEMORY_EXEC: Record<string, ToolHandler> = {
  read_memory: exec_read_memory,
  write_memory: exec_write_memory,
  list_memory: exec_list_memory,
};
