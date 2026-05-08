// ═══════════════════════════════════════════════════════════════════════════
// TOOL EXECUTORS — Scope Lock (4 handlers)
// ───────────────────────────────────────────────────────────────────────────
// Locks live in project_memory under reserved category prefixes:
//   • locked_feature:<slug>
//   • locked_design:<slug>
// where <slug> = lowercased name with non-alnum collapsed to '-'.
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolContext } from "../../types.ts";
import type { ToolHandler } from "./memory.ts";

function slugify(name: string): string {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "unnamed";
}

async function upsertLock(
  ctx: ToolContext,
  category: string,
  content: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Try to find existing.
  const { data: existing } = await ctx.supabase
    .from("project_memory")
    .select("id")
    .eq("project_id", ctx.projectId)
    .eq("category", category)
    .maybeSingle();
  if (existing?.id) {
    const { error } = await ctx.supabase
      .from("project_memory")
      .update({ content, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await ctx.supabase.from("project_memory").insert({
      project_id: ctx.projectId,
      user_id: ctx.userId,
      category,
      content,
      source: "agent",
      weight: 5,
    });
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

export const exec_lock_feature: ToolHandler = async (args, ctx, _callId) => {
  if (typeof args.name !== "string" || !args.name.trim()) {
    return { result: { error: "name required" } };
  }
  const slug = slugify(args.name);
  const category = `locked_feature:${slug}`;
  const desc = typeof args.description === "string" && args.description.trim()
    ? args.description.trim()
    : args.name.trim();
  const content = `${args.name.trim()} — ${desc}`;
  const r = await upsertLock(ctx, category, content);
  if (!r.ok) return { result: { error: r.error } };
  ctx.memoryDirty = true;
  return { result: { success: true, kind: "feature", name: args.name, slug } };
};

export const exec_lock_design: ToolHandler = async (args, ctx, _callId) => {
  if (typeof args.name !== "string" || typeof args.rule !== "string") {
    return { result: { error: "name and rule required" } };
  }
  const slug = slugify(args.name);
  const category = `locked_design:${slug}`;
  const content = `${args.name.trim()} — ${args.rule.trim()}`;
  const r = await upsertLock(ctx, category, content);
  if (!r.ok) return { result: { error: r.error } };
  ctx.memoryDirty = true;
  return { result: { success: true, kind: "design", name: args.name, slug } };
};

export const exec_list_locks: ToolHandler = async (_args, ctx, _callId) => {
  const { data, error } = await ctx.supabase
    .from("project_memory")
    .select("category, content, updated_at")
    .eq("project_id", ctx.projectId)
    .or("category.like.locked_feature:%,category.like.locked_design:%")
    .order("updated_at", { ascending: false });
  if (error) return { result: { error: error.message } };
  const entries = (data ?? []).map((r: any) => {
    const cat = String(r.category);
    const kind = cat.startsWith("locked_feature:") ? "feature" : "design";
    const name = cat.replace(/^locked_(feature|design):/, "");
    return { kind, name, content: String(r.content ?? "") };
  });
  return { result: { entries, count: entries.length } };
};

export const exec_unlock: ToolHandler = async (args, ctx, _callId) => {
  if (args.kind !== "feature" && args.kind !== "design") {
    return { result: { error: "kind must be 'feature' or 'design'" } };
  }
  if (typeof args.name !== "string" || !args.name.trim()) {
    return { result: { error: "name required" } };
  }
  const slug = slugify(args.name);
  const category = `locked_${args.kind}:${slug}`;
  const { error } = await ctx.supabase
    .from("project_memory")
    .delete()
    .eq("project_id", ctx.projectId)
    .eq("category", category);
  if (error) return { result: { error: error.message } };
  ctx.memoryDirty = true;
  return { result: { success: true, removed: category } };
};

export const SCOPE_LOCK_EXEC: Record<string, ToolHandler> = {
  lock_feature: exec_lock_feature,
  lock_design: exec_lock_design,
  list_locks: exec_list_locks,
  unlock: exec_unlock,
};
