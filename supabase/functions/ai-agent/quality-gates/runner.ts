// ═══════════════════════════════════════════════════════════════════════════
// QUALITY GATES RUNNER — fans out to lint/types/a11y/security/tests + merges
// ───────────────────────────────────────────────────────────────────────────
// classifyRuntimeError translates raw runtime/TS-style messages into
// actionable hints for the agent ("X is a lucide-react icon — add ...").
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolContext, GateResult } from "../types.ts";
import { validateProject } from "../validation/checks.ts";
import { LUCIDE_ICONS, REACT_NAMED } from "../autofix.ts";
import { runLintGate } from "./lint.ts";
import { runA11yGate } from "./a11y.ts";
import { runSecurityAudit } from "./security.ts";
import { runTestsGate } from "./tests.ts";

export async function runAllQualityGates(
  ctx: ToolContext,
  opts: { gates?: string[]; filterPaths?: string[] } = {},
): Promise<{ ok: boolean; gates: GateResult[]; summary: Record<string, number> }> {
  const want = new Set(opts.gates ?? ["lint", "types", "a11y", "security", "tests"]);
  const gates: GateResult[] = [];

  if (want.has("types")) {
    const v = await validateProject(ctx, opts.filterPaths);
    gates.push({
      name: "types",
      ok: v.ok,
      checked: v.checked,
      findings: v.issues.map((i) => ({
        path: i.path,
        rule: "type-check",
        severity: (i.severity ?? "error") as "error" | "warn" | "info",
        problem: i.problem,
        hint: i.hint,
      })),
    });
  }
  if (want.has("lint")) gates.push(await runLintGate(ctx, opts.filterPaths));
  if (want.has("a11y")) gates.push(await runA11yGate(ctx, opts.filterPaths));
  if (want.has("security")) gates.push(await runSecurityAudit(ctx));
  if (want.has("tests")) gates.push(await runTestsGate(ctx));

  const summary: Record<string, number> = { errors: 0, warnings: 0, info: 0 };
  for (const g of gates) {
    for (const f of g.findings) {
      if (f.severity === "error") summary.errors++;
      else if (f.severity === "warn") summary.warnings++;
      else summary.info++;
    }
  }
  const ok = gates.every((g) => g.ok);
  return { ok, gates, summary };
}

// Translate raw runtime/typescript-style error messages into actionable
// hints for the agent. Catches the most common compile/runtime classes:
//   • "Cannot find name 'X'"           → suggest import
//   • "Cannot find module 'X'"         → check path or create file
//   • "X is not defined"               → likely missing import
//   • "Property 'X' does not exist"    → typo / missing field
export function classifyRuntimeError(message: string): string | null {
  const msg = String(message || "");
  let m = msg.match(/Cannot find name '([^']+)'/);
  if (m) {
    const name = m[1];
    if (LUCIDE_ICONS.has(name)) return `'${name}' is a lucide-react icon — add \`import { ${name} } from "lucide-react";\``;
    if (REACT_NAMED.has(name)) return `'${name}' is a React export — add \`import { ${name} } from "react";\``;
    return `'${name}' is undefined — add the missing import or declare it.`;
  }
  m = msg.match(/Cannot find module '([^']+)'/) || msg.match(/Module not found:.*'([^']+)'/);
  if (m) {
    const spec = m[1];
    if (spec.startsWith("@/")) return `Module "${spec}" uses the @/ alias which is NOT configured — convert to a relative path.`;
    if (spec.startsWith(".")) return `Relative import "${spec}" doesn't resolve — either create the file or fix the path.`;
    return `Bare module "${spec}" not allowed — only react, react-dom, lucide-react, framer-motion, @supabase/supabase-js, sonner, clsx, tailwind-merge are permitted.`;
  }
  m = msg.match(/(\w+) is not defined/);
  if (m) return `'${m[1]}' is not defined — likely a missing import or typo.`;
  m = msg.match(/Property '([^']+)' does not exist on type/);
  if (m) return `Property '${m[1]}' missing on the type — fix the data shape or correct the access.`;
  return null;
}
