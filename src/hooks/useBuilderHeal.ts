// Auto-heal pipeline for the live preview.
// Listens for `preview-error` window events, extracts the most likely culprit
// file from the stack (or from error-message keywords when stack is empty),
// and tries to fix it.
//
// Strategy (3 attempts max, but stops EARLY on repeated identical errors):
//   - Attempts 1 & 2: regular AI edit via `onHealPrompt` (cheap, fast).
//   - Attempt 3 (LAST): direct Claude Sonnet 4.6 call via `heal-claude` edge
//     function with the broken file + error context.
//   - Repeat-detection: if the same error signature fires more than once after
//     a heal attempt, bail immediately and tell the user to fix manually.
//
// Live state for each error is published via `healState` so the matching
// HealBadge in chat can show "Attempt 1/3 — fixing App.tsx", "Healed",
// "Stopped — same error repeated", etc.

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Project, ProjectFile } from "@/lib/store";
import { makeHealKey, publishHealState } from "@/lib/healState";

const MAX_HEAL_ATTEMPTS = 3;
const CLAUDE_ATTEMPT = 3; // Last attempt switches to Claude Layer-2.
// Same signature fires >= this many times AFTER a heal completes → stop.
// Bumped from 2 → 4 because React error boundaries re-fire the same error
// every render until the actual file is fixed; counting those as "repeats"
// caused us to bail before the very first heal even finished.
const REPEAT_BAIL_LIMIT = 4;
// Cool-down after a heal attempt completes — errors that fire during this
// window are NOT counted toward the repeat limit. Gives Sandpack time to
// pick up the new file content and re-render cleanly.
const HEAL_COOLDOWN_MS = 6000;
const SANDBOX_INTERNAL_ERROR_RE = /\bmessage\b is read-only|\bmessage\b.*read.?only/i;

type Culprit = { path: string | null; line: number | null; column: number | null };

async function recordErrorHistory(args: {
  projectId: string;
  filePath: string;
  errorMessage: string;
  errorStack: string;
  fixSummary: string;
  fixKind: string;
}): Promise<void> {
  try {
    await supabase.rpc("record_project_error", {
      _project_id: args.projectId,
      _file_path: args.filePath ?? "",
      _error_message: args.errorMessage ?? "",
      _error_stack: args.errorStack ?? "",
      _fix_summary: args.fixSummary ?? "",
      _fix_kind: args.fixKind ?? "auto-heal",
    });
  } catch (err) {
    console.warn("[heal] record_project_error failed:", err);
  }
}

// Common JS identifiers that appear in error messages but are NOT user code
// — skip them when scanning files for keyword matches.
const KEYWORD_BLACKLIST = new Set([
  "undefined", "null", "object", "function", "string", "number", "boolean",
  "array", "react", "component", "props", "state", "render", "error",
  "type", "value", "name", "key", "id", "data", "item", "items",
  "message", "stack", "event", "target", "window", "document", "console",
  "attribute", "attributes", "attributename", "getter", "setter", "readonly",
]);

function isReadonlyDomMutationError(errorMessage: string): boolean {
  return /read-only|readonly|getter-only|has only a getter|setting getter-only property/i.test(errorMessage) &&
    /\b(message|attributeName|attributes|MutationRecord|Event)\b/i.test(errorMessage);
}

function isSandpackInternalMessageError(message: string, stack: string): boolean {
  if (!SANDBOX_INTERNAL_ERROR_RE.test(message)) return false;
  // Sandpack worker traces, react-error-overlay, OR no stack at all
  // (user code reassigning `message` would always carry a real source frame).
  return (
    !stack ||
    /sandpack\.codesandbox\.io|sandbox\.[a-f0-9]+\.js|handleCallResponse|react-error-overlay|loadWorker/i.test(stack)
  );
}

