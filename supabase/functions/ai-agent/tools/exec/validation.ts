// ═══════════════════════════════════════════════════════════════════════════
// TOOL EXECUTORS — Validation (8 handlers)
// ───────────────────────────────────────────────────────────────────────────
// Handlers for tools defined in ../schemas/validation.ts. Dispatched by
// ./index.ts → execTool(name, args, ctx, callId).
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolContext } from "../../types.ts";
import { autoFixBatch } from "../../autofix.ts";
import { runA11yGate, runAllQualityGates, runLintGate, runSecurityAudit, runTestsGate } from "../../quality-gates.ts";
import { validateProject } from "../../validation/checks.ts";

export type ToolHandler = (
  args: any,
  ctx: ToolContext,
  callId: string,
) => Promise<{ result: any; askUser?: boolean }>;

export const exec_run_typecheck: ToolHandler = async (args, ctx, callId) => {
const v = await validateProject(ctx);
const errors = v.issues.filter((i) => i.severity !== "warn");
const warnings = v.issues.filter((i) => i.severity === "warn");
return {
  result: {
    ok: v.ok,
    checked: v.checked,
    issue_count: v.issues.length,
    error_count: errors.length,
    warning_count: warnings.length,
    // errors first, full hint included
    issues: v.issues.slice(0, 30).map((i) => ({
      path: i.path,
      severity: i.severity ?? "error",
      problem: i.problem,
      hint: i.hint,
    })),
  },
};
};

export const exec_validate_files: ToolHandler = async (args, ctx, callId) => {
if (!Array.isArray(args.paths) || args.paths.length === 0) {
  return { result: { error: "paths[] required" } };
}
const paths = args.paths.filter((p: any) => typeof p === "string");
const v = await validateProject(ctx, paths);
const errors = v.issues.filter((i) => i.severity !== "warn");
const warnings = v.issues.filter((i) => i.severity === "warn");
return {
  result: {
    ok: v.ok,
    checked: v.checked,
    issue_count: v.issues.length,
    error_count: errors.length,
    warning_count: warnings.length,
    issues: v.issues.slice(0, 30).map((i) => ({
      path: i.path,
      severity: i.severity ?? "error",
      problem: i.problem,
      hint: i.hint,
    })),
  },
};
};

export const exec_auto_fix_file: ToolHandler = async (args, ctx, callId) => {
if (!Array.isArray(args.paths) || args.paths.length === 0) {
  return { result: { error: "paths[] required" } };
}
const paths = args.paths.filter((p: any) => typeof p === "string");
if (paths.length === 0) return { result: { error: "paths must be strings" } };
const af = await autoFixBatch(ctx, paths);
// Re-run validation on the same files so the model sees what's left.
const v = await validateProject(ctx, paths);
const errors = v.issues.filter((i) => i.severity !== "warn");
return {
  result: {
    ok: v.ok,
    fixes_applied: af.fixes.length,
    changed_paths: af.changedPaths,
    fixes: af.fixes.slice(0, 30),
    remaining_issue_count: errors.length,
    remaining_issues: v.issues.slice(0, 20).map((i) => ({
      path: i.path,
      severity: i.severity ?? "error",
      problem: i.problem,
      hint: i.hint,
    })),
  },
};
};

export const exec_run_quality_gates: ToolHandler = async (args, ctx, callId) => {
const gates = Array.isArray(args.gates)
  ? args.gates.filter((g: any) => typeof g === "string")
  : undefined;
const filterPaths = Array.isArray(args.paths)
  ? args.paths.filter((p: any) => typeof p === "string")
  : undefined;
const out = await runAllQualityGates(ctx, { gates, filterPaths });
return {
  result: {
    ok: out.ok,
    verdict: out.ok ? "PASS" : "FAIL",
    summary: out.summary,
    gates: out.gates.map((g) => ({
      name: g.name,
      ok: g.ok,
      checked: g.checked,
      skipped: g.skipped,
      finding_count: g.findings.length,
      findings: g.findings.slice(0, 15),
    })),
  },
};
};

export const exec_code_quality_lint: ToolHandler = async (args, ctx, callId) => {
const filterPaths = Array.isArray(args.paths)
  ? args.paths.filter((p: any) => typeof p === "string")
  : undefined;
const g = await runLintGate(ctx, filterPaths);
return {
  result: {
    ok: g.ok,
    checked: g.checked,
    finding_count: g.findings.length,
    findings: g.findings.slice(0, 50),
  },
};
};

export const exec_accessibility_scan: ToolHandler = async (args, ctx, callId) => {
const filterPaths = Array.isArray(args.paths)
  ? args.paths.filter((p: any) => typeof p === "string")
  : undefined;
const g = await runA11yGate(ctx, filterPaths);
return {
  result: {
    ok: g.ok,
    checked: g.checked,
    finding_count: g.findings.length,
    findings: g.findings.slice(0, 50),
  },
};
};

export const exec_security_audit: ToolHandler = async (args, ctx, callId) => {
const g = await runSecurityAudit(ctx);
return {
  result: {
    ok: g.ok,
    checked: g.checked,
    finding_count: g.findings.length,
    findings: g.findings.slice(0, 50),
  },
};
};

export const exec_run_tests: ToolHandler = async (args, ctx, callId) => {
const g = await runTestsGate(ctx);
return {
  result: {
    ok: g.ok,
    test_files: g.checked,
    skipped: g.skipped,
    finding_count: g.findings.length,
    findings: g.findings.slice(0, 30),
  },
};
};

export const VALIDATION_EXEC: Record<string, ToolHandler> = {
  run_typecheck: exec_run_typecheck,
  validate_files: exec_validate_files,
  auto_fix_file: exec_auto_fix_file,
  run_quality_gates: exec_run_quality_gates,
  code_quality_lint: exec_code_quality_lint,
  accessibility_scan: exec_accessibility_scan,
  security_audit: exec_security_audit,
  run_tests: exec_run_tests,
};
