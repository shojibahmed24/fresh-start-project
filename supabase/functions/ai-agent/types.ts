// ═══════════════════════════════════════════════════════════════════════════
// SHARED TYPES — used across the agent loop, tool executors, and validation
// ───────────────────────────────────────────────────────────────────────────
// Lives in its own file so sub-modules (validation.ts, tools/exec/*) can
// import the ToolContext without pulling in index.ts (which would cause a
// circular import — index.ts imports them, not the other way around).
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "npm:@supabase/supabase-js@2";

export interface ToolContext {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  projectId: string;
  pendingAsk: { id: string; question: string; options: string[]; allow_other: boolean } | null;
  filesChanged: { path: string; action: "created" | "updated" }[];
  memoryDirty: boolean;
  // Per-run read cache: tracks how many times each path has been read this turn.
  // Prevents infinite read-loop bugs where the model keeps re-reading the same file.
  // Caches both success AND not-found/error results so bad paths don't cause DB spam.
  // `mutatedSinceLastRead`: set true when a write/edit/autofix updates the cached
  // entry — re-reads after a mutation are FREE (no nag, reads counter resets).
  readCache: Map<string, { result: any; reads: number; mutatedSinceLastRead?: boolean }>;
  // Matched domain id from the iter-0 keyword classifier (used by get_snippet
  // to suggest valid snippet names when the model passes an unknown one).
  matchedDomainId: string | null;
  // User's JWT — needed when the agent calls other Lovable edge functions
  // (e.g. supabase-run-sql) on the user's behalf so RLS + ownership checks pass.
  userJwt?: string;
  // Phase 9: multi-modal attachments forwarded by the client. Images are
  // injected into the first user message (vision); text/code files are
  // appended as labeled fences. The agent can also call `read_attachment`
  // to inspect them on demand.
  attachments?: Array<{ id: string; name: string; kind: "file" | "image"; size: number; mime: string; content: string }>;
  // Phase 11: outbound event channel — lets in-tool code emit progress
  // updates (and other transient events) to the client without pausing the
  // loop. Set by the request handler before invoking execTool.
  send?: (event: any) => void;
  // Phase 11: progress tracking. The agent declares total steps once via
  // report_progress({ total }), then emits per-step updates. The client
  // shows a determinate progress bar with ETA.
  progress?: { total: number; current: number; startedAt: number; label?: string } | null;
}

// ── Validation result shape (shared by validation.ts + autofix + execTool) ──
export interface ValidationIssue {
  path: string;
  problem: string;
  severity?: "error" | "warn";
  hint?: string;
  line?: number;
}

// ── Quality-gate finding/result (lint, a11y, security, tests) ──────────────
export type GateFinding = {
  path: string;
  line?: number;
  rule: string;
  severity: "error" | "warn" | "info";
  problem: string;
  hint?: string;
};

export type GateResult = {
  name: string;
  ok: boolean;
  findings: GateFinding[];
  checked: number;
  skipped?: string;
};

export interface AutoFix {
  path: string;
  fix: string;
}
