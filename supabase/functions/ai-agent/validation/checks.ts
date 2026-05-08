// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION — High-level file & project validators
// ───────────────────────────────────────────────────────────────────────────
// Composes the low-level parsers from ./parsers.ts to produce a list of
// ValidationIssue records for a single file (validateFile) or every file in
// the project (validateProject). Used by the run_typecheck / validate_files
// tools and by the post-write auto-verify pass.
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolContext, ValidationIssue } from "../types.ts";
import {
  FORBIDDEN_IMPORT_PATTERNS,
  ALLOWED_BARE_PACKAGES,
  extractImports,
  normalizePath,
  resolveRelativeImport,
  stripStringsAndComments,
  bracketDelta,
  jsxTagDelta,
  requiresDefaultExport,
  isComponentFile,
  scanRuntimeSafety,
  scanFunctionalCompleteness,
  scanThemeConsistency,
  scanMobileLayout,
  fileExports,
  parseImportNames,
} from "./parsers.ts";


// File-size policy. Applied only when `enforceSize` is true — the project-
// wide pass disables it so we don't endlessly nag about pre-existing large
// files; new/edited files passed via `filterPaths` get enforcement.
//
// IMPORTANT: only the EMERGENCY cap (550) is an ERROR. The "hard" cap (400)
// and soft cap (300) are WARNs — they nudge the agent to split but do NOT
// burn the heal budget chasing splits + dependent rewrites for an otherwise
// working 410-line file. The split-then-update-importers loop was the #1
// cause of files hitting MAX_WRITES_PER_FILE and getting silently suppressed.
const FILE_SIZE_SOFT = 300;
const FILE_SIZE_HARD = 400;
const FILE_SIZE_EMERGENCY = 550;

