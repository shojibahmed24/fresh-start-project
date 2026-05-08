// ═══════════════════════════════════════════════════════════════════════════
// DEPENDENTS — find files that import a given path
// ───────────────────────────────────────────────────────────────────────────
// After a write/edit, we surface the list of OTHER files that import the
// changed file so the agent immediately knows where ripple effects could
// land (broken named imports, missing default export, type mismatches).
// This is the cheapest possible "type-aware editing" without running tsc.
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolContext } from "../../types.ts";
import { extractImports, normalizePath, resolveRelativeImport } from "../../validation/parsers.ts";

export type Dependent = {
  path: string;
  imports: string[]; // the raw import specifier(s) that resolve to the changed file
};

/**
 * Scan every project file once and return the ones that import `targetPath`.
 * Caches the path list on ctx so repeated calls in the same turn are cheap.
 * Limits to the first 8 dependents to keep the agent context small.
 */
export async function findDependents(
  ctx: ToolContext,
  targetPath: string,
): Promise<Dependent[]> {
  const target = normalizePath(targetPath);
  const cacheKey = `__deps_files`;
  let rows = (ctx as any)[cacheKey] as { path: string; content: string }[] | undefined;
  if (!rows) {
    const { data } = await ctx.supabase
      .from("project_files")
      .select("path, content")
      .eq("project_id", ctx.projectId);
    rows = (data ?? []) as { path: string; content: string }[];
    (ctx as any)[cacheKey] = rows;
  }
  const allPaths = new Set(rows.map((r) => normalizePath(r.path)));
  const targetVariants = new Set([
    target,
    target.replace(/\.tsx?$/, ""),
    target.replace(/\.jsx?$/, ""),
    target.replace(/\/index\.(tsx?|jsx?)$/, ""),
  ]);

  const out: Dependent[] = [];
  for (const row of rows) {
    if (normalizePath(row.path) === target) continue;
    if (!/\.(tsx?|jsx?)$/.test(row.path)) continue;
    const specs = extractImports(row.content);
    const matched: string[] = [];
    for (const spec of specs) {
      if (!spec.startsWith(".") && !spec.startsWith("/")) continue;
      const { resolved } = resolveRelativeImport(normalizePath(row.path), spec, allPaths);
      if (resolved && targetVariants.has(resolved)) matched.push(spec);
    }
    if (matched.length > 0) out.push({ path: row.path, imports: matched });
    if (out.length >= 8) break;
  }
  return out;
}

/**
 * Pull the short list of named/default symbols a dependent imports from
 * the changed file — agent uses this to verify the new file still exports
 * everything those importers expect.
 */
export function summarizeImportedSymbols(content: string, specs: string[]): string[] {
  const out = new Set<string>();
  for (const spec of specs) {
    const re = new RegExp(`import\\s+([^'"\\n]+?)\\s+from\\s*['"]${spec.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}['"]`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const clause = m[1].trim();
      const def = clause.match(/^([A-Za-z_$][\w$]*)\s*(?:,|$)/);
      if (def && !clause.startsWith("{")) out.add(def[1]);
      const named = clause.match(/\{([^}]+)\}/);
      if (named) {
        for (const part of named[1].split(",")) {
          const n = part.trim().split(/\s+as\s+/)[0].trim();
          if (n) out.add(n);
        }
      }
    }
  }
  return [...out];
}

/**
 * Build a compact `dependents` payload to attach to file-op results.
 * Returns null when the file has no project-internal importers (no ripple
 * risk → don't waste tokens).
 */
export async function buildDependentsPayload(
  ctx: ToolContext,
  targetPath: string,
): Promise<
  | null
  | {
      count: number;
      files: { path: string; symbols: string[] }[];
      hint: string;
    }
> {
  const deps = await findDependents(ctx, targetPath);
  if (deps.length === 0) return null;

  // For each dependent, fetch its content from cache and extract the symbols
  // it imports from the changed file.
  const rows = ((ctx as any).__deps_files ?? []) as { path: string; content: string }[];
  const byPath = new Map(rows.map((r) => [normalizePath(r.path), r.content]));
  const files = deps.map((d) => ({
    path: d.path,
    symbols: summarizeImportedSymbols(byPath.get(normalizePath(d.path)) ?? "", d.imports),
  }));

  return {
    count: deps.length,
    files,
    hint:
      "These files import the file you just changed. If you renamed/removed an export, " +
      "or changed a prop/type signature, read each dependent and update it in the SAME turn — " +
      "do NOT finish until every importer still compiles. Use bulk_write_files to fix in one shot.",
  };
}
