// ═══════════════════════════════════════════════════════════════════════════
// TOOL EXECUTORS — File Ops (5 handlers)
// ───────────────────────────────────────────────────────────────────────────
// Handlers for tools defined in ../schemas/file-ops.ts. Dispatched by
// ./index.ts → execTool(name, args, ctx, callId).
//
// Placeholder substitution (CRITICAL):
//   Generated apps must use the user's LINKED Supabase project, not the
//   platform's shared one. The agent writes files containing the literal
//   placeholders __SUPABASE_URL__ and __SUPABASE_ANON__; we substitute them
//   here at write-time using credentials from project_supabase_links. If no
//   project is linked yet, the placeholders are left intact and a warning is
//   surfaced — the agent should then prompt the user to connect Supabase.
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolContext } from "../../types.ts";
import { normalizePath, extractImports, ALLOWED_BARE_PACKAGES } from "../../validation/parsers.ts";
import { buildDependentsPayload } from "./dependents.ts";

// ─── Pre-flight import gate ────────────────────────────────────────────────
// Block writes that import a bare package which is neither in the curated
// allowlist NOR already declared in package.json. Returning an error response
// before persisting forces the model to either swap the import to a known
// package OR call add_dependency in the SAME turn — instead of triggering an
// auto-heal round (which costs a full LLM call + risks looping).
//
// We intentionally allow:
//   • Relative / @/ / node: imports
//   • Anything in ALLOWED_BARE_PACKAGES
//   • Anything already present in package.json dependencies/devDependencies
//   • Any subpath of an allowed root (e.g. "framer-motion/dom")
//   • Writes to package.json itself (so the model can add the dep)
//
// Cached per-turn on ctx so we don't re-fetch package.json on every write.
type PkgCache = { deps: Set<string>; loaded: boolean };
async function loadPkgDeps(ctx: ToolContext): Promise<Set<string>> {
  const cached = (ctx as any).__pkgDepsCache as PkgCache | undefined;
  if (cached?.loaded) return cached.deps;
  const deps = new Set<string>();
  try {
    const { data } = await ctx.supabase
      .from("project_files")
      .select("content")
      .eq("project_id", ctx.projectId)
      .eq("path", "/package.json")
      .maybeSingle();
    if (data?.content) {
      const pkg = JSON.parse(data.content as string);
      for (const k of Object.keys(pkg.dependencies ?? {})) deps.add(k);
      for (const k of Object.keys(pkg.devDependencies ?? {})) deps.add(k);
    }
  } catch { /* best-effort */ }
  (ctx as any).__pkgDepsCache = { deps, loaded: true };
  return deps;
}

function rootOf(spec: string): string {
  return spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
}

function isAllowedSpec(spec: string, knownDeps: Set<string>): boolean {
  if (ALLOWED_BARE_PACKAGES.has(spec)) return true;
  const root = rootOf(spec);
  if (ALLOWED_BARE_PACKAGES.has(root)) return true;
  if (knownDeps.has(root)) return true;
  return false;
}

async function checkUnknownImports(
  ctx: ToolContext,
  path: string,
  content: string,
): Promise<{ unknown: string[] } | null> {
  if (!/\.(tsx?|jsx?|mts|cts)$/.test(path)) return null;
  if (normalizePath(path) === "/package.json") return null;
  const knownDeps = await loadPkgDeps(ctx);
  const unknown = new Set<string>();
  for (const spec of extractImports(content)) {
    if (spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("@/")) continue;
    if (spec.startsWith("node:") || spec === "fs" || spec === "path" || spec === "url" || spec === "crypto") continue;
    if (isAllowedSpec(spec, knownDeps)) continue;
    unknown.add(rootOf(spec));
  }
  if (unknown.size === 0) return null;
  return { unknown: [...unknown] };
}

function unknownImportError(path: string, unknown: string[]) {
  const list = unknown.join(", ");
  const allowedSample = [...ALLOWED_BARE_PACKAGES].slice(0, 10).join(", ");
  return {
    error: `Refusing to write ${path}: imports unknown package(s) [${list}] not in allowlist and not in package.json.`,
    unknown_packages: unknown,
    hint:
      `Either (a) swap the import to one of the curated packages — ${allowedSample}, … — ` +
      `or (b) FIRST call add_dependency for each new package, THEN retry this write in the same turn. ` +
      `Do not invent package names; verify the package exists on npm before adding.`,
  };
}