// Vite/esbuild import-resolution failures look like:
//   [plugin:vite:import-analysis] Failed to resolve import "recharts" from "src/screens/Analytics.tsx"
//   Failed to resolve module specifier "foo"
//   Cannot find module 'bar' or its corresponding type declarations
// We extract { pkg, fromPath } so the heal prompt can tell the AI exactly
// which package is missing and which file imports it.
function parseImportResolutionError(
  errorMessage: string,
  errorStack: string,
): { pkg: string; fromPath: string | null } | null {
  const text = `${errorMessage}\n${errorStack}`;
  const patterns = [
    /Failed to resolve import\s+["']([^"']+)["'](?:\s+from\s+["']([^"']+)["'])?/i,
    /Failed to resolve module specifier\s+["']([^"']+)["']/i,
    /Cannot find module\s+["']([^"']+)["']/i,
    /Module not found:.*?["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const pkg = m[1];
      const fromPath = m[2] || null;
      // Skip relative imports — those are file issues, handled elsewhere.
      if (pkg.startsWith(".") || pkg.startsWith("/")) continue;
      return { pkg, fromPath };
    }
  }
  return null;
}

function extractKeywords(errorMessage: string): string[] {
  if (!errorMessage) return [];
  // Pull quoted identifiers and `.property` accesses out of error messages.
  // Examples we want to catch:
  //   "Cannot read properties of undefined (reading 'foo')"  → foo
  //   "useWorkout is not a function"                          → useWorkout
  //   "'currentSession' is read-only"                         → currentSession
  const found = new Set<string>();
  const patterns = [
    /['"`]([A-Za-z_$][A-Za-z0-9_$]{2,})['"`]/g,
    /\b([A-Za-z_$][A-Za-z0-9_$]{2,})\s+is\s+(?:not|read-only|undefined)/gi,
    /reading\s+['"`]?([A-Za-z_$][A-Za-z0-9_$]{2,})['"`]?/gi,
    /\b(use[A-Z][A-Za-z0-9_$]+)\b/g, // hook names
    /\b([A-Z][A-Za-z0-9_$]{3,})\b/g,  // PascalCase (component names)
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(errorMessage))) {
      const word = m[1];
      if (word && !KEYWORD_BLACKLIST.has(word.toLowerCase())) found.add(word);
    }
  }
  return Array.from(found);
}

export function extractCulprit(text: string, files: ProjectFile[]): Culprit {
  if (!text) return { path: null, line: null, column: null };
  const paths = files.map((f) => f.path);
  let bestMatch: Culprit | null = null;
  for (const p of paths) {
    const needle = p.replace(/^\//, "");
    const idx = text.indexOf(needle);
    if (idx === -1) continue;
    // Look for "path:line:col" anywhere within the next ~120 chars (covers
    // Vite overlays where the location appears on the next line, e.g.
    //   Failed to resolve import "x" from "src/screens/Analytics.tsx"
    //   /nodebox/src/screens/Analytics.tsx:4:7
    const tail = text.slice(idx + needle.length, idx + needle.length + 160);
    const m = tail.match(/[:\s](\d+)(?::(\d+))?/);
    const line = m ? parseInt(m[1], 10) : null;
    const column = m && m[2] ? parseInt(m[2], 10) : null;
    bestMatch = { path: p, line, column };
  }
  const compStackRe = /\(at\s+([^\s:)]+):(\d+)(?::(\d+))?\)/g;
  let m: RegExpExecArray | null;
  while ((m = compStackRe.exec(text))) {
    const fileName = m[1];
    const matchPath = paths.find((p) => p.endsWith(fileName) || p.endsWith("/" + fileName));
    if (matchPath) {
      bestMatch = {
        path: matchPath,
        line: parseInt(m[2], 10),
        column: m[3] ? parseInt(m[3], 10) : null,
      };
    }
  }
  return bestMatch ?? { path: null, line: null, column: null };
}