export function validateFile(
  path: string,
  content: string,
  allPaths: Set<string>,
  contentByPath?: Map<string, string>,
  enforceSize: boolean = false,
  enforceTheme: boolean = false,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!/\.(tsx?|jsx?)$/.test(path)) return issues;

  const scrubbed = stripStringsAndComments(content);

  // ── File size guard (only for newly written / edited files) ───────────
  if (enforceSize) {
    const lineCount = content.split("\n").length;
    if (lineCount > FILE_SIZE_EMERGENCY) {
      issues.push({
        path,
        problem: `File is ${lineCount} lines — exceeds the emergency cap of ${FILE_SIZE_EMERGENCY}. Split it before finishing this turn.`,
        severity: "error",
        hint:
          `Extract sub-components into /src/components/<feature>/, move seed data into /src/data/, hooks into /src/hooks/, and types into /src/types.ts. ` +
          `Then re-import them. Use bulk_write_files to write the new small files in one batch, then search_replace ${path} to remove the extracted code and add the imports.`,
      });
    } else if (lineCount > FILE_SIZE_HARD) {
      issues.push({
        path,
        problem: `File is ${lineCount} lines — above the hard cap of ${FILE_SIZE_HARD}. Should be split, but not blocking this turn.`,
        severity: "warn",
        hint: `Extract sub-components / data / hooks into their own files. Acceptable to defer 1 turn if you're mid-feature, but don't grow it further.`,
      });
    } else if (lineCount > FILE_SIZE_SOFT) {
      issues.push({
        path,
        problem: `File is ${lineCount} lines — above the soft cap of ${FILE_SIZE_SOFT}. Consider splitting before it grows further.`,
        severity: "warn",
        hint: `Extract the next sub-component, data array, or hook into its own file under /src/components/, /src/data/, or /src/hooks/.`,
      });
    }
  }

  // ── Bracket balance (now string/comment-aware) ─────────────────────────
  const delta = bracketDelta(scrubbed);
  if (delta.round !== 0) {
    issues.push({
      path,
      problem: `Unbalanced parentheses (${delta.round > 0 ? `${delta.round} extra '('` : `${-delta.round} extra ')'`})`,
      severity: "error",
      hint: "Re-read the file and match every '(' with a ')'.",
    });
  }
  if (delta.curly !== 0) {
    issues.push({
      path,
      problem: `Unbalanced braces (${delta.curly > 0 ? `${delta.curly} extra '{'` : `${-delta.curly} extra '}'`})`,
      severity: "error",
      hint: "Re-read the file and match every '{' with a '}'.",
    });
  }
  if (delta.square !== 0) {
    issues.push({
      path,
      problem: `Unbalanced brackets (${delta.square > 0 ? `${delta.square} extra '['` : `${-delta.square} extra ']'`})`,
      severity: "error",
      hint: "Re-read the file and match every '[' with a ']'.",
    });
  }

  // ── JSX tag balance ────────────────────────────────────────────────────
  if (/\.(tsx|jsx)$/.test(path) && /<[A-Za-z]/.test(scrubbed)) {
    const jsxDelta = jsxTagDelta(scrubbed);
    if (jsxDelta !== 0) {
      issues.push({
        path,
        problem: `Possible unclosed JSX tag (open vs close mismatch by ${jsxDelta})`,
        severity: jsxDelta > 0 ? "error" : "warn",
        hint: jsxDelta > 0
          ? "Add the missing `</Tag>` or convert to a self-closing `<Tag />`."
          : "Remove the extra `</Tag>` closing.",
      });
    }
  }

  // ── Hardcoded Supabase credentials guard (CRITICAL) ────────────────────
  // Generated apps MUST use the __SUPABASE_URL__ / __SUPABASE_ANON__
  // placeholders so the user's linked Supabase creds get substituted at
  // write-time. Any literal supabase.co URL or JWT-shaped anon key in source
  // means the app is hard-pinned to one project — a privacy/data-leak bug.
  // Only flag client-side files (not tool definitions or this validator).
  if (/^src\//.test(path) || /\.tsx?$/.test(path)) {
    const literalUrl = /https:\/\/[a-z0-9-]+\.supabase\.co/i;
    const jwtAnon = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/;
    if (literalUrl.test(content)) {
      issues.push({
        path,
        problem: "Hardcoded Supabase URL detected — must use the literal placeholder `__SUPABASE_URL__` instead.",
        severity: "error",
        hint:
          "Replace the literal `https://<ref>.supabase.co` string with `__SUPABASE_URL__`. The file-write pipeline substitutes it with the linked project's real URL at save-time. Hardcoding routes user data into the WRONG Supabase project.",
      });
    }
    if (jwtAnon.test(content)) {
      issues.push({
        path,
        problem: "Hardcoded Supabase anon/JWT key detected — must use the literal placeholder `__SUPABASE_ANON__` instead.",
        severity: "error",
        hint:
          "Replace the literal `eyJ…` JWT string with `__SUPABASE_ANON__`. The file-write pipeline substitutes it with the linked project's anon key at save-time.",
      });
    }
  }

  // ── Default export requirement ─────────────────────────────────────────
  if (requiresDefaultExport(path) && !/export\s+default\s/.test(scrubbed)) {
    issues.push({
      path,
      problem: `Missing \`export default\` (required for ${path})`,
      severity: "error",
      hint: "Add `export default ComponentName;` at the bottom of the file.",
    });
  }

  // ── Imports ────────────────────────────────────────────────────────────
  // Re-extract on the original src so we can see the full statement for
  // named-import parsing.
  const importStmts: { spec: string; stmt: string }[] = [];
  const importRe = /(?:^|\n)\s*import\s[^\n]*?from\s*['"]([^'"]+)['"];?|(?:^|\n)\s*import\s*['"]([^'"]+)['"];?/g;
  let im: RegExpExecArray | null;
  while ((im = importRe.exec(content)) !== null) {
    importStmts.push({ spec: im[1] || im[2], stmt: im[0] });
  }

  for (const { spec, stmt } of importStmts) {
    // Forbidden first
    let forbidden = false;
    for (const f of FORBIDDEN_IMPORT_PATTERNS) {
      if (f.pattern.test(spec)) {
        issues.push({
          path,
          problem: `Forbidden import "${spec}" — ${f.reason}`,
          severity: "error",
          hint: f.hint,
        });
        forbidden = true;
        break;
      }
    }
    if (forbidden) continue;

    // Treat `@/…` as an internal alias for `/src/…` — NOT a bare package.
    // The Vite tsconfig path alias rewrites these to relative paths at
    // build-time, so we should resolve them against project files instead
    // of warning that they're "outside the curated whitelist".
    const isAlias = spec.startsWith("@/");
    if (spec.startsWith(".") || isAlias) {
      let r;
      if (isAlias) {
        const aliasPath = "/src/" + spec.slice(2);
        r = resolveRelativeImport("/", aliasPath, allPaths);
      } else {
        r = resolveRelativeImport(normalizePath(path), spec, allPaths);
      }
      if (!r.ok) {
        issues.push({
          path,
          problem: `Unresolved import "${spec}" — no matching file in project`,
          severity: "error",
          hint: "Either create the missing file or fix the import path. Use list_files first if unsure.",
        });
        continue;
      }
      // Cross-file export validation when we have the target's content
      if (r.resolved && contentByPath?.has(r.resolved)) {
        const targetSrc = contentByPath.get(r.resolved)!;
        const exports = fileExports(targetSrc);
        const want = parseImportNames(stmt);
        if (want.default && !exports.hasDefault) {
          issues.push({
            path,
            problem: `Imports default from "${spec}" but that file has no \`export default\``,
            severity: "error",
            hint: `Add \`export default ${want.default};\` to ${r.resolved}, or switch to a named import.`,
          });
        }
        for (const n of want.named) {
          if (!exports.named.has(n)) {
            issues.push({
              path,
              problem: `Imports \`${n}\` from "${spec}" but it isn't exported there`,
              severity: "error",
              hint: `Add \`export const ${n} = …\` (or \`export function ${n}\`) in ${r.resolved}.`,
            });
          }
        }
      }
    } else {
      // Bare module — outside the curated whitelist we still let it through
      // (autofix will add it to package.json so Vite can install it). We just
      // warn so the model can swap to a known-good package if it hallucinated
      // a name. Previously this was a hard error → triggered repeated heal
      // loops on every legitimate-but-novel package import.
      if (!ALLOWED_BARE_PACKAGES.has(spec)) {
        // Skip Node built-ins; those are caught by the forbidden-import check.
        if (spec.startsWith("node:") || spec === "fs" || spec === "path") continue;
        issues.push({
          path,
          problem: `Package "${spec}" is outside the curated whitelist — it will be added to package.json automatically, but verify the name is real`,
          severity: "warn",
          hint: `Curated set: ${[...ALLOWED_BARE_PACKAGES].slice(0, 6).join(", ")}, … . If you meant a different package, swap the import; otherwise this warning can be ignored.`,
        });
      }
    }
  }

  // ── Runtime-safety scan (only for component files) ─────────────────────
  if (isComponentFile(path, content)) {
    for (const w of scanRuntimeSafety(scrubbed)) {
      issues.push({ ...w, path });
    }
    // ── Functional completeness scan (Phase 8) ──────────────────────────
    // Catches placeholder code that type-checks but isn't actually wired up:
    // empty handlers, TODO comments, `console.log` stubs, `Not implemented`
    // throws. WARN-level so it doesn't block — the agent gets actionable
    // hints to flesh things out before declaring "done".
    for (const w of scanFunctionalCompleteness(scrubbed)) {
      issues.push({ ...w, path });
    }
    // ── Theme consistency scan ───────────────────────────────────────────
    // Hardcoded grayscale (text-white, bg-gray-100), raw hex/rgb literals,
    // mixed gradient directions, and dark-mode-unreadable muted text.
    // Only run on newly-written / edited files (enforceTheme=true) — pre-
    // existing legacy files with text-white / bg-gray-* would otherwise
    // trigger ERRORs on EVERY unrelated edit and chew up the heal budget,
    // pushing the agent into a "rewrite the whole project" spiral.
    if (enforceTheme) {
      for (const w of scanThemeConsistency(content, path)) {
        issues.push({ ...w, path });
      }
    }
    // ── Mobile layout scan ───────────────────────────────────────────────
    // 100vh root, transparent bottom nav, missing pb on scrollable surface.
    // Only on newly-touched files (enforceTheme=true) so legacy files don't
    // bleed warnings into unrelated edits.
    if (enforceTheme) {
      for (const w of scanMobileLayout(content, path)) {
        issues.push({ ...w, path });
      }
    }
  }

  return issues;
}