// ─── Atomic package.json sync ──────────────────────────────────────────────
// When the model writes a file that imports an allowlisted bare package which
// is NOT yet in package.json (e.g. `react-router-dom` on first use), Vite will
// crash with "Could not find dependency" the moment that file lands. The
// end-of-turn autofix DOES eventually patch package.json, but the user sees
// a red runtime-error overlay in the meantime.
//
// Fix: every successful write extracts its imports and, for any allowlisted
// package missing from package.json, upserts package.json in the same DB tick.
// Cheap, idempotent, and prevents the visible crash entirely.
const PACKAGE_VERSIONS_INLINE: Record<string, string> = {
  "react-router-dom": "^6.30.0",
  "react-router": "^6.30.0",
  "framer-motion": "^11.11.0",
  "lucide-react": "^0.462.0",
  "qrcode.react": "^4.2.0",
  "sonner": "^1.7.0",
  "clsx": "^2.1.1",
  "tailwind-merge": "^2.5.5",
  "@supabase/supabase-js": "^2.45.0",
  "zustand": "^5.0.0",
  "date-fns": "^3.6.0",
  "recharts": "^2.12.7",
  "zod": "^3.23.8",
  "react-hook-form": "^7.53.0",
  "@hookform/resolvers": "^3.9.0",
};

async function syncPackageJsonForWrites(
  ctx: ToolContext,
  written: { path: string; content: string }[],
): Promise<string[]> {
  // Collect bare-package roots imported by any file in this batch.
  const wantedRoots = new Set<string>();
  for (const f of written) {
    if (!/\.(tsx?|jsx?|mts|cts)$/.test(f.path)) continue;
    if (normalizePath(f.path) === "/package.json") continue;
    for (const spec of extractImports(f.content)) {
      if (spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("@/")) continue;
      if (spec.startsWith("node:") || spec === "fs" || spec === "path" || spec === "url" || spec === "crypto") continue;
      const root = rootOf(spec);
      if (ALLOWED_BARE_PACKAGES.has(spec) || ALLOWED_BARE_PACKAGES.has(root)) {
        wantedRoots.add(root);
      }
    }
  }
  if (wantedRoots.size === 0) return [];
  // Load current package.json (don't trust the per-turn deps cache here — it
  // may be stale relative to in-flight upserts).
  const { data } = await ctx.supabase
    .from("project_files")
    .select("content")
    .eq("project_id", ctx.projectId)
    .eq("path", "/package.json")
    .maybeSingle();
  if (!data?.content) return [];
  let pkg: any;
  try { pkg = JSON.parse(data.content as string); } catch { return []; }
  if (!pkg || typeof pkg !== "object") return [];
  pkg.dependencies = pkg.dependencies || {};
  const added: string[] = [];
  for (const root of wantedRoots) {
    if (pkg.dependencies[root] || pkg.devDependencies?.[root]) continue;
    pkg.dependencies[root] = PACKAGE_VERSIONS_INLINE[root] ?? "latest";
    added.push(root);
  }
  if (added.length === 0) return [];
  const newContent = JSON.stringify(pkg, null, 2) + "\n";
  await (ctx.supabase.from("project_files") as any).upsert({
    project_id: ctx.projectId,
    user_id: ctx.userId,
    path: "/package.json",
    content: newContent,
    updated_at: new Date().toISOString(),
  }, { onConflict: "project_id,path" });
  ctx.filesChanged.push({ path: "/package.json", action: "updated" });
  ctx.readCache.set("/package.json", { result: { path: "/package.json", content: newContent }, reads: 0, mutatedSinceLastRead: true });
  // Refresh the per-turn deps cache so subsequent gate checks see the new deps.
  const cached = (ctx as any).__pkgDepsCache as PkgCache | undefined;
  if (cached) for (const a of added) cached.deps.add(a);
  return added;
}

export type ToolHandler = (
  args: any,
  ctx: ToolContext,
  callId: string,
) => Promise<{ result: any; askUser?: boolean }>;

