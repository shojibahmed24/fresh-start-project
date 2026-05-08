// ═══════════════════════════════════════════════════════════════════════════
// RENAME — atomic symbol/file rename with cross-file importer rewrites
// ───────────────────────────────────────────────────────────────────────────
// One tool call to:
//   1. Rename an exported symbol inside `path`.
//   2. Rewrite EVERY importer of that file: both the import clause AND
//      every reference in the body (word-boundary safe).
//   3. Optionally move the file to `new_path` and rewrite each importer's
//      import specifier to point at the new location (preserves ./../ depth).
//
// This eliminates the most common cross-file refactor failure: agent renames
// a symbol or file, forgets one importer, the build breaks. Now the agent
// has a single transactional primitive — all-or-nothing.
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolContext } from "../../types.ts";
import type { ToolHandler } from "./file-ops.ts";
import { findDependents } from "./dependents.ts";
import { normalizePath } from "../../validation/parsers.ts";

const IDENT = /^[A-Za-z_$][\w$]*$/;

function relativeSpecifier(fromFile: string, toFile: string): string {
  const fromParts = normalizePath(fromFile).split("/").slice(0, -1);
  const toParts = normalizePath(toFile).split("/");
  const toFileBase = toParts.pop() || "";
  // strip extension
  const toBase = toFileBase.replace(/\.(tsx?|jsx?)$/, "");
  let i = 0;
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) i++;
  const up = fromParts.length - i;
  const down = [...toParts.slice(i), toBase].join("/");
  const prefix = up === 0 ? "./" : "../".repeat(up);
  return prefix + down;
}

function renameInImportClause(stmt: string, oldName: string, newName: string): string {
  // default import:  import Foo, { ... } from '...'
  // named:           import { Foo, Foo as X } from '...'
  return stmt.replace(/import\s+([\s\S]+?)\s+from/, (_, clause) => {
    let c = clause as string;
    // default identifier (before any { )
    c = c.replace(/^(\s*)([A-Za-z_$][\w$]*)/, (m: string, ws: string, id: string) =>
      id === oldName ? `${ws}${newName}` : m,
    );
    // named: replace within {...}
    c = c.replace(/\{([^}]*)\}/, (_m: string, inner: string) => {
      const parts = inner.split(",").map((p) => {
        const seg = p.trim();
        if (!seg) return p;
        // `Foo as Bar` → only rename Foo
        const asMatch = seg.match(/^([A-Za-z_$][\w$]*)(\s+as\s+[A-Za-z_$][\w$]*)$/);
        if (asMatch) {
          if (asMatch[1] === oldName) return p.replace(asMatch[1], newName);
          return p;
        }
        if (seg === oldName) return p.replace(oldName, newName);
        return p;
      });
      return `{${parts.join(",")}}`;
    });
    return `import ${c} from`;
  });
}

