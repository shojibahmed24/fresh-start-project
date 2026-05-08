// ═══════════════════════════════════════════════════════════════════════════
// TESTS GATE — discovers *.test.ts(x) / *.spec.ts(x), reports shape issues
// ───────────────────────────────────────────────────────────────────────────
// We can't actually execute tests inside the edge function, but we can
// report what tests exist and surface obviously broken ones (empty
// describe blocks, missing imports). The agent's bulk_write_files /
// write_file flow then triggers the harness which DOES run tests.
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolContext, GateFinding, GateResult } from "../types.ts";

export async function runTestsGate(ctx: ToolContext): Promise<GateResult> {
  const findings: GateFinding[] = [];
  const { data: rows } = await ctx.supabase
    .from("project_files")
    .select("path, content")
    .eq("project_id", ctx.projectId);

  const tests = (rows ?? []).filter((r: any) =>
    /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(r.path),
  ) as { path: string; content: string }[];

  if (tests.length === 0) {
    return {
      name: "tests",
      ok: true,
      findings: [],
      checked: 0,
      skipped: "No test files found. Add files matching `*.test.ts(x)` or `*.spec.ts(x)`.",
    };
  }

  let totalCases = 0;
  for (const t of tests) {
    const itCount = (t.content.match(/\b(?:it|test)\s*\(/g) ?? []).length;
    const describeCount = (t.content.match(/\bdescribe\s*\(/g) ?? []).length;
    totalCases += itCount;

    if (itCount === 0) {
      findings.push({
        path: t.path,
        rule: "empty-test-file",
        severity: "warn",
        problem: `Test file has ${describeCount} describe block(s) but 0 test cases`,
        hint: "Add `it('...', () => { … })` or `test('...', () => { … })` cases.",
      });
    }

    if (!/from ["']vitest["']/.test(t.content) && !/from ["']@testing-library\//.test(t.content)) {
      findings.push({
        path: t.path,
        rule: "missing-test-imports",
        severity: "warn",
        problem: "Test file doesn't import from vitest or @testing-library",
        hint: 'Add `import { describe, it, expect } from "vitest";`',
      });
    }
  }

  return {
    name: "tests",
    ok: !findings.some((f) => f.severity === "error"),
    findings,
    checked: tests.length,
    skipped: totalCases === 0 ? "Test files exist but contain no executable cases." : undefined,
  };
}
