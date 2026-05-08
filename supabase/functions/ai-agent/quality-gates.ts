// ═══════════════════════════════════════════════════════════════════════════
// QUALITY GATES — barrel re-exports (Phase 3a.6 split)
// ───────────────────────────────────────────────────────────────────────────
// Implementation lives in ./quality-gates/{lint,a11y,security,tests,runner}.ts
// This file exists for backwards-compatible imports.
// ═══════════════════════════════════════════════════════════════════════════

export { lintFile, runLintGate } from "./quality-gates/lint.ts";
export { a11yScanFile, runA11yGate } from "./quality-gates/a11y.ts";
export { runSecurityAudit } from "./quality-gates/security.ts";
export { runTestsGate } from "./quality-gates/tests.ts";
export { runAllQualityGates, classifyRuntimeError } from "./quality-gates/runner.ts";