// ─── Placeholder substitution ──────────────────────────────────────────────
// Uses the AES-GCM helper from _shared/sboauth.ts to decrypt the stored
// anon key. Cached per-turn on ctx so we don't decrypt on every write.
type LinkCreds = { url: string; anon: string } | null;

async function getLinkedCreds(ctx: ToolContext): Promise<LinkCreds> {
  const cached = (ctx as any).__linkCreds;
  if (cached !== undefined) return cached as LinkCreds;
  try {
    const { data: link } = await ctx.supabase
      .from("project_supabase_links")
      .select("api_url, anon_key_encrypted")
      .eq("project_id", ctx.projectId)
      .maybeSingle();
    if (!link?.api_url || !link?.anon_key_encrypted) {
      (ctx as any).__linkCreds = null;
      return null;
    }
    const { decrypt } = await import("../../../_shared/sboauth.ts");
    const anon = await decrypt(link.anon_key_encrypted as string);
    const creds = { url: String(link.api_url), anon };
    (ctx as any).__linkCreds = creds;
    return creds;
  } catch (_e) {
    (ctx as any).__linkCreds = null;
    return null;
  }
}

const PLACEHOLDER_RE = /__SUPABASE_(URL|ANON)__/;

async function substitutePlaceholders(
  ctx: ToolContext,
  content: string,
): Promise<{ content: string; substituted: boolean; missing_link: boolean }> {
  if (!PLACEHOLDER_RE.test(content)) {
    return { content, substituted: false, missing_link: false };
  }
  const creds = await getLinkedCreds(ctx);
  if (!creds) {
    return { content, substituted: false, missing_link: true };
  }
  const replaced = content
    .replace(/__SUPABASE_URL__/g, creds.url)
    .replace(/__SUPABASE_ANON__/g, creds.anon);
  return { content: replaced, substituted: true, missing_link: false };
}

// ─── Read-only DOM/Error mutation gate ─────────────────────────────────────
// Catches `error.message = ...`, `event.target = ...`, `mutation.attributeName = ...`
// before the broken file lands in the DB — these throw "TypeError: 'message'
// is read-only" at runtime and crash the preview app. System prompt already
// forbids this; the static gate makes it deterministic.
const READONLY_MUTATION_RE =
  /\b(?:err(?:or)?|e|ev(?:ent|t)?|mutation|record|attr(?:ibute)?s?|node|target)\s*\.\s*(?:message|attributeName|attributeNamespace|target|currentTarget|type|timeStamp|isTrusted|nodeType|nodeName|ownerDocument|parentNode|namedItem|removedNodes|addedNodes)\s*=(?!=)/;
function checkReadOnlyMutation(path: string, content: string): { line: number; snippet: string } | null {
  if (!/\.(tsx?|jsx?|mts|cts)$/.test(path)) return null;
  const stripped = content.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const m = READONLY_MUTATION_RE.exec(stripped);
  if (!m) return null;
  const line = stripped.slice(0, m.index).split("\n").length;
  return { line, snippet: m[0].trim() };
}
function readOnlyMutationError(path: string, hit: { line: number; snippet: string }) {
  return {
    error: `Refusing to write ${path}: line ${hit.line} mutates a read-only browser field — \`${hit.snippet}\` throws "TypeError: '...' is read-only" at runtime and crashes the preview.`,
    hint:
      "Browser-owned fields on Error / Event / MutationRecord / Node are READ-ONLY. " +
      "Copy the value into a plain object instead: `const info = { message: customMsg, original: err.message };` then use `info` downstream.",
  };
}