// Fallback culprit detection: when the stack has no file paths, scan project
// files for unique identifiers mentioned in the error message and return the
// file with the most distinctive matches. Returns null if nothing meaningful.
export function guessCulpritFromKeywords(
  errorMessage: string,
  files: ProjectFile[],
): Culprit | null {
  if (isReadonlyDomMutationError(errorMessage)) {
    const readonlyPatterns = [
      /\b(?:event|ev|e|err|error|record|mutation)\.message\s*=/,
      /\b(?:record|mutation)\.attributeName\s*=/,
      /\.attributes\.message\s*=/,
      /Object\.assign\s*\(\s*(?:event|ev|e|err|error|record|mutation)\b/,
    ];
    const direct = files.find(
      (f) => /\.(tsx?|jsx?)$/.test(f.path) && readonlyPatterns.some((re) => re.test(f.content)),
    );
    if (direct) {
      const idx = direct.content.search(new RegExp(readonlyPatterns.map((re) => re.source).join("|")));
      return {
        path: direct.path,
        line: idx >= 0 ? direct.content.slice(0, idx).split("\n").length : null,
        column: null,
      };
    }
  }

  const keywords = extractKeywords(errorMessage);
  if (keywords.length === 0) return null;
  // Prefer source files; skip generated/config noise.
  const sourceFiles = files.filter(
    (f) => /\.(tsx?|jsx?)$/.test(f.path) && !/node_modules|dist|build/.test(f.path),
  );
  let best: { path: string; score: number; line: number | null } | null = null;
  for (const file of sourceFiles) {
    let score = 0;
    let firstLine: number | null = null;
    for (const kw of keywords) {
      // Use word boundaries so "id" doesn't match every "useId" too aggressively.
      const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "g");
      const matches = file.content.match(re);
      if (matches && matches.length > 0) {
        // Long/specific keywords count more.
        score += matches.length * (kw.length >= 6 ? 3 : 1);
        if (firstLine === null) {
          const idx = file.content.search(re);
          if (idx >= 0) firstLine = file.content.slice(0, idx).split("\n").length;
        }
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { path: file.path, score, line: firstLine };
    }
  }
  if (!best || best.score < 2) return null;
  return { path: best.path, line: best.line, column: null };
}

export function buildCodeWindow(file: ProjectFile, line: number | null): string {
  if (!line) return "";
  const lines = file.content.split("\n");
  const start = Math.max(1, line - 6);
  const end = Math.min(lines.length, line + 6);
  return lines
    .slice(start - 1, end)
    .map((ln, i) => {
      const n = start + i;
      const marker = n === line ? ">>" : "  ";
      return `${marker} ${String(n).padStart(4)} | ${ln}`;
    })
    .join("\n");
}

export function useBuilderHeal({
  project,
  loading,
  onHealPrompt,
  onClaudeHealed,
}: {
  project: Project | null;
  loading: boolean;
  onHealPrompt: (prompt: string) => Promise<void>;
  onClaudeHealed?: (path: string, content: string) => void;
}) {
  const healAttemptsRef = useRef(0);
  const lastHealedErrorRef = useRef<string>("");
  const lastHealKeyRef = useRef<string>("");
  const errorSignatureCountRef = useRef<Map<string, number>>(new Map());
  const healHistoryRef = useRef<string[]>([]);
  const claudeInFlightRef = useRef(false);
  const healInFlightRef = useRef(false);
  const lastHealFinishedAtRef = useRef<number>(0);

  const resetHeal = () => {
    healAttemptsRef.current = 0;
    lastHealedErrorRef.current = "";
    lastHealKeyRef.current = "";
    errorSignatureCountRef.current.clear();
    healHistoryRef.current = [];
    claudeInFlightRef.current = false;
    healInFlightRef.current = false;
    lastHealFinishedAtRef.current = 0;
  };

  useEffect(() => {
    const handler = async (event: Event) => {
      const raw = (event as CustomEvent<any>).detail;
      const message = typeof raw === "string" ? raw : String(raw?.message ?? "");
      const stack = typeof raw === "string" ? raw : String(raw?.stack ?? "");
      const componentStack = typeof raw === "string" ? "" : String(raw?.componentStack ?? "");
      if (isSandpackInternalMessageError(message, stack)) {
        publishHealState(makeHealKey(message, null), {
          status: "stopped",
          attempt: healAttemptsRef.current,
          maxAttempts: MAX_HEAL_ATTEMPTS,
          filePath: null,
          reason: "Preview sandbox internal overlay error — ignored to avoid pointless file rewrites",
        });
        return;
      }
      const detailKey = `${message}|${stack.slice(0, 200)}`;
      if (!message && !stack) return;
      if (!project || loading) return;
      if (detailKey === lastHealedErrorRef.current) return;
      if (claudeInFlightRef.current) return;
      // While a heal is in flight (or just finished within cooldown), the
      // preview will keep re-rendering the broken file and re-firing the
      // same error. Don't count those toward the repeat-bail counter.
      if (healInFlightRef.current) return;
      const sinceLastHeal = Date.now() - lastHealFinishedAtRef.current;
      const inCooldown = lastHealFinishedAtRef.current > 0 && sinceLastHeal < HEAL_COOLDOWN_MS;

      // ─── Repeat detection: if the same error signature has already been
      // attempted and is firing again, bail without burning more attempts.
      const signature = (message || "").trim().slice(0, 200);
      const seenCount = (errorSignatureCountRef.current.get(signature) ?? 0) + (inCooldown ? 0 : 1);
      if (!inCooldown) errorSignatureCountRef.current.set(signature, seenCount);
      if (seenCount >= REPEAT_BAIL_LIMIT && healAttemptsRef.current > 0 && !inCooldown) {
        const culprit =
          extractCulprit(stack + "\n" + componentStack, project.files) ??
          guessCulpritFromKeywords(message, project.files);
        const fileName = culprit?.path?.split("/").pop();
        toast.error(
          fileName
            ? `Auto-heal stopped — same error keeps coming back. Please fix ${fileName} manually.`
            : `Auto-heal stopped — same error keeps coming back. Please review your recent changes manually.`,
          { duration: 8000 },
        );
        publishHealState(makeHealKey(message, culprit?.path ?? null), {
          status: "stopped",
          attempt: healAttemptsRef.current,
          maxAttempts: MAX_HEAL_ATTEMPTS,
          filePath: culprit?.path ?? null,
          reason: "Same error repeated — manual fix needed",
        });
        lastHealedErrorRef.current = detailKey;
        return;
      }

      if (healAttemptsRef.current >= MAX_HEAL_ATTEMPTS) {
        const culprit =
          extractCulprit(stack + "\n" + componentStack, project.files) ??
          guessCulpritFromKeywords(message, project.files) ?? { path: null, line: null, column: null };
        toast.error(
          culprit.path
            ? `Auto-heal stopped after ${MAX_HEAL_ATTEMPTS} attempts — please fix ${culprit.path.split("/").pop()} manually.`
            : `Auto-heal stopped after ${MAX_HEAL_ATTEMPTS} attempts — please review and fix manually.`,
          { duration: 8000 },
        );
        publishHealState(makeHealKey(message, culprit.path), {
          status: "stopped",
          attempt: MAX_HEAL_ATTEMPTS,
          maxAttempts: MAX_HEAL_ATTEMPTS,
          filePath: culprit.path,
          reason: `Reached max attempts (${MAX_HEAL_ATTEMPTS})`,
        });
        lastHealedErrorRef.current = detailKey;
        return;
      }

      lastHealedErrorRef.current = detailKey;
      healAttemptsRef.current += 1;
      healHistoryRef.current.push(message);

      const attempt = healAttemptsRef.current;
      // Two-tier culprit detection: stack first, then keyword fallback.
      let culprit = extractCulprit(stack + "\n" + componentStack, project.files);
      if (!culprit.path) {
        const guessed = guessCulpritFromKeywords(message, project.files);
        if (guessed) culprit = guessed;
      }
      const culpritFile = culprit.path ? project.files.find((f) => f.path === culprit.path) : null;
      const healKey = makeHealKey(message, culprit.path);
      lastHealKeyRef.current = healKey;

      // Publish "fixing" state so the matching HealBadge updates live.
      publishHealState(healKey, {
        status: "fixing",
        attempt,
        maxAttempts: MAX_HEAL_ATTEMPTS,
        filePath: culprit.path,
        reason: attempt === CLAUDE_ATTEMPT ? "Layer-2: Claude deep review" : undefined,
      });

      // ─── Layer 2: Claude direct rewrite on final attempt ───
      if (attempt === CLAUDE_ATTEMPT && culpritFile && onClaudeHealed) {
        claudeInFlightRef.current = true;
        toast.info(
          `Layer-2: asking Claude to deeply review ${culpritFile.path.split("/").pop()}…`,
        );
        try {
          // Use the user-selected model (from ModelSettingsMenu) instead of
          // hardcoded Claude. Falls back to backend default when unset.
          const selectedModel =
            (typeof window !== "undefined" &&
              window.localStorage.getItem("lovable_agent_model")?.trim()) ||
            null;
          const { data, error } = await supabase.functions.invoke("heal-claude", {
            body: {
              projectId: project.id,
              filePath: culpritFile.path,
              errorMessage: message,
              errorStack: stack,
              componentStack,
              errorLine: culprit.line,
              errorColumn: culprit.column,
              model: selectedModel,
            },
          });
          if (error) throw new Error(error.message || "Claude heal failed");
          if (data?.error) throw new Error(data.error);
          if (data?.success && typeof data?.content === "string") {
            onClaudeHealed(culpritFile.path, data.content);
            toast.success(
              `Layer-2 healed ${culpritFile.path.split("/").pop()} (${data.bytesBefore}→${data.bytesAfter} bytes).`,
            );
            publishHealState(healKey, {
              status: "healed",
              attempt,
              maxAttempts: MAX_HEAL_ATTEMPTS,
              filePath: culpritFile.path,
              reason: `Claude rewrote file (${data.bytesBefore}→${data.bytesAfter} bytes)`,
            });
            void recordErrorHistory({
              projectId: project.id,
              filePath: culpritFile.path,
              errorMessage: message,
              errorStack: stack,
              fixSummary: `Claude L2 rewrote file (${data.bytesBefore}→${data.bytesAfter} bytes).`,
              fixKind: "claude-l2",
            });
          } else {
            throw new Error("Claude returned no content");
          }
        } catch (err: any) {
          console.error("[heal] Claude Layer-2 failed:", err);
          toast.error(
            `Layer-2 failed: ${err?.message || "unknown error"}. Edit the file manually or retry.`,
          );
          publishHealState(healKey, {
            status: "stopped",
            attempt,
            maxAttempts: MAX_HEAL_ATTEMPTS,
            filePath: culpritFile.path,
            reason: `Layer-2 failed: ${err?.message || "unknown error"}`,
          });
        } finally {
          claudeInFlightRef.current = false;
          lastHealFinishedAtRef.current = Date.now();
          errorSignatureCountRef.current.delete(signature);
        }
        return;
      }

      // ─── Attempts 1 & 2: regular AI edit via prompt ───
      const codeWindow = culpritFile ? buildCodeWindow(culpritFile, culprit.line) : "";
      const previousAttempts =
        healHistoryRef.current.length > 1
          ? `\n\n═══ PREVIOUS HEAL ATTEMPTS (do NOT repeat the same fix) ═══\n${healHistoryRef.current
              .slice(0, -1)
              .map((msg, i) => `Attempt ${i + 1}: ${msg}`)
              .join("\n")}`
          : "";

      const trimmedStack = stack.length > 1500 ? stack.slice(0, 1500) + "…" : stack;
      const trimmedCompStack =
        componentStack.length > 800 ? componentStack.slice(0, 800) + "…" : componentStack;
      const readonlyDomHint = isReadonlyDomMutationError(message)
        ? `\n\n═══ READ-ONLY DOM/EVENT MUTATION HINT ═══\nThis error usually means code is assigning to browser-owned read-only fields such as event.message, error.message, mutation.attributeName, or element.attributes.message. Fix by creating a new plain object instead (for example { message: String(value) }) and never mutating Event, Error, MutationRecord, NamedNodeMap, or DOM attribute objects.`
        : "";

      // Detect "Failed to resolve import 'x' from 'y.tsx'" style failures and
      // tell the AI explicitly: this is a missing-dep / wrong-import problem,
      // not a runtime crash inside the file. Without this hint the AI tries to
      // patch the file in place and gets stuck because the package itself is
      // unavailable in the sandbox.
      const importIssue = parseImportResolutionError(message, stack);
      const importResolutionHint = importIssue
        ? `\n\n═══ MISSING IMPORT — IMPORTANT ═══\nThe import "${importIssue.pkg}"${importIssue.fromPath ? ` in ${importIssue.fromPath}` : ""} cannot be resolved. This is NOT a runtime bug — the package is simply not in package.json yet.\n\nPreferred fix (in order):\n  1. If "${importIssue.pkg}" is a real, well-known npm package (e.g. recharts, date-fns, zod, clsx), call the \`add_dependency\` tool to add it to package.json. Use the latest stable version. Then keep the import as-is. This is almost always the right answer.\n  2. Only if the package name is clearly a typo or hallucination, fix the import path / package name to a correct one that you then add via \`add_dependency\`.\n  3. As a LAST resort (e.g. the package is deprecated, native-only, or otherwise unavailable on npm), remove the import and rewrite the code with an already-installed alternative.\n\nDo NOT silently delete the feature. Do NOT leave the broken import in place.`
        : "";

      const targetBlock = culprit.path
        ? `\n\n═══ SUSPECTED CULPRIT ═══\nFile: ${culprit.path}\nLine: ${culprit.line ?? "?"} (col ${culprit.column ?? "?"})${culprit.line ? "" : "\n(line guessed from error keywords — verify before editing)"}\n${codeWindow ? `\nCode window (>> marks the suspected line):\n${codeWindow}` : ""}\n\nFix ONLY this file (plus directly-affected importers if absolutely necessary). Do NOT re-plan the project.`
        : `\n\n(Could not pinpoint the culprit file — fix the most likely file based on the error message keywords. Do NOT scan unrelated files.)`;

      toast.info(
        `Auto-fixing preview error (attempt ${attempt}/${MAX_HEAL_ATTEMPTS})${
          culprit.path ? ` — ${culprit.path.split("/").pop()}` : ""
        }…`,
      );

      const prompt = `The live preview crashed with a runtime error. Apply a SURGICAL fix to the suspected file only.\n\n═══ ERROR MESSAGE ═══\n${message || "(no message)"}\n\n═══ STACK TRACE ═══\n${trimmedStack || "(no stack)"}${trimmedCompStack ? `\n\n═══ REACT COMPONENT STACK ═══\n${trimmedCompStack}` : ""}${readonlyDomHint}${importResolutionHint}${targetBlock}${previousAttempts}\n\nRules:\n- Edit ONLY the suspected file (or at most one closely-related file).\n- For missing-import errors: prefer adding the package via the \`add_dependency\` tool over deleting the feature.\n- For runtime crashes: add optional chaining / default values.\n- Never assign to read-only DOM/Event/Error/MutationRecord fields; copy into a plain object instead.\n- Do NOT change unrelated logic or styling.\n- Do NOT re-plan the project.`;

      healInFlightRef.current = true;
      try {
        await onHealPrompt(prompt);
      } finally {
        healInFlightRef.current = false;
        lastHealFinishedAtRef.current = Date.now();
        // Reset the signature counter for this error so the cooldown window
        // gives the new code a clean shot before we count repeats again.
        errorSignatureCountRef.current.delete(signature);
      }

      void recordErrorHistory({
        projectId: project.id,
        filePath: culprit.path ?? "",
        errorMessage: message,
        errorStack: stack,
        fixSummary: `Surgical AI edit attempt ${attempt}/${MAX_HEAL_ATTEMPTS}${culprit.path ? ` on ${culprit.path}` : ""}.`,
        fixKind: `auto-heal-${attempt}`,
      });
    };

    window.addEventListener("preview-error", handler as EventListener);
    return () => window.removeEventListener("preview-error", handler as EventListener);
  }, [loading, project, onHealPrompt, onClaudeHealed]);

  return { resetHeal };
}