export async function validateProject(
  ctx: ToolContext,
  filterPaths?: string[],
): Promise<{ ok: boolean; issues: ValidationIssue[]; checked: number }> {
  const { data, error } = await ctx.supabase
    .from("project_files")
    .select("path, content")
    .eq("project_id", ctx.projectId);
  if (error) return { ok: false, issues: [{ path: "*", problem: error.message, severity: "error" }], checked: 0 };

  const rows = (data ?? []) as { path: string; content: string }[];
  const allPaths = new Set(rows.map((r) => normalizePath(r.path)));
  // Index for cross-file export resolution.
  const contentByPath = new Map(rows.map((r) => [normalizePath(r.path), r.content]));
  const filterSet = filterPaths
    ? new Set(filterPaths.map((p) => normalizePath(p)))
    : null;

  const issues: ValidationIssue[] = [];
  let checked = 0;
  for (const row of rows) {
    const norm = normalizePath(row.path);
    if (filterSet && !filterSet.has(norm)) continue;
    checked++;
    // Only enforce file-size policy on the targeted (newly written / edited)
    // files. Pre-existing oversized files are left alone so we don't gate
    // unrelated edits on legacy bloat.
    const enforceSize = filterSet ? filterSet.has(norm) : false;
    const enforceTheme = filterSet ? filterSet.has(norm) : false;
    issues.push(...validateFile(row.path, row.content, allPaths, contentByPath, enforceSize, enforceTheme));
  }
  // Errors first, warns last — agent always sees the must-fix items at top.
  issues.sort((a, b) => {
    const sa = a.severity === "warn" ? 1 : 0;
    const sb = b.severity === "warn" ? 1 : 0;
    return sa - sb;
  });
  return { ok: issues.filter((i) => i.severity !== "warn").length === 0, issues, checked };
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-FIX ENGINE (Phase 7 — Self-Healing / Self-Correction)
// ───────────────────────────────────────────────────────────────────────────
// Deterministic, side-effect-free transforms that resolve the most common
// classes of build/typecheck failures BEFORE asking the LLM to retry. Every
// fix is small, safe, and reversible. Each pass returns a list of human-
// readable fix descriptions so the agent can learn what was repaired.
//
// Categories handled:
//   1. Missing imports        — lucide-react icons + React hooks used in JSX/TSX
//   2. Forbidden imports      — @/ alias → relative path (when target resolvable)
//   3. Missing default export — auto-append for App/screens when a clear
//                               component identifier exists
//   4. Duplicate imports      — collapse two `import {x} from 'y'` lines
//   5. Stripped junk          — remove dangling `// ... rest of file` markers
// ═══════════════════════════════════════════════════════════════════════════

// All single-word PascalCase exports of `lucide-react` (subset — top ~250 most
// common icons). If the LLM uses an icon name not in this list, we leave it