export const exec_read_file: ToolHandler = async (args, ctx, callId) => {
if (typeof args.path !== "string") return { result: { error: "path must be a string" } };
const requestedPath = args.path;
const path = normalizePath(requestedPath);
const cached = ctx.readCache.get(path);
if (cached) {
  // If the file was mutated (write_file / edit_file / bulk_write_files /
  // autofix) since the last read, this re-read is LEGITIMATE — return the
  // updated content with no nag, reset the counter, and clear the flag.
  if (cached.mutatedSinceLastRead) {
    cached.mutatedSinceLastRead = false;
    cached.reads = 1;
    return {
      result: {
        ...cached.result,
        _note: "File was modified since your last read — this is the fresh content.",
      },
    };
  }
  cached.reads++;
  // 2nd read → soft warning. 3rd+ read → hard block (return cached, no DB hit).
  if (cached.reads >= 3) {
    return {
      result: {
        ...cached.result,
        _warning:
          `You have read this file ${cached.reads} times this turn. Content is unchanged since your first read. STOP re-reading — use the content you already have and proceed with edits.`,
      },
    };
  }
  return {
    result: {
      ...cached.result,
      _note: "Cached from earlier read this turn (no changes since). Avoid re-reading.",
    },
  };
}
const pathVariants = [...new Set([requestedPath, path, path.replace(/^\//, "")])];
const { data, error } = await ctx.supabase
  .from("project_files")
  .select("path, content")
  .eq("project_id", ctx.projectId)
  .in("path", pathVariants)
  .limit(1);
if (error) return { result: { error: error.message } };
const rows = (data ?? []) as { path: string; content: string }[];
const row = rows[0] ?? null;
if (!row) {
  const basename = path.split("/").pop() || path;
  const { data: allPaths } = await ctx.supabase
    .from("project_files")
    .select("path")
    .eq("project_id", ctx.projectId);
  const candidates = ((allPaths ?? []) as { path: string }[])
    .map((r) => r.path)
    .filter((p) => p.endsWith(path) || p.endsWith(`/${basename}`))
    .slice(0, 8);
  const result = {
    error: `File not found: ${requestedPath}`,
    requested_path: requestedPath,
    candidates,
    hint: candidates.length > 0
      ? `Use the exact existing path: ${candidates[0]}`
      : "Call list_files or grep_files once to discover the correct path; do not keep retrying this same missing path.",
  };
  ctx.readCache.set(path, { result, reads: 1 });
  return { result };
}
const result = { path: row.path, content: row.content };
ctx.readCache.set(path, { result, reads: 1 });
return { result };
};

export const exec_write_file: ToolHandler = async (args, ctx, callId) => {
if (typeof args.path !== "string" || typeof args.content !== "string") {
  return { result: { error: "path and content must be strings" } };
}
// Pre-flight: refuse to write code that imports unknown packages.
const gate = await checkUnknownImports(ctx, args.path, args.content);
if (gate) return { result: unknownImportError(args.path, gate.unknown) };
// Pre-flight: refuse to write code that mutates read-only browser fields.
const roHit = checkReadOnlyMutation(args.path, args.content);
if (roHit) return { result: readOnlyMutationError(args.path, roHit) };
const sub = await substitutePlaceholders(ctx, args.content);
const finalContent = sub.content;
// CRITICAL ORDERING: sync package.json BEFORE writing the source file.
// Vite's HMR fires on the source upsert; if package.json doesn't already list
// the imported package, the user sees a red "Could not find dependency" overlay
// for the brief window between the two writes. Doing deps first is harmless if
// the source write later fails.
const autoDeps = await syncPackageJsonForWrites(ctx, [{ path: args.path, content: finalContent }]);
const { data: existing } = await ctx.supabase
  .from("project_files")
  .select("id")
  .eq("project_id", ctx.projectId)
  .eq("path", args.path)
  .maybeSingle();
const action = existing ? "updated" : "created";
const { error } = await (ctx.supabase.from("project_files") as any).upsert(
  {
    project_id: ctx.projectId,
    user_id: ctx.userId,
    path: args.path,
    content: finalContent,
    updated_at: new Date().toISOString(),
  },
  { onConflict: "project_id,path" },
);
if (error) return { result: { error: error.message } };
ctx.filesChanged.push({ path: args.path, action });
// If we just rewrote package.json, invalidate the pre-flight gate cache.
if (normalizePath(args.path) === "/package.json") (ctx as any).__pkgDepsCache = undefined;
// Refresh read cache so subsequent reads see new content (and reset counter).
ctx.readCache.set(normalizePath(args.path), { result: { path: args.path, content: finalContent }, reads: 0, mutatedSinceLastRead: true });
const dependents = await buildDependentsPayload(ctx, args.path);
return {
  result: {
    success: true,
    path: args.path,
    action,
    bytes: finalContent.length,
    ...(sub.substituted ? { credentials_injected: true } : {}),
    ...(sub.missing_link ? {
      warning:
        "File contains __SUPABASE_URL__/__SUPABASE_ANON__ placeholders but NO Supabase project is linked. " +
        "The placeholders were left intact — the app will NOT connect to a database until the user links " +
        "their Supabase project. Render `[[supabase-connect]]` in your reply so the user sees the connect card.",
    } : {}),
    ...(autoDeps.length > 0 ? { auto_added_dependencies: autoDeps } : {}),
    ...(dependents ? { dependents } : {}),
  },
};
};

export const exec_bulk_write_files: ToolHandler = async (args, ctx, callId) => {
const files = Array.isArray(args.files) ? args.files.slice(0, 12) : [];
if (files.length === 0) return { result: { error: "files must be a non-empty array" } };

const valid = files.filter((f: any) => typeof f?.path === "string" && typeof f?.content === "string");
if (valid.length !== files.length) return { result: { error: "every file needs string path and content" } };

// Pre-flight import gate across the whole batch — collect every file's
// unknown packages and refuse the entire batch if any exist. Atomic refusal
// keeps autoheal from getting half-written batches.
const blocked: { path: string; unknown: string[] }[] = [];
for (const f of valid) {
  const gate = await checkUnknownImports(ctx, f.path, f.content);
  if (gate) blocked.push({ path: f.path, unknown: gate.unknown });
}
if (blocked.length > 0) {
  const allUnknown = [...new Set(blocked.flatMap((b) => b.unknown))];
  return {
    result: {
      error: `Refusing batch: ${blocked.length} file(s) import unknown packages.`,
      blocked,
      unknown_packages: allUnknown,
      hint:
        `For EACH unknown package, either swap to an allowlisted equivalent OR call add_dependency first, ` +
        `THEN re-run bulk_write_files in this same turn. Do not invent package names.`,
    },
  };
}

// Pre-flight read-only mutation gate (per file). Atomic refusal: if any
// file mutates a read-only browser field, reject the whole batch so the
// model fixes it before retrying.
const roBlocked: { path: string; line: number; snippet: string }[] = [];
for (const f of valid) {
  const hit = checkReadOnlyMutation(f.path, f.content);
  if (hit) roBlocked.push({ path: f.path, ...hit });
}
if (roBlocked.length > 0) {
  return {
    result: {
      error: `Refusing batch: ${roBlocked.length} file(s) mutate read-only browser fields (TypeError "is read-only" at runtime).`,
      blocked: roBlocked,
      hint:
        "For EACH file: instead of `error.message = X` or `event.target = X`, copy the value into a NEW plain object — " +
        "`const info = { message: X, original: error.message };` — then use `info` downstream. Re-run bulk_write_files in this same turn.",
    },
  };
}

let anySubstituted = false;
let anyMissingLink = false;
const processed = await Promise.all(valid.map(async (f: any) => {
  const sub = await substitutePlaceholders(ctx, f.content);
  if (sub.substituted) anySubstituted = true;
  if (sub.missing_link) anyMissingLink = true;
  return { ...f, content: sub.content };
}));

const paths = processed.map((f: any) => f.path);
const { data: existing, error: readErr } = await ctx.supabase
  .from("project_files")
  .select("path")
  .eq("project_id", ctx.projectId)
  .in("path", paths);
if (readErr) return { result: { error: readErr.message } };

const existingPaths = new Set(((existing ?? []) as { path: string }[]).map((r) => r.path));
const now = new Date().toISOString();
// CRITICAL ORDERING: sync package.json BEFORE upserting source files so Vite's
// HMR resolution sees the new deps the moment the source files appear.
const autoDeps = await syncPackageJsonForWrites(ctx, processed.map((f: any) => ({ path: f.path, content: f.content })));
const rows = processed.map((f: any) => ({ project_id: ctx.projectId, user_id: ctx.userId, path: f.path, content: f.content, updated_at: now }));
const { error } = await ctx.supabase.from("project_files").upsert(rows, { onConflict: "project_id,path" });
if (error) return { result: { error: error.message } };

const changed = processed.map((f: any) => ({ path: f.path, action: existingPaths.has(f.path) ? "updated" : "created", bytes: f.content.length }));
for (const c of changed) {
  ctx.filesChanged.push({ path: c.path, action: c.action as "created" | "updated" });
  if (normalizePath(c.path) === "/package.json") (ctx as any).__pkgDepsCache = undefined;
}
for (const f of processed) ctx.readCache.set(normalizePath(f.path), { result: { path: f.path, content: f.content }, reads: 0, mutatedSinceLastRead: true });
// Aggregate dependents across all written files (dedupe by path).
const depsMap = new Map<string, { path: string; symbols: string[] }>();
let depsTotal = 0;
for (const f of processed) {
  const dp = await buildDependentsPayload(ctx, f.path);
  if (dp) {
    depsTotal += dp.count;
    for (const file of dp.files) {
      if (!depsMap.has(file.path)) depsMap.set(file.path, file);
    }
  }
}
const dependents = depsMap.size > 0
  ? {
      count: depsMap.size,
      files: [...depsMap.values()].slice(0, 12),
      hint:
        "These files import one or more files you just wrote. If you renamed/removed an export or changed a type, " +
        "read each dependent and patch it in the SAME turn — never finish leaving a broken importer.",
    }
  : null;

return {
  result: {
    success: true,
    files: changed,
    count: changed.length,
    ...(anySubstituted ? { credentials_injected: true } : {}),
    ...(anyMissingLink ? {
      warning:
        "One or more files contain __SUPABASE_URL__/__SUPABASE_ANON__ placeholders but NO Supabase project is linked. " +
        "Placeholders were left intact — render `[[supabase-connect]]` in your reply so the user sees the connect card.",
    } : {}),
    ...(autoDeps.length > 0 ? { auto_added_dependencies: autoDeps } : {}),
    ...(dependents ? { dependents } : {}),
  },
};
};

const decodeHtmlEntities = (value: string): string =>
  value.replace(/&(amp|lt|gt|quot|apos|nbsp|#39|#x27|#x2F);/gi, (entity) => {
    const key = entity.toLowerCase();
    if (key === "&amp;") return "&";
    if (key === "&lt;") return "<";
    if (key === "&gt;") return ">";
    if (key === "&quot;") return '"';
    if (key === "&apos;" || key === "&#39;" || key === "&#x27;") return "'";
    if (key === "&#x2f;") return "/";
    if (key === "&nbsp;") return " ";
    return entity;
  });

const unescapeCommonLiterals = (value: string): string =>
  value
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, "\\");

const candidateSearches = (search: string): string[] => {
  const decoded = decodeHtmlEntities(search);
  const unescaped = unescapeCommonLiterals(search);
  const unescapedDecoded = unescapeCommonLiterals(decoded);
  return [...new Set([search, decoded, unescaped, unescapedDecoded].map((value) => value.replace(/\r\n/g, "\n")))];
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findFlexibleWhitespaceMatch = (
  original: string,
  searches: string[],
): { search: string; idx: number; length: number } | null => {
  for (const search of searches) {
    const trimmed = search.trim();
    if (trimmed.length < 24 || !/\s/.test(trimmed)) continue;
    const pattern = escapeRegExp(trimmed).replace(/\s+/g, "\\s+");
    const re = new RegExp(pattern, "g");
    const matches = [...original.matchAll(re)];
    if (matches.length === 1 && typeof matches[0].index === "number") {
      return { search, idx: matches[0].index, length: matches[0][0].length };
    }
  }
  return null;
};

export const exec_edit_file: ToolHandler = async (args, ctx, callId) => {
if (
  typeof args.path !== "string" ||
  typeof args.search !== "string" ||
  typeof args.replace !== "string"
) {
  return { result: { error: "path, search, replace must be strings" } };
}
if (args.search.length === 0) {
  return { result: { error: "search must not be empty" } };
}
const requestedPath = args.path;
const path = normalizePath(requestedPath);
const pathVariants = [...new Set([requestedPath, path, path.replace(/^\//, "")])];
const { data: row, error: readErr } = await ctx.supabase
  .from("project_files")
  .select("path, content")
  .eq("project_id", ctx.projectId)
  .in("path", pathVariants)
  .limit(1);
if (readErr) return { result: { error: readErr.message } };
const file = ((row ?? []) as { path: string; content: string }[])[0] ?? null;
if (!file) return { result: { error: `File not found: ${requestedPath}` } };
const original = file.content as string;
const searches = candidateSearches(args.search);
const matches = searches
  .map((search) => ({ search, idx: original.indexOf(search), length: search.length, flexible: false }))
  .filter((match) => match.idx !== -1);
const exactMatch = matches[0];
const flexibleMatch = exactMatch ? null : findFlexibleWhitespaceMatch(original, searches);
const match = exactMatch ?? (flexibleMatch ? { ...flexibleMatch, flexible: true } : undefined);
const idx = match?.idx ?? -1;
if (idx === -1) {
  const cached = ctx.readCache.get(path);
  const hint = cached?.result?.content
    ? "Use the read_file content already returned this turn. Copy an exact, unique block from that raw content; do not invent context or paste JSX escaped as HTML/JSON."
    : "Call read_file once, then retry with an exact, unique block copied from raw source; do not invent context or paste JSX escaped as HTML/JSON.";
  return { result: { error: "search text not found in file", hint, path: file.path } };
}
if (!match.flexible && original.indexOf(match.search, idx + 1) !== -1) {
  return { result: { error: "search text appears multiple times — add more surrounding context to make it unique" } };
}
const replacement = match.search !== args.search || match.flexible
  ? unescapeCommonLiterals(decodeHtmlEntities(args.replace)).replace(/\r\n/g, "\n")
  : args.replace;
const updatedRaw = original.slice(0, idx) + replacement + original.slice(idx + match.length);
const sub = await substitutePlaceholders(ctx, updatedRaw);
const updated = sub.content;
const { error: writeErr } = await (ctx.supabase.from("project_files") as any).upsert(
  {
    project_id: ctx.projectId,
    user_id: ctx.userId,
    path: file.path,
    content: updated,
    updated_at: new Date().toISOString(),
  },
  { onConflict: "project_id,path" },
);
if (writeErr) return { result: { error: writeErr.message } };
ctx.filesChanged.push({ path: file.path, action: "updated" });
ctx.readCache.set(normalizePath(file.path), { result: { path: file.path, content: updated }, reads: 0, mutatedSinceLastRead: true });
const autoDeps = await syncPackageJsonForWrites(ctx, [{ path: file.path, content: updated }]);
const dependents = await buildDependentsPayload(ctx, file.path);
return {
  result: {
    success: true,
    path: file.path,
    action: "updated",
    bytes_delta: replacement.length - match.length,
    normalized_search: match.search !== args.search || match.flexible,
    match_mode: match.flexible ? "flexible_whitespace" : "exact",
    ...(sub.substituted ? { credentials_injected: true } : {}),
    ...(sub.missing_link ? { warning: "Placeholder __SUPABASE_URL__/__SUPABASE_ANON__ left intact — render `[[supabase-connect]]` in your reply." } : {}),
    ...(autoDeps.length > 0 ? { auto_added_dependencies: autoDeps } : {}),
    ...(dependents ? { dependents } : {}),
  },
};
};

export const exec_delete_file: ToolHandler = async (args, ctx, callId) => {
if (typeof args.path !== "string") return { result: { error: "path required" } };
// Refuse to delete if other files still import this one — unless the agent
// passes force=true (meaning it has already migrated callers in this turn).
if (!args.force) {
  const deps = await buildDependentsPayload(ctx, args.path);
  if (deps && deps.count > 0) {
    return {
      result: {
        error: `Refusing to delete ${args.path}: ${deps.count} file(s) still import it.`,
        dependents: deps,
        hint:
          "Either (a) call rename_symbol / write_file on every dependent in the SAME turn so they no longer reference this file, then retry with force=true, or (b) keep the file and just edit it instead of deleting.",
      },
    };
  }
}
const { error } = await ctx.supabase
  .from("project_files")
  .delete()
  .eq("project_id", ctx.projectId)
  .eq("path", args.path);
if (error) return { result: { error: error.message } };
ctx.filesChanged.push({ path: args.path, action: "updated" });
ctx.readCache.delete(normalizePath(args.path));
delete (ctx as any).__deps_files;
return { result: { success: true, path: args.path, deleted: true } };
};

export const FILE_OPS_EXEC: Record<string, ToolHandler> = {
  read_file: exec_read_file,
  write_file: exec_write_file,
  bulk_write_files: exec_bulk_write_files,
  edit_file: exec_edit_file,
  delete_file: exec_delete_file,
};
