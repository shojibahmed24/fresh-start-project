// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION — Parsers & low-level structural checks
// ───────────────────────────────────────────────────────────────────────────
// Best-effort regex/heuristic parsers (no real TS compiler in Deno). Used by
// the higher-level validators in ./checks.ts and the auto-fix engine in
// ../autofix.ts. Pure functions only — no I/O, no ToolContext dependency.
// ═══════════════════════════════════════════════════════════════════════════

import type { ValidationIssue } from "../types.ts";

export const FORBIDDEN_IMPORT_PATTERNS: { pattern: RegExp; reason: string; hint: string }[] = [
  { pattern: /^next(\/|$)/, reason: "next/* not allowed (Vite project, not Next.js)", hint: "Replace with plain React + relative imports." },
  { pattern: /^react-native/, reason: "react-native not allowed (web project)", hint: "Use plain divs + Tailwind classes." },
  { pattern: /^axios$/, reason: "axios not allowed — use fetch()", hint: "Swap `axios.get(url)` for `fetch(url).then(r => r.json())`." },
  // (@/ alias is configured in vite.config.ts + tsconfig.json — DO NOT ban it.
  //  Existing template, shadcn/ui components, and snippets all use it.)
  { pattern: /^node:/, reason: "node: built-ins not available in browser", hint: "Remove or replace with browser equivalents." },
  { pattern: /^(fs|path|child_process|crypto|http|https|os|stream)$/, reason: "Node built-in not available in the browser", hint: "Use a browser-native API instead." },
];

// Bare-module imports are only allowed if they match this whitelist. Anything
// else means the model invented a package name. Relative imports (./, ../)
// and node:* / fs / path bypass this and go through forbidden checks above.
export const ALLOWED_BARE_PACKAGES = new Set<string>([
  "react",
  "react-dom",
  "react/jsx-runtime",
  "react-dom/client",
  "react-router-dom",
  "react-router",
  "lucide-react",
  "framer-motion",
  "@supabase/supabase-js",
  "qrcode.react",
  "sonner",
  "clsx",
  "tailwind-merge",
  "zustand",
  "date-fns",
  "recharts",
  "zod",
  "react-hook-form",
  "@hookform/resolvers",
  "@hookform/resolvers/zod",
  // Build-tool / config-file imports (type-only or build-time).
  // These appear in tailwind.config.ts, vite.config.ts, postcss.config.js.
  // Without them the very first scaffold batch fails the unknown-imports gate.
  "tailwindcss",
  "tailwindcss-animate",
  "tailwindcss/plugin",
  "autoprefixer",
  "postcss",
  "vite",
  "@vitejs/plugin-react-swc",
  "@vitejs/plugin-react",
  "typescript",
  "@types/react",
  "@types/react-dom",
  "@types/node",
  "vite-plugin-pwa",
]);

