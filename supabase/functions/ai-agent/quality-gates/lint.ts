// ═══════════════════════════════════════════════════════════════════════════
// LINT GATE — lightweight ESLint-style rules (no AST, regex on scrubbed src)
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolContext, GateFinding, GateResult } from "../types.ts";
import { normalizePath, stripStringsAndComments } from "../validation/parsers.ts";

export function lintFile(path: string, content: string): GateFinding[] {
  const findings: GateFinding[] = [];
  if (!/\.(tsx?|jsx?)$/.test(path)) return findings;

  const scrubbed = stripStringsAndComments(content);
  const lines = content.split("\n");

  // no-debugger
  scrubbed.split("\n").forEach((ln, i) => {
    if (/\bdebugger\b/.test(ln)) {
      findings.push({
        path,
        line: i + 1,
        rule: "no-debugger",
        severity: "error",
        problem: "`debugger` statement left in code",
        hint: "Remove the `debugger` before shipping.",
      });
    }
  });

  // no-console (warn — common but noisy)
  let consoleCount = 0;
  scrubbed.split("\n").forEach((ln, i) => {
    if (/\bconsole\.(log|debug|info)\s*\(/.test(ln)) {
      consoleCount++;
      if (consoleCount <= 3) {
        findings.push({
          path,
          line: i + 1,
          rule: "no-console",
          severity: "warn",
          problem: "`console.log` left in code",
          hint: "Replace with proper logging or remove. (console.warn / console.error are allowed.)",
        });
      }
    }
  });

  // no-alert
  if (/\b(alert|confirm|prompt)\s*\(/.test(scrubbed)) {
    findings.push({
      path,
      rule: "no-alert",
      severity: "warn",
      problem: "Browser `alert()`/`confirm()`/`prompt()` used",
      hint: "Use a `toast` (sonner) or a proper modal — alert() is jarring and breaks the design.",
    });
  }

  // no-eval
  if (/\beval\s*\(/.test(scrubbed) || /\bnew Function\s*\(/.test(scrubbed)) {
    findings.push({
      path,
      rule: "no-eval",
      severity: "error",
      problem: "Dynamic code execution (`eval` / `new Function`) detected",
      hint: "Refactor to avoid runtime code generation — it's a security risk and breaks bundling.",
    });
  }

  // prefer-const (let X = ... never reassigned)
  const letRe = /\blet\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=/g;
  let lm: RegExpExecArray | null;
  while ((lm = letRe.exec(scrubbed)) !== null) {
    const name = lm[1];
    const reassign = new RegExp(`\\b${name}\\s*=(?!=)`, "g");
    const matches = scrubbed.match(reassign) ?? [];
    if (matches.length === 1) {
      findings.push({
        path,
        rule: "prefer-const",
        severity: "warn",
        problem: `\`let ${name}\` is never reassigned — use \`const\``,
      });
    }
  }

  // no-var
  if (/(^|\s)var\s+[A-Za-z_$]/.test(scrubbed)) {
    findings.push({
      path,
      rule: "no-var",
      severity: "warn",
      problem: "`var` used — prefer `let` or `const`",
    });
  }

  // no-explicit-any (TypeScript files)
  if (/\.tsx?$/.test(path)) {
    const anyMatches = scrubbed.match(/:\s*any\b/g);
    if (anyMatches && anyMatches.length > 0) {
      findings.push({
        path,
        rule: "no-explicit-any",
        severity: "warn",
        problem: `\`any\` type used (${anyMatches.length} occurrence${anyMatches.length === 1 ? "" : "s"})`,
        hint: "Replace `any` with a concrete type or `unknown` for better safety.",
      });
    }
  }

  // max-lines (file complexity)
  if (lines.length > 400) {
    findings.push({
      path,
      rule: "max-lines",
      severity: "warn",
      problem: `File is ${lines.length} lines — consider splitting into smaller modules`,
      hint: "Extract logical sections into separate files.",
    });
  }

  // react-hooks/rules-of-hooks (very lightweight: hook call inside if/for)
  if (/\.(tsx|jsx)$/.test(path)) {
    const hookCondRe = /\b(?:if|for|while)\s*\([^)]*\)\s*\{[^}]*\buse[A-Z]\w+\s*\(/g;
    if (hookCondRe.test(scrubbed)) {
      findings.push({
        path,
        rule: "rules-of-hooks",
        severity: "error",
        problem: "React hook called inside a conditional / loop",
        hint: "Hooks must be called at the top level of a component, never inside `if`/`for`/`while`.",
      });
    }
  }

  return findings;
}

export async function runLintGate(ctx: ToolContext, filterPaths?: string[]): Promise<GateResult> {
  const { data } = await ctx.supabase
    .from("project_files")
    .select("path, content")
    .eq("project_id", ctx.projectId);
  const rows = (data ?? []) as { path: string; content: string }[];
  const filterSet = filterPaths
    ? new Set(filterPaths.map((p) => normalizePath(p)))
    : null;
  const findings: GateFinding[] = [];
  let checked = 0;
  for (const r of rows) {
    if (filterSet && !filterSet.has(normalizePath(r.path))) continue;
    if (!/\.(tsx?|jsx?)$/.test(r.path)) continue;
    checked++;
    findings.push(...lintFile(r.path, r.content));
  }
  return {
    name: "lint",
    ok: !findings.some((f) => f.severity === "error"),
    findings,
    checked,
  };
}
