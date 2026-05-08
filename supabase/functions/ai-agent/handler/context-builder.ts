// ═══════════════════════════════════════════════════════════════════════════
// HANDLER — fresh-turn context block builder
// ───────────────────────────────────────────────────────────────────────────
// Builds the iter-0 context block injected into the first user message:
//   • project state hint (empty? scratch? edit?)
//   • file tree (compact summary, grouped for large projects)
//   • persistent memory (last 20 entries from project_memory)
//   • recent error/fix history with recurring-error detection
// Returns null memory/error sections silently on DB failure (non-fatal).
// ═══════════════════════════════════════════════════════════════════════════

import type { createClient } from "npm:@supabase/supabase-js@2";
import { extractImports, normalizePath, resolveRelativeImport } from "../validation/parsers.ts";

export type FreshContext = {
  contextBlock: string;
  isEmptyProject: boolean;
  fileCount: number;
  hasAppEntry: boolean;
  autoBackend?: boolean;
  supabaseLinked?: boolean;
};

export async function buildFreshContext(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
): Promise<FreshContext> {
  // ── Fetch full file list (path-only is cheap) so we can build a
  // compact structure tree AND project-state hint in one query.
  const { data: filesProbe } = await supabase
    .from("project_files")
    .select("path")
    .eq("project_id", projectId);
  const allPaths: string[] = (filesProbe ?? []).map((f: any) => f.path);
  const fileCount = allPaths.length;
  const hasAppEntry = allPaths.some((p) =>
    ["/src/App.tsx", "src/App.tsx", "/App.tsx", "App.tsx"].includes(p),
  );
  const isEmptyProject = !hasAppEntry;

  // ── Build compact structure summary (max ~200 paths shown). For large
  // projects we group by top-level dir and show counts so the model still
  // gets shape awareness without 1000-line tree dumps.
  const structureSummary = (() => {
    if (fileCount === 0) return "";
    const sorted = [...allPaths].sort();
    if (sorted.length <= 200) {
      return "Project files:\n" + sorted.map((p) => `  ${p}`).join("\n");
    }
    const byDir = new Map<string, string[]>();
    for (const p of sorted) {
      const seg = p.replace(/^\//, "").split("/")[0] || "/";
      if (!byDir.has(seg)) byDir.set(seg, []);
      byDir.get(seg)!.push(p);
    }
    const lines: string[] = ["Project files (grouped, large project):"];
    for (const [dir, paths] of byDir) {
      lines.push(`  ${dir}/  (${paths.length} files)`);
      for (const p of paths.slice(0, 16)) lines.push(`    ${p}`);
      if (paths.length > 16) lines.push(`    … +${paths.length - 16} more`);
    }
    return lines.join("\n");
  })();

  // ── Inline the contents of the most-important files so the agent
  // doesn't need to spend a tool turn calling read_file for them.
  // Always inline: App.tsx, main.tsx, any types.ts, plus everything
  // under /data/ and /hooks/. Cap each file at 6KB and the total
  // inline budget at 60KB so the prompt doesn't explode for huge apps.
  let inlineFilesSection = "";
  if (fileCount > 0) {
    const isImportant = (p: string): boolean => {
      const norm = p.replace(/^\//, "");
      if (
        norm === "src/App.tsx" || norm === "App.tsx" ||
        norm === "src/main.tsx" || norm === "main.tsx" ||
        norm === "src/index.css" ||
        norm.endsWith("/types.ts") || norm === "src/types.ts" || norm === "types.ts"
      ) return true;
      if (norm.startsWith("src/data/") || norm.startsWith("data/")) return true;
      if (norm.startsWith("src/hooks/") || norm.startsWith("hooks/")) return true;
      return false;
    };
    const importantPaths = allPaths.filter(isImportant).sort();
    if (importantPaths.length > 0) {
      try {
        const { data: rows } = await supabase
          .from("project_files")
          .select("path, content")
          .eq("project_id", projectId)
          .in("path", importantPaths);
        if (rows && rows.length > 0) {
          const PER_FILE_CAP = 6_000;
          const TOTAL_BUDGET = 60_000;
          let used = 0;
          const blocks: string[] = [];
          for (const r of rows as any[]) {
            if (used >= TOTAL_BUDGET) {
              blocks.push(`  … +${(rows as any[]).length - blocks.length} more important file(s) elided (budget exhausted)`);
              break;
            }
            const raw = String(r.content ?? "");
            const slice = raw.length > PER_FILE_CAP
              ? raw.slice(0, PER_FILE_CAP) + `\n… [truncated — full file is ${raw.length} chars]`
              : raw;
            blocks.push(`### ${r.path}\n\`\`\`\n${slice}\n\`\`\``);
            used += slice.length;
          }
          inlineFilesSection =
            "Inlined source for key files (App entry, types, /data/, /hooks/) — you DO NOT need to read_file these:\n\n" +
            blocks.join("\n\n");
        }
      } catch (_) { /* non-fatal */ }
    }
  }

  // ── Project-wide dependency map (edit-mode only).
  // For every project source file, list (a) which files it imports and
  // (b) which files import it. The agent can use this to know — without
  // any tool calls — which neighbour files it must also read/update when
  // editing a given component. Caps at 60 entries to bound prompt size;
  // skipped entirely on empty/scratch projects (nothing to map).
  let depGraphSection = "";
  if (!isEmptyProject && fileCount > 0 && fileCount <= 400) {
    try {
      const { data: srcRows } = await supabase
        .from("project_files")
        .select("path, content")
        .eq("project_id", projectId);
      if (srcRows && srcRows.length > 0) {
        const rows = ((srcRows as unknown) as { path: string; content: string }[]).filter(
          (r) => /\.(tsx?|jsx?)$/.test(r.path),
        );
        const allPathSet = new Set(rows.map((r) => normalizePath(r.path)));
        const forward = new Map<string, Set<string>>();
        const reverse = new Map<string, Set<string>>();
        for (const r of rows) {
          const from = normalizePath(r.path);
          const specs = extractImports(r.content);
          const resolved = new Set<string>();
          for (const spec of specs) {
            if (!spec.startsWith(".") && !spec.startsWith("/")) continue;
            const { resolved: rp } = resolveRelativeImport(from, spec, allPathSet);
            if (rp) resolved.add(rp);
          }
          forward.set(from, resolved);
          for (const target of resolved) {
            if (!reverse.has(target)) reverse.set(target, new Set());
            reverse.get(target)!.add(from);
          }
        }
        const entries = rows
          .map((r) => {
            const p = normalizePath(r.path);
            return {
              path: p,
              imports: [...(forward.get(p) ?? [])],
              importers: [...(reverse.get(p) ?? [])],
            };
          })
          .sort((a, b) => b.importers.length - a.importers.length)
          .slice(0, 60);
        const lines: string[] = [];
        for (const e of entries) {
          if (e.importers.length === 0 && e.imports.length === 0) continue;
          const importerStr = e.importers.length > 0
            ? `← imported by [${e.importers.slice(0, 5).map((p) => p.split("/").pop()).join(", ")}${e.importers.length > 5 ? `, +${e.importers.length - 5}` : ""}]`
            : "";
          const importStr = e.imports.length > 0
            ? `→ imports [${e.imports.slice(0, 5).map((p) => p.split("/").pop()).join(", ")}${e.imports.length > 5 ? `, +${e.imports.length - 5}` : ""}]`
            : "";
          lines.push(`  ${e.path}  ${importerStr}${importerStr && importStr ? "  " : ""}${importStr}`);
        }
        if (lines.length > 0) {
          depGraphSection =
            "Project dependency map (top files by importer count — use this BEFORE editing to know which neighbours are affected):\n" +
            lines.join("\n") +
            "\n\nRule: when you edit any file shown above, you ALREADY know its importers — no list_files/grep_files needed. " +
            "If you change an exported symbol, read each importer in the SAME turn and patch them with bulk_write_files (or use rename_symbol for atomic renames).";
        }
      }
    } catch (_) { /* non-fatal */ }
  }

  // Scope locks live in project_memory under reserved category prefixes
  // (locked_feature:* / locked_design:*). They get pulled out of the
  // generic memory list and rendered as their own prominent block at
  // the top of the context, so the agent always sees them first.
  let memorySummary = "";
  let lockedScopeSummary = "";
  // Default ON. Persistence-implying apps should auto-wire Supabase unless
  // the user has explicitly opted out via memory (`auto_backend: false`).
  let autoBackend = true;
  try {
    const { data: mem } = await supabase
      .from("project_memory")
      .select("category, content, source, updated_at")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false })
      .limit(80);
    if (mem && mem.length > 0) {
      const lockedRows = mem.filter((m: any) => {
        const c = String(m.category ?? "");
        return c.startsWith("locked_feature:") || c.startsWith("locked_design:");
      });
      const otherRows = mem.filter((m: any) => !lockedRows.includes(m));

      if (lockedRows.length > 0) {
        const features = lockedRows.filter((r: any) => String(r.category).startsWith("locked_feature:"));
        const designs = lockedRows.filter((r: any) => String(r.category).startsWith("locked_design:"));
        const lines = [
          "🔒 LOCKED SCOPE — these were explicitly committed to by the user.",
          "DO NOT silently remove, rename, or contradict them. If you must change one,",
          "first call ask_user for permission, then call `unlock` only after a clear yes.",
        ];
        if (features.length > 0) {
          lines.push("", "Locked features:");
          for (const r of features) {
            lines.push(`  ✓ ${String(r.content).slice(0, 220)}`);
          }
        }
        if (designs.length > 0) {
          lines.push("", "Locked design rules:");
          for (const r of designs) {
            lines.push(`  ✓ ${String(r.content).slice(0, 220)}`);
          }
        }
        lockedScopeSummary = lines.join("\n");
      }

      if (otherRows.length > 0) {
        const lines = otherRows.slice(0, 20).map((m: any) => {
          const isAgent = m.source === "agent";
          const label = isAgent
            ? (m.category as string).replace(/^agent:/, "")
            : `[${m.category}]`;
          return `  • ${label}: ${(m.content as string).slice(0, 200)}`;
        });
        memorySummary = "Persistent project memory (from previous sessions):\n" + lines.join("\n");
      }

      const AUTO_BACKEND_RE = /\bauto[_\- ]?backend\b[\s:=]*(true|on|yes|1|enabled?)\b/i;
      const AUTO_BACKEND_OFF_RE = /\bauto[_\- ]?backend\b[\s:=]*(false|off|no|0|disabled?)\b/i;
      const explicitOn = mem.some(
        (m: any) =>
          AUTO_BACKEND_RE.test(String(m.content ?? "")) ||
          AUTO_BACKEND_RE.test(String(m.category ?? "")),
      );
      const explicitOff = mem.some(
        (m: any) =>
          AUTO_BACKEND_OFF_RE.test(String(m.content ?? "")) ||
          AUTO_BACKEND_OFF_RE.test(String(m.category ?? "")),
      );
      // Default already true; explicit OFF wins, explicit ON is a no-op.
      if (explicitOff && !explicitOn) autoBackend = false;
    }
  } catch (_) { /* non-fatal */ }

  // ── Recent error/fix history so the agent learns from past failures
  // without the user having to remind it. Detect "recurring" errors (same
  // error message ≥3 times) so the agent can flag fragile code paths.
  let errorHistorySummary = "";
  try {
    const { data: errs } = await supabase
      .from("project_error_history")
      .select("file_path, error_message, fix_kind, fix_summary, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (errs && errs.length > 0) {
      const counts = new Map<string, number>();
      for (const e of errs) {
        const key = String(e.error_message || "").slice(0, 120).toLowerCase();
        if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const recurring = [...counts.entries()].filter(([, c]) => c >= 3);

      const recent = errs.slice(0, 5).map((e: any) => {
        const file = (e.file_path || "?").split("/").pop();
        const msg = String(e.error_message || "").slice(0, 140);
        const fix = String(e.fix_summary || e.fix_kind || "").slice(0, 80);
        return `  • ${file} — ${msg}${fix ? ` → fixed: ${fix}` : ""}`;
      });

      const lines = ["Recent error history (past auto-heals — avoid repeating these mistakes):", ...recent];
      if (recurring.length > 0) {
        lines.push("");
        lines.push("⚠️ RECURRING ERRORS (≥3x — these patterns are fragile, change approach if you encounter them again):");
        for (const [msg, c] of recurring.slice(0, 3)) {
          lines.push(`  • ${c}× — ${msg}`);
        }
      }
      errorHistorySummary = lines.join("\n");
    }
  } catch (_) { /* non-fatal */ }

  // ── Per-user Supabase link status. The agent MUST know whether the
  // generated app's __SUPABASE_URL__/__SUPABASE_ANON__ placeholders will
  // actually resolve to a real database. If not, it should prompt the
  // user to connect Supabase before scaffolding any backend code.
  let supabaseLinked = false;
  let linkSummary = "";
  try {
    const { data: link } = await supabase
      .from("project_supabase_links")
      .select("supabase_project_ref, supabase_project_name, api_url")
      .eq("project_id", projectId)
      .maybeSingle();
    if (link?.supabase_project_ref) {
      supabaseLinked = true;
      linkSummary =
        `🔗 SUPABASE LINK STATUS — CONNECTED\n` +
        `  • Project: ${link.supabase_project_name || link.supabase_project_ref} (${link.supabase_project_ref})\n` +
        `  • API URL: ${link.api_url}\n` +
        `  All db_migration calls auto-execute against this Supabase. ` +
        `Generated client.ts MUST use the literal placeholders __SUPABASE_URL__ and __SUPABASE_ANON__ ` +
        `(NOT hardcoded keys) — they are substituted at write-time with the real credentials above. ` +
        `NEVER paste a literal Supabase URL or anon key into generated code.`;
    } else {
      linkSummary =
        `🔗 SUPABASE LINK STATUS — NOT CONNECTED\n` +
        `  No Supabase project is linked to this app yet.\n` +
        `  HARD RULE: if the user's request needs login, signup, persistence, admin roles, dashboard with real data, ` +
        `or any backend feature → DO NOT WRITE ANY FILES. Do NOT scaffold a placeholder "Connect Supabase" screen, ` +
        `do NOT modify App.tsx, do NOT create any component. Reply ONLY with the literal token ` +
        `\`[[supabase-connect]]\` on its own line + one short sentence asking the user to connect from the Cloud panel. ` +
        `The preview must stay unchanged. The chat connect card IS the entire UI for this turn. ` +
        `Only build (with mock data) when the request is a pure UI demo with no persistence implied.`;
    }
  } catch (_) { /* non-fatal */ }

  const projectStateHint =
    fileCount === 0
      ? `[Project state: EMPTY — no files yet. You are building from scratch. Skip list_files and start scaffolding directly: create components first, then /src/App.tsx as the entry point.]`
      : !hasAppEntry
      ? `[Project state: ${fileCount} file(s) exist but NO /src/App.tsx entry point. Treat this as a scratch build and create the full scaffold.]`
      : `[Project state: ${fileCount} existing file(s) including /src/App.tsx. This is an EDIT — read_file BEFORE changing things. The file tree below is already provided, so you do NOT need to call list_files unless you suspect it's stale.]`;

  const contextBlock = [
    projectStateHint,
    linkSummary,
    lockedScopeSummary,
    structureSummary,
    depGraphSection,
    inlineFilesSection,
    memorySummary,
    errorHistorySummary,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { contextBlock, isEmptyProject, fileCount, hasAppEntry, autoBackend, supabaseLinked };
}
