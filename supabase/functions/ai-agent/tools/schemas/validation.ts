// ═══════════════════════════════════════════════════════════════════════════
// TOOL SCHEMAS — Validation (8 tools)
// ───────────────────────────────────────────────────────────────────────────
// JSON-Schema definitions for the LLM's function-calling interface.
// Execution logic lives in `../../index.ts` execTool switch (later phase: split
// alongside this file as `./validation-exec.ts`).
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolSchema } from "../registry.ts";

export const VALIDATION_TOOLS: ToolSchema[] = [
  {
    type: "function",
    function: {
      name: "run_typecheck",
      description:
        "Run a deep static check across ALL project files. Detects: unbalanced brackets/JSX, forbidden imports (next/*, react-router*, axios, @/), unknown bare packages, unresolved relative imports, missing default exports on App/screens/pages, broken named/default cross-file imports, and runtime-safety patterns (`.map()`/`.length`/`.toFixed()` on potentially-undefined values). Returns issues with severity ('error' | 'warn') and a fix hint per issue. Use as a final sanity gate before declaring done.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "validate_files",
      description:
        "Validate ONLY the listed files (faster than run_typecheck) using the same checks: bracket/JSX balance, forbidden + unknown imports, unresolved relative imports, default-export requirement, cross-file named/default export resolution, and runtime-safety patterns. Returns issues with severity and a fix hint. Use after a batch of write_file calls to catch errors quickly.",
      parameters: {
        type: "object",
        properties: {
          paths: {
            type: "array",
            description: "File paths to validate",
            items: { type: "string" },
            minItems: 1,
          },
        },
        required: ["paths"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "auto_fix_file",
      description:
        "Run the deterministic self-healing engine on one or more files. Automatically: (1) adds missing lucide-react icon imports and React hook imports based on usage, (2) rewrites `@/` alias imports to relative paths when resolvable, (3) strips forbidden react-router imports, (4) appends a missing `export default` when a clear component identifier exists, (5) removes truncation placeholder comments. Returns the list of fixes applied. Use this BEFORE attempting manual edits when you see typical 'Cannot find name' or 'unresolved import' errors — it's free and fast.",
      parameters: {
        type: "object",
        properties: {
          paths: {
            type: "array",
            description: "File paths to auto-fix",
            items: { type: "string" },
            minItems: 1,
          },
        },
        required: ["paths"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_quality_gates",
      description:
        "Run a unified quality-gate suite over the project — lint (ESLint-style), types (TS-style validation), a11y (axe-style accessibility), security (DB linter + secret/XSS scan), and tests (presence + structure). Returns a single PASS/FAIL verdict plus per-gate findings. Use BEFORE declaring a feature done, or to give the user a confidence check. Cheap — runs entirely in the edge function, no shell.",
      parameters: {
        type: "object",
        properties: {
          gates: {
            type: "array",
            description: "Subset of gates to run. Default: all five.",
            items: { type: "string", enum: ["lint", "types", "a11y", "security", "tests"] },
          },
          paths: {
            type: "array",
            description: "Optional file filter for lint/types/a11y (security & tests scan all).",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "code_quality_lint",
      description:
        "Run only the lint gate — ESLint-style heuristics: no-debugger, no-console, no-alert, no-eval, no-var, prefer-const, no-explicit-any, max-lines, react-hooks/rules-of-hooks. Returns per-file findings. Use when the user asks to clean up code quality.",
      parameters: {
        type: "object",
        properties: {
          paths: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "accessibility_scan",
      description:
        "Run only the a11y gate — axe-core-inspired heuristics: img-alt, button-name (icon-only buttons need aria-label), label-has-associated-control, anchor-has-href, html-has-lang, no-positive-tabindex, no-autofocus, interactive-supports-focus. Use after building UI to ensure screen-reader friendliness.",
      parameters: {
        type: "object",
        properties: {
          paths: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "security_audit",
      description:
        "Run only the security gate — combines (1) Supabase DB linter (RLS gaps, missing policies, exposed columns) via Management API and (2) static code scan for hard-coded secrets (Stripe/AWS/Google keys, JWTs, private keys), service_role key exposure on the client, dangerouslySetInnerHTML, raw SQL interpolation, and open-redirect patterns. Run before publishing.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "run_tests",
      description:
        "Inspect the project's test files (*.test.ts(x), *.spec.ts(x)) — counts test cases, validates imports (vitest / @testing-library), flags empty describe blocks. Note: tests aren't executed inside this tool (the harness runs them on file-write); this is a structural check.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
];