export function extractImports(src: string): string[] {
  const out: string[] = [];
  const re = /(?:^|\n)\s*(?:import\s[^'"`]*from\s*|import\s*)['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.push(m[1]);
  return out;
}

export function normalizePath(p: string): string {
  return p.startsWith("/") ? p : "/" + p;
}

export function resolveRelativeImport(
  fromPath: string,
  spec: string,
  allPaths: Set<string>,
): { ok: boolean; resolved: string | null } {
  const fromDir = fromPath.replace(/\/[^/]*$/, "");
  const segs = (fromDir + "/" + spec).split("/");
  const stack: string[] = [];
  for (const s of segs) {
    if (s === "" || s === ".") continue;
    if (s === "..") stack.pop();
    else stack.push(s);
  }
  const base = "/" + stack.join("/");
  const candidates = [
    base,
    base + ".ts",
    base + ".tsx",
    base + ".js",
    base + ".jsx",
    base + "/index.ts",
    base + "/index.tsx",
    base + "/index.js",
    base + "/index.jsx",
  ];
  for (const c of candidates) if (allPaths.has(c)) return { ok: true, resolved: c };
  return { ok: false, resolved: null };
}

// (ValidationIssue moved to ./types.ts)

// Strip strings, template literals, regex, line comments and block comments
// so structural counts (brackets, JSX) aren't confused by content. This is a
// best-effort scrubber, not a real parser.
export function stripStringsAndComments(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    // line comment
    if (c === "/" && c2 === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    // block comment
    if (c === "/" && c2 === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    // strings
    if (c === '"' || c === "'") {
      const quote = c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\") i += 2;
        else if (src[i] === "\n") break;
        else i++;
      }
      i++;
      out += " ";
      continue;
    }
    // template literal — keep ${...} brackets so we still count them
    if (c === "`") {
      i++;
      while (i < n && src[i] !== "`") {
        if (src[i] === "\\") { i += 2; continue; }
        if (src[i] === "$" && src[i + 1] === "{") {
          out += "${";
          i += 2;
          let depth = 1;
          while (i < n && depth > 0) {
            if (src[i] === "{") depth++;
            else if (src[i] === "}") depth--;
            if (depth > 0) out += src[i];
            i++;
          }
          out += "}";
        } else {
          i++;
        }
      }
      i++;
      out += " ";
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

// Count brackets on a string already scrubbed of comments/strings.
export function bracketDelta(scrubbed: string): { round: number; curly: number; square: number } {
  let round = 0, curly = 0, square = 0;
  for (let i = 0; i < scrubbed.length; i++) {
    const c = scrubbed[i];
    if (c === "(") round++;
    else if (c === ")") round--;
    else if (c === "{") curly++;
    else if (c === "}") curly--;
    else if (c === "[") square++;
    else if (c === "]") square--;
  }
  return { round, curly, square };
}

// Heuristic JSX tag balance check. Counts opening tags vs closing tags vs
// self-closing on a scrubbed source. Fragments (<> </>) are counted too.
//
// IMPORTANT: TypeScript generics in .tsx files look like `<Foo>` too
// (e.g. `useState<Show | null>(...)`, `Array<T>`, `Map<K, V>`). Those are
// NOT JSX and must not be counted. Heuristic: a real JSX opener is preceded
// by start-of-file, whitespace, `(`, `{`, `,`, `>`, `=`, `&&`, `||`, `?`,
// `:`, `;`, or `return` — i.e. an *expression* position. A TS generic is
// preceded by an identifier or `)` (function call / type ref position).
export function jsxTagDelta(scrubbed: string): number {
  // Match `<Tag` with the preceding character captured so we can filter
  // out TypeScript generics. We allow "no preceding char" (start of input).
  const openRe = /(^|[\s(){}\[\],;=+\-*/%!&|?:<>~])<([A-Za-z][\w.-]*)(?=[\s/>])/g;
  let opens = 0;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(scrubbed)) !== null) {
    // The lookahead doesn't consume, so manually advance to avoid infinite loop on zero-width.
    if (m.index === openRe.lastIndex) openRe.lastIndex++;
    opens++;
  }
  const closes = (scrubbed.match(/<\/[A-Za-z][\w.-]*\s*>/g) || []).length;
  // `/>` for self-closing JSX. Exclude `</` (closing tag) and regex literals
  // are already stripped by stripStringsAndComments.
  const selfClose = (scrubbed.match(/(?<!<)\/>/g) || []).length;
  const fragOpen = (scrubbed.match(/<>/g) || []).length;
  const fragClose = (scrubbed.match(/<\/>/g) || []).length;
  return (opens + fragOpen) - (closes + selfClose + fragClose);
}

// Files that MUST default-export their main component for the runtime loader
// to mount them. The auto-heal layer also enforces this.
export function requiresDefaultExport(path: string): boolean {
  const p = normalizePath(path);
  return (
    p === "/src/App.tsx" ||
    p === "/src/App.jsx" ||
    /^\/src\/screens\//.test(p) ||
    /^\/src\/pages\//.test(p)
  );
}

// Cheap "looks like a React component file" test for runtime-safety scans.
export function isComponentFile(path: string, content: string): boolean {
  const p = normalizePath(path);
  if (!/\.(tsx|jsx)$/.test(p)) return false;
  return /<[A-Za-z]/.test(content); // contains JSX
}

// Patterns the heal layer uses; mirroring them here so issues are caught
// BEFORE the file ever runs in the preview.
export const RUNTIME_SAFETY_PATTERNS: { re: RegExp; problem: string; hint: string }[] = [
  // bare `.map(` on something that isn't obviously safe-guarded
  {
    re: /(?<![?.\w])([a-zA-Z_$][\w$]*)\.map\(/g,
    problem: "Possible unsafe `.map()` on a value that may be undefined",
    hint: "Use `(value ?? []).map(...)` or default the variable in destructuring.",
  },
  {
    re: /(?<![?.\w])([a-zA-Z_$][\w$]*)\.length(?![\w])/g,
    problem: "Possible unsafe `.length` on a value that may be undefined",
    hint: "Use `value?.length ?? 0`.",
  },
  {
    re: /(?<![?.\w])([a-zA-Z_$][\w$]*)\.toFixed\(/g,
    problem: "Possible unsafe `.toFixed()` on a value that may be undefined",
    hint: "Use `(value ?? 0).toFixed(n)`.",
  },
];

// Names we know are always safe (won't be undefined at runtime) so we don't
// flag `Math.max`, `JSON.stringify`, etc. as unsafe.
export const SAFE_GLOBAL_NAMES = new Set([
  "Math", "JSON", "Object", "Array", "String", "Number", "Boolean", "Date",
  "console", "window", "document", "navigator", "localStorage", "sessionStorage",
  "Promise", "Map", "Set", "Symbol", "Error", "RegExp", "Intl", "URL",
  "React", "props", "this", "self",
]);

export function scanRuntimeSafety(src: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>(); // dedupe by (problem|name)
  for (const { re, problem, hint } of RUNTIME_SAFETY_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const name = m[1];
      if (SAFE_GLOBAL_NAMES.has(name)) continue;
      // skip `const { x = [] } = ...` — destructured-with-default values
      const defaultedDestructure = new RegExp(
        `\\{[^}]*\\b${name}\\s*=\\s*(?:\\[\\]|\\{\\}|0|""|''|null|false)`,
      );
      if (defaultedDestructure.test(src)) continue;
      const key = `${problem}|${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      issues.push({
        path: "",
        problem: `${problem} (\`${name}\`)`,
        severity: "warn",
        hint,
      });
      if (seen.size >= 6) return issues; // cap noise
    }
  }
  return issues;
}

// ─────────────────────────────────────────────────────────────────────────
// FUNCTIONAL COMPLETENESS SCAN (Phase 8 — anti-stub guard)
// Detects placeholder / unfinished code patterns that pass type-checking but
// leave a component non-functional. Fires WARN-level issues so the agent is
// nudged to flesh them out without blocking the run for false positives.
// ─────────────────────────────────────────────────────────────────────────
const STUB_COMMENT_RE =
  /\/\/\s*(TODO|FIXME|XXX|HACK|PLACEHOLDER|STUB|IMPLEMENT(ATION)?\s+(ME|HERE|GOES\s+HERE)|YOUR\s+CODE\s+HERE|\.\.\.\s*(rest|more|implement))/i;
const STUB_BLOCK_COMMENT_RE =
  /\/\*\s*(TODO|FIXME|PLACEHOLDER|STUB|IMPLEMENT(ATION)?\s+(ME|HERE)|YOUR\s+CODE\s+HERE)/i;

// `onClick={() => {}}` / `onClick={() => null}` / `onSubmit={() => {}}` etc.
// Captures empty arrow handlers wired to interactive props.
const EMPTY_HANDLER_RE =
  /\bon(?:Click|Submit|Change|Input|Press|KeyDown|KeyUp|Focus|Blur|Select|Toggle)\s*=\s*\{\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*(?:\{\s*\}|null|undefined|void\s+0)\s*\}/g;

// `onClick={() => console.log(...)}` — placeholder logging instead of real action.
const CONSOLE_LOG_HANDLER_RE =
  /\bon(?:Click|Submit|Change|Press)\s*=\s*\{\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*console\.(log|warn|info|debug)\s*\(/g;

// `alert("clicked")` / `alert('TODO')` inside a handler — almost always a stub.
const ALERT_STUB_RE = /\balert\s*\(\s*['"`](?:clicked|TODO|placeholder|hello|test)/i;

// `throw new Error("Not implemented")` style.
const NOT_IMPLEMENTED_RE = /throw\s+new\s+Error\s*\(\s*['"`][^'"`]*not\s+implemented/i;

// `function foo(){}` or `const foo = () => {}` at top-level — empty function bodies.
// Skipped when name suggests a memoization helper or noop is intentional.
const EMPTY_NAMED_FN_RE =
  /(?:function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{\s*\}|const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{\s*\})/g;
const NOOP_NAME_RE = /^(noop|no_?op|empty|stub|reset)$/i;

export function scanFunctionalCompleteness(src: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  const push = (problem: string, hint: string, severity: "warn" | "error" = "warn") => {
    if (seen.has(problem)) return;
    seen.add(problem);
    issues.push({ path: "", problem, severity, hint });
  };

  if (STUB_COMMENT_RE.test(src) || STUB_BLOCK_COMMENT_RE.test(src)) {
    push(
      "Placeholder comment detected (TODO / FIXME / 'implement here' / 'your code here')",
      "Replace the placeholder with the real implementation. Stub comments are not allowed in finished code.",
    );
  }

  EMPTY_HANDLER_RE.lastIndex = 0;
  if (EMPTY_HANDLER_RE.test(src)) {
    push(
      "Empty event handler wired to an interactive element (e.g. `onClick={() => {}}`)",
      "Implement the actual handler — update state, call the API, navigate, or open a dialog.",
    );
  }

  CONSOLE_LOG_HANDLER_RE.lastIndex = 0;
  if (CONSOLE_LOG_HANDLER_RE.test(src)) {
    push(
      "Handler only logs to console — no real behaviour",
      "Replace `console.log(...)` with the actual action (state update, mutation, navigation, toast).",
    );
  }

  if (ALERT_STUB_RE.test(src)) {
    push(
      "Placeholder `alert()` call detected",
      "Use a real UI affordance (toast / dialog / state change) and remove the alert stub.",
    );
  }

  if (NOT_IMPLEMENTED_RE.test(src)) {
    push(
      "`throw new Error('Not implemented')` left in the code",
      "Implement the function body. Throwing 'Not implemented' will crash the app at runtime.",
      "error",
    );
  }

  EMPTY_NAMED_FN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = EMPTY_NAMED_FN_RE.exec(src)) !== null) {
    const name = m[1] || m[2];
    if (!name || NOOP_NAME_RE.test(name)) continue;
    push(
      `Empty function body \`${name}\` — looks like an unfinished stub`,
      `Implement \`${name}\` or remove it if unused.`,
    );
    if (seen.size >= 6) break;
  }

  return issues;
}

// ─────────────────────────────────────────────────────────────────────────
// THEME CONSISTENCY SCAN — token drift, gradient drift, dark-mode contrast
// ─────────────────────────────────────────────────────────────────────────
// Generated apps must use semantic Tailwind tokens (text-foreground,
// bg-background, text-muted-foreground, border-border, etc.) so light/dark
// themes work and the design feels cohesive. The agent occasionally drifts
// to hardcoded colors (text-white, bg-gray-100, #ffffff, "rgb(0,0,0)"),
// inconsistent gradient angles, or dark-mode-unfriendly muted text.
// This scan emits WARN issues so the agent fixes them before declaring done.

// Hardcoded Tailwind color utilities — banned in component files.
// Captures: text-white, bg-black, text-gray-500, border-slate-200,
// from-zinc-900, via-neutral-100, to-stone-50, ring-gray-300, etc.
const HARDCODED_COLOR_RE =
  /\b(?:text|bg|border|ring|from|via|to|fill|stroke|divide|placeholder|caret|accent|outline|shadow|decoration)-(?:white|black|gray|slate|zinc|neutral|stone)(?:-\d{2,3})?\b/g;

// Raw hex / rgb / hsl literals inside className/style strings.
const RAW_HEX_RE = /["'`][^"'`\n]*#[0-9a-fA-F]{3,8}\b[^"'`\n]*["'`]/g;
const RAW_RGB_RE = /\b(?:rgb|rgba|hsl|hsla)\s*\(/g;

// Gradient direction tokens — we only flag presence, the prompt enforces
// "all gradients in this app must use the same direction".
const GRADIENT_DIR_RE = /\bbg-gradient-to-(t|tr|r|br|b|bl|l|tl)\b/g;

// Tokens that look readable in light mode but disappear in dark mode.
// `text-gray-400` / `text-slate-500` etc. on a white card → fine.
// On a dark card → invisible. Since we can't statically know the surface,
// we flag any non-semantic muted-color token used on text and recommend
// `text-muted-foreground` which adapts to both themes.
const LIGHT_MUTED_TEXT_RE =
  /\btext-(?:gray|slate|zinc|neutral|stone)-(?:300|400|500)\b/g;

// Files exempt from theme rules (these define the tokens themselves).
function isThemeDefinitionFile(path: string): boolean {
  return (
    /\/(?:index|globals?|app)\.css$/i.test(path) ||
    /tailwind\.config\.(?:ts|js|cjs|mjs)$/i.test(path) ||
    /\/components\/ui\//.test(path) // shadcn primitives use raw tokens internally
  );
}

export function scanThemeConsistency(
  src: string,
  path: string,
): ValidationIssue[] {
  if (isThemeDefinitionFile(path)) return [];
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  const push = (problem: string, hint: string) => {
    if (seen.has(problem)) return;
    seen.add(problem);
    issues.push({ path: "", problem, severity: "warn", hint });
  };

  // 1. Hardcoded Tailwind grayscale / white / black tokens.
  HARDCODED_COLOR_RE.lastIndex = 0;
  const hardcoded = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = HARDCODED_COLOR_RE.exec(src)) !== null) {
    hardcoded.add(m[0]);
    if (hardcoded.size >= 6) break;
  }
  if (hardcoded.size > 0) {
    push(
      `Hardcoded color utilities found: ${[...hardcoded].slice(0, 4).join(", ")}${hardcoded.size > 4 ? "…" : ""}`,
      "Replace with semantic tokens defined in index.css: text-foreground / text-muted-foreground / bg-background / bg-card / bg-muted / border-border / text-primary / text-primary-foreground. Hardcoded grayscale breaks dark mode and theme consistency.",
    );
  }

  // 2. Raw hex / rgb / hsl literals (ignored inside .css files).
  RAW_HEX_RE.lastIndex = 0;
  if (RAW_HEX_RE.test(src)) {
    push(
      "Raw hex color literal in className/style (e.g. `#ffffff`, `#1a1a1a`)",
      "Move the color to index.css as an HSL CSS variable (e.g. `--brand: 220 90% 56%;`), then reference via a Tailwind token. Hardcoded hex values can't follow the theme.",
    );
  }
  RAW_RGB_RE.lastIndex = 0;
  if (RAW_RGB_RE.test(src) && !/from\s+["'`][^"'`]*["'`]/.test(src)) {
    push(
      "Raw rgb()/rgba()/hsl() literal in component code",
      "Use a semantic token (`hsl(var(--accent))`) or a Tailwind opacity utility. Inline color literals defeat the design system.",
    );
  }

  // 3. Gradient direction inventory — flag if file mixes >1 direction.
  GRADIENT_DIR_RE.lastIndex = 0;
  const dirs = new Set<string>();
  while ((m = GRADIENT_DIR_RE.exec(src)) !== null) dirs.add(m[1]);
  if (dirs.size > 1) {
    push(
      `Multiple gradient directions in one file: ${[...dirs].map((d) => "to-" + d).join(", ")}`,
      "Pick ONE gradient direction for the whole app (recommend `bg-gradient-to-br` for hero/cards). Mixing directions breaks visual consistency across pages.",
    );
  }

  // 4. Dark-mode-unfriendly muted text.
  LIGHT_MUTED_TEXT_RE.lastIndex = 0;
  const muted = new Set<string>();
  while ((m = LIGHT_MUTED_TEXT_RE.exec(src)) !== null) muted.add(m[0]);
  if (muted.size > 0) {
    push(
      `Low-contrast muted text token(s): ${[...muted].slice(0, 3).join(", ")}`,
      "Replace with `text-muted-foreground` so the contrast adapts to both themes. Raw `text-gray-400` is unreadable on dark surfaces.",
    );
  }

  return issues;
}

// ── Mobile layout safety scan ────────────────────────────────────────────
// Catches the most reported "looks broken on phone" failure modes that
// purely structural validators miss:
//   1. `h-screen` / `min-h-screen` (CSS `100vh`) on the root — Safari address
//      bar bug crops the bottom on real devices.
//   2. A fixed / sticky bottom nav present in the file but the scrollable
//      <main> ancestor has NO bottom padding (`pb-…`) → last item gets hidden
//      under the nav and the user reports "text overlapping the nav".
//   3. Bottom nav with a TRANSPARENT background (`bg-transparent`, `bg-card/0`)
//      → scrolling content shows through the nav and labels merge.
//   4. Bottom nav with NO `border-t` + no opaque background → same problem.
const VH_ROOT_RE = /\b(?:min-)?h-screen\b(?![-/])/g;
const VH_LITERAL_RE = /\b(?:min-)?h-\[100vh\]/g;
const FIXED_BOTTOM_RE = /\b(?:fixed|sticky)\b[^"'`]*\bbottom-0\b/;
const BOTTOM_NAV_HINT_RE =
  /\b(BottomNav|TabBar|MobileNav|NavBar|BottomTab|Footer\s*Nav)\b|<\s*nav\b[^>]*\bbottom-0\b/i;
const PB_NAV_OK_RE =
  /\bpb-(?:24|28|32|36|40|44|48|\[(?:[6-9]\d|\d{3,})px\]|\[calc\([^)]*64px[^)]*\)\])/;
const TRANSPARENT_NAV_RE = /\bbg-(?:transparent|background\/0|card\/0|white\/0|black\/0)\b/;
const OPAQUE_NAV_RE =
  /\bbg-(?:background|card|popover|muted|primary|secondary)(?:\/(?:8\d|9\d|100))?\b|backdrop-blur/;

export function scanMobileLayout(
  src: string,
  path: string,
): ValidationIssue[] {
  if (isThemeDefinitionFile(path)) return [];
  // Only run on .tsx/.jsx — CSS / config has different conventions.
  if (!/\.(tsx|jsx)$/.test(path)) return [];

  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  const push = (problem: string, hint: string, severity: "warn" | "error" = "warn") => {
    if (seen.has(problem)) return;
    seen.add(problem);
    issues.push({ path: "", problem, severity, hint });
  };

  // Only flag root-shell files — App.tsx, MainLayout.tsx, RootLayout, Layout.
  const isRootShell = /\b(App|RootLayout|MainLayout|Shell|AppShell|Layout)\.(tsx|jsx)$/.test(path);

  // 1. 100vh on root shell.
  if (isRootShell) {
    if (VH_ROOT_RE.test(src) || VH_LITERAL_RE.test(src)) {
      push(
        "Root shell uses `h-screen` / `100vh` — Safari address-bar crops the bottom on real phones",
        "Use `min-h-[100dvh]` (dynamic viewport) instead. Apply `flex flex-col` on the root and let the main content scroll inside `flex-1 overflow-y-auto`.",
      );
    }
  }

  // 2. Bottom nav present + no bottom padding on any scrollable region.
  const hasBottomNavMarkup = FIXED_BOTTOM_RE.test(src) || BOTTOM_NAV_HINT_RE.test(src);
  if (hasBottomNavMarkup) {
    const usesPadding = PB_NAV_OK_RE.test(src) || /env\(safe-area-inset-bottom\)/.test(src);
    // Only flag in files that ALSO render scrollable content (a list, main, ScrollArea, overflow-auto).
    const hasScrollSurface = /\b(overflow-y-auto|overflow-auto|overflow-scroll|ScrollArea)\b|<\s*main\b/i.test(src);
    if (hasScrollSurface && !usesPadding) {
      push(
        "Bottom nav present but the scrollable content has no bottom padding — last items will hide under the nav",
        "Add `pb-[calc(64px+env(safe-area-inset-bottom)+16px)]` (or a similar pb-32+) to the scrollable container, OR a `<div className='h-24' />` spacer at the end of the scroll list. Without this, content text visually merges with the nav labels.",
      );
    }

    // 3 + 4. Transparent / no-background bottom nav.
    // We can only judge if the file IS the nav (vs. consumes one). Heuristic:
    // file path matches BottomNav/TabBar/MobileNav OR contains a `<nav … bottom-0>`.
    const looksLikeNavFile =
      /BottomNav|TabBar|MobileNav|BottomTab/.test(path) ||
      /<\s*nav\b[^>]*\bbottom-0\b/.test(src);
    if (looksLikeNavFile) {
      if (TRANSPARENT_NAV_RE.test(src)) {
        push(
          "Bottom nav uses a transparent background — scrolling content bleeds through and labels merge with content",
          "Use `bg-background/90 backdrop-blur-xl border-t border-border` (or `bg-card`) so the nav is opaque-ish. NEVER fully transparent.",
        );
      } else if (!OPAQUE_NAV_RE.test(src)) {
        push(
          "Bottom nav has no opaque background or backdrop-blur — content beneath will show through",
          "Add `bg-background/90 backdrop-blur-xl border-t border-border` to the nav root so it has a visible surface against scrolling content.",
        );
      }
    }
  }

  return issues;
}
// `export class/interface/type/enum X`, `export { X }`, `export default ... X`.

// ── Export / import statement parsers (used by checks + autofix) ──────────
export function fileExports(src: string): { named: Set<string>; hasDefault: boolean } {
  const named = new Set<string>();
  let hasDefault = false;
  const namedRe = /export\s+(?:(?:declare\s+)?(?:const|let|var|function|class|interface|type|enum))\s+([A-Za-z_$][\w$]*)/g;
  let m: RegExpExecArray | null;
  while ((m = namedRe.exec(src)) !== null) named.add(m[1]);
  const reExportRe = /export\s*\{([^}]+)\}/g;
  while ((m = reExportRe.exec(src)) !== null) {
    for (const part of m[1].split(",")) {
      const trimmed = part.trim().split(/\s+as\s+/i).pop()?.trim();
      if (trimmed && /^[A-Za-z_$][\w$]*$/.test(trimmed)) named.add(trimmed);
    }
  }
  if (/export\s+default\s/.test(src)) hasDefault = true;
  return { named, hasDefault };
}

export function parseImportNames(stmt: string): { default?: string; named: string[] } {
  const out: { default?: string; named: string[] } = { named: [] };
  // import Foo from '...'
  const def = stmt.match(/^\s*([A-Za-z_$][\w$]*)\s*(?:,|from)/);
  if (def) out.default = def[1];
  // import { A, B as C } from '...'
  const named = stmt.match(/\{([^}]+)\}/);
  if (named) {
    for (const part of named[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/i)[0].trim();
      if (name && /^[A-Za-z_$][\w$]*$/.test(name)) out.named.push(name);
    }
  }
  return out;
}