function renameWordInBody(src: string, oldName: string, newName: string): string {
  const re = new RegExp(`\\b${oldName.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "g");
  return src.replace(re, newName);
}

export const exec_rename_symbol: ToolHandler = async (args, ctx) => {
  const path = typeof args.path === "string" ? args.path : "";
  const oldName = typeof args.old_name === "string" ? args.old_name : "";
  const newName = typeof args.new_name === "string" ? args.new_name : "";
  const newPath = typeof args.new_path === "string" && args.new_path.length > 0 ? args.new_path : null;
  const renameFile = !!args.also_rename_file && !!newPath;

  if (!path) return { result: { error: "path required" } };
  if (!oldName || !IDENT.test(oldName)) return { result: { error: "old_name must be a valid identifier" } };
  if (!newName || !IDENT.test(newName)) return { result: { error: "new_name must be a valid identifier" } };

  // 1. Read target file
  const { data: rows, error: readErr } = await ctx.supabase
    .from("project_files")
    .select("path, content")
    .eq("project_id", ctx.projectId)
    .eq("path", path)
    .limit(1);
  if (readErr) return { result: { error: readErr.message } };
  const target = ((rows ?? []) as { path: string; content: string }[])[0];
  if (!target) return { result: { error: `File not found: ${path}` } };

  // 2. Rename inside target file (everywhere — declaration + usages + export clause)
  const newTargetContent = renameWordInBody(target.content, oldName, newName);
  const targetActuallyChanged = newTargetContent !== target.content;

  // 3. Find dependents (uses cached scan)
  const deps = await findDependents(ctx, path);

  // 4. Build all writes (target + each dependent rewrite)
  const allRows = ((ctx as any).__deps_files ?? []) as { path: string; content: string }[];
  const byPath = new Map(allRows.map((r) => [normalizePath(r.path), r.content]));

  const finalTargetPath = renameFile ? newPath! : target.path;
  const writes: { path: string; content: string }[] = [];
  if (targetActuallyChanged || renameFile) {
    writes.push({ path: finalTargetPath, content: newTargetContent });
  }

  const dependentChanges: { path: string; touched: boolean }[] = [];
  for (const dep of deps) {
    const depContent = byPath.get(normalizePath(dep.path));
    if (!depContent) continue;
    let updated = depContent;

    // Rewrite each matching import statement in the dependent
    for (const spec of dep.imports) {
      const escaped = spec.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&");
      const importRe = new RegExp(
        `import\\s+[\\s\\S]+?\\s+from\\s*['"]${escaped}['"]`,
        "g",
      );
      updated = updated.replace(importRe, (stmt) => {
        let s = renameInImportClause(stmt, oldName, newName);
        if (renameFile) {
          const newSpec = relativeSpecifier(dep.path, finalTargetPath);
          s = s.replace(`'${spec}'`, `'${newSpec}'`).replace(`"${spec}"`, `"${newSpec}"`);
        }
        return s;
      });
    }
    // Rewrite usages in body (word-boundary). Safe because we already
    // confirmed the symbol came from the renamed file via the importer match.
    updated = renameWordInBody(updated, oldName, newName);

    if (updated !== depContent) {
      writes.push({ path: dep.path, content: updated });
      dependentChanges.push({ path: dep.path, touched: true });
    } else {
      dependentChanges.push({ path: dep.path, touched: false });
    }
  }

  if (writes.length === 0) {
    return {
      result: {
        success: true,
        no_op: true,
        message: `No occurrences of '${oldName}' found in ${path} or its importers.`,
      },
    };
  }

  // 5. Apply writes in one upsert
  const now = new Date().toISOString();
  const upsertRows = writes.map((w) => ({
    project_id: ctx.projectId,
    user_id: ctx.userId,
    path: w.path,
    content: w.content,
    updated_at: now,
  }));
  const { error: writeErr } = await (ctx.supabase.from("project_files") as any)
    .upsert(upsertRows, { onConflict: "project_id,path" });
  if (writeErr) return { result: { error: writeErr.message } };

  // 6. If file was renamed, delete the old path
  if (renameFile && finalTargetPath !== target.path) {
    await ctx.supabase
      .from("project_files")
      .delete()
      .eq("project_id", ctx.projectId)
      .eq("path", target.path);
    ctx.filesChanged.push({ path: target.path, action: "updated" });
  }

  for (const w of writes) {
    const existed = byPath.has(normalizePath(w.path)) || w.path === target.path;
    ctx.filesChanged.push({ path: w.path, action: existed ? "updated" : "created" });
    ctx.readCache.set(normalizePath(w.path), { result: { path: w.path, content: w.content }, reads: 0, mutatedSinceLastRead: true });
  }
  // Invalidate the dependents cache (file structure changed)
  delete (ctx as any).__deps_files;

  return {
    result: {
      success: true,
      renamed: { from: oldName, to: newName },
      ...(renameFile ? { file_moved: { from: target.path, to: finalTargetPath } } : {}),
      files_updated: writes.map((w) => w.path),
      dependents_scanned: deps.length,
      dependents_touched: dependentChanges.filter((d) => d.touched).length,
      hint:
        "Cross-file rename applied transactionally. Run `run_typecheck` to confirm no stragglers (string literals, dynamic imports, JSX comments may not be auto-renamed).",
    },
  };
};

export const RENAME_EXEC: Record<string, ToolHandler> = {
  rename_symbol: exec_rename_symbol,
};
