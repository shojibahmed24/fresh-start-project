// ═══════════════════════════════════════════════════════════════════════════
// EDGE-FUNCTIONS EXEC — add_dependency (mutates package.json)
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolHandler } from "./deploy.ts";

export const exec_add_dependency: ToolHandler = async (args, ctx, _callId) => {
  if (typeof args.name !== "string" || args.name.length === 0) {
    return { result: { error: "name required" } };
  }
  const forbidden = ["next", "react-router", "react-router-dom", "react-native", "axios"];
  if (forbidden.some((f) => args.name === f || args.name.startsWith(f + "/"))) {
    return { result: { error: `Forbidden package: ${args.name}` } };
  }
  const version = typeof args.version === "string" && args.version.length > 0
    ? args.version
    : "latest";
  const dev = args.dev === true;
  const { data: pkgRow } = await ctx.supabase
    .from("project_files")
    .select("content")
    .eq("project_id", ctx.projectId)
    .eq("path", "/package.json")
    .maybeSingle();
  let pkg: any;
  if (pkgRow) {
    try {
      pkg = JSON.parse(pkgRow.content as string);
    } catch {
      return { result: { error: "package.json is not valid JSON" } };
    }
  } else {
    pkg = { name: "app", version: "0.0.0", dependencies: {}, devDependencies: {} };
  }
  const bucket = dev ? "devDependencies" : "dependencies";
  pkg[bucket] = pkg[bucket] || {};
  pkg[bucket][args.name] = version.startsWith("^") || version.startsWith("~") || version === "latest"
    ? version
    : `^${version}`;
  const newContent = JSON.stringify(pkg, null, 2) + "\n";
  const { error } = await ctx.supabase.from("project_files").upsert(
    {
      project_id: ctx.projectId,
      user_id: ctx.userId,
      path: "/package.json",
      content: newContent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id,path" },
  );
  if (error) return { result: { error: error.message } };
  ctx.filesChanged.push({ path: "/package.json", action: "updated" });
  // Invalidate the pre-flight import gate cache so subsequent write_file
  // calls in this same turn see the newly added dependency.
  (ctx as any).__pkgDepsCache = undefined;
  return { result: { success: true, package: args.name, version, bucket } };
};
