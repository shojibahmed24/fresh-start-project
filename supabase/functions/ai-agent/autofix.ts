// ═══════════════════════════════════════════════════════════════════════════
// AUTO-FIX ENGINE
// ───────────────────────────────────────────────────────────────────────────
// Deterministic patcher run after every write batch. Fixes the most common
// failure modes the LLM produces:
//   • missing lucide-react icon imports
//   • missing React named exports (useState, useEffect, etc.)
//   • @/ alias paths → relative paths
//   • missing default export on component files
//
// All helpers are pure transforms over (path, content) → AutoFix. The
// orchestrator autoFixBatch applies them across a project snapshot.
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolContext, AutoFix } from "./types.ts";
import {
  extractImports,
  stripStringsAndComments,
  normalizePath,
  resolveRelativeImport,
  parseImportNames,
  fileExports,
  requiresDefaultExport,
  isComponentFile,
} from "./validation/parsers.ts";
import { validateFile } from "./validation/checks.ts";
import { ALLOWED_BARE_PACKAGES } from "./validation/parsers.ts";

// Known-good versions for whitelisted bare packages. Used when the model
// imports a package (e.g. `react-router-dom`) that isn't yet listed in
// package.json — we auto-insert it so Vite can resolve it instead of crashing
// with "Could not find dependency".
export const PACKAGE_VERSIONS: Record<string, string> = {
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

export const LUCIDE_ICONS = new Set<string>([
  "Activity","AlertCircle","AlertTriangle","AlignCenter","AlignJustify","AlignLeft","AlignRight",
  "Anchor","Aperture","Archive","ArrowDown","ArrowDownCircle","ArrowDownLeft","ArrowDownRight",
  "ArrowLeft","ArrowLeftCircle","ArrowRight","ArrowRightCircle","ArrowUp","ArrowUpCircle",
  "ArrowUpLeft","ArrowUpRight","AtSign","Award","BarChart","BarChart2","BarChart3","Battery",
  "BatteryCharging","Bell","BellOff","BellRing","Bike","Bluetooth","Bold","Book","BookOpen",
  "Bookmark","Box","Briefcase","Brush","Bug","Building","Building2","Bus","Cake","Calculator",
  "Calendar","CalendarDays","Camera","CameraOff","Car","Cast","Check","CheckCheck","CheckCircle",
  "CheckCircle2","CheckSquare","ChefHat","ChevronDown","ChevronLeft","ChevronRight","ChevronUp",
  "ChevronsDown","ChevronsLeft","ChevronsRight","ChevronsUp","Chrome","Circle","Clipboard",
  "ClipboardCheck","ClipboardCopy","ClipboardList","Clock","Cloud","CloudDrizzle","CloudLightning",
  "CloudOff","CloudRain","CloudSnow","Code","Code2","Coffee","Coins","Columns","Command",
  "Compass","Contact","Copy","Copyright","CornerDownLeft","CornerDownRight","CornerUpLeft",
  "CornerUpRight","CreditCard","Crop","Cross","Crosshair","Crown","Cube","Database","Delete",
  "Diamond","Disc","DollarSign","Download","Droplet","Droplets","Dumbbell","Edit","Edit2","Edit3",
  "Egg","ExternalLink","Eye","EyeOff","Facebook","Factory","Fan","FastForward","Feather","File",
  "FileCheck","FileCode","FileImage","FilePlus","FileText","Files","Film","Filter","Fingerprint",
  "Flag","Flame","Flashlight","FlipHorizontal","FlipVertical","Folder","FolderOpen","FolderPlus",
  "Footprints","Forward","Frame","Frown","Gamepad","Gamepad2","Gauge","Gem","Gift","Github",
  "Globe","Globe2","GraduationCap","Grid","Grid3x3","Hammer","Hand","HardDrive","Hash","Headphones",
  "Heart","HeartOff","HelpCircle","Hexagon","History","Home","Hourglass","IceCream","Image",
  "ImageOff","ImagePlus","Inbox","Info","Instagram","Italic","Joystick","Key","Keyboard","Lamp",
  "Landmark","Languages","Laptop","Laugh","Layers","Layout","LayoutDashboard","LayoutGrid",
  "LayoutList","Leaf","LifeBuoy","Lightbulb","Link","Link2","Linkedin","List","ListChecks",
  "ListOrdered","Loader","Loader2","Lock","LogIn","LogOut","Mail","MailCheck","MailOpen","MailPlus",
  "Map","MapPin","Maximize","Maximize2","Medal","Megaphone","Menu","MessageCircle","MessageSquare",
  "Mic","MicOff","Minimize","Minimize2","Minus","MinusCircle","MinusSquare","Monitor","Moon",
  "MoreHorizontal","MoreVertical","Mountain","Mouse","Move","Music","Music2","Navigation","Network",
  "Newspaper","Notebook","Octagon","Package","Package2","PackageCheck","PackageOpen","Palette",
  "Paperclip","Pause","PauseCircle","PenLine","PenTool","Pencil","Percent","Phone","PhoneCall",
  "PhoneOff","PieChart","Pin","PinOff","Plane","Play","PlayCircle","Plug","Plus","PlusCircle",
  "PlusSquare","Pocket","Podcast","Power","Printer","Puzzle","QrCode","Quote","Radio","Receipt",
  "Recycle","RefreshCcw","RefreshCw","Repeat","Reply","Rewind","Rocket","Rss","Ruler","Save",
  "Scale","Scan","ScanLine","School","Scissors","Screen","ScreenShare","Search","Send","Server",
  "Settings","Settings2","Share","Share2","Shield","ShieldAlert","ShieldCheck","ShieldOff",
  "Ship","Shirt","ShoppingBag","ShoppingCart","Shovel","Shuffle","Sidebar","Sigma","Signal",
  "Siren","SkipBack","SkipForward","Slack","Slash","Sliders","SlidersHorizontal","Smartphone",
  "Smile","Snowflake","Sofa","Soup","Speaker","Sparkles","Speech","Spline","Split","Square",
  "Star","StarHalf","StarOff","StepBack","StepForward","Stethoscope","Sticker","StickyNote",
  "StopCircle","Store","Sun","Sunrise","Sunset","Table","Tablet","Tag","Tags","Target","Tent",
  "Terminal","ThermometerSun","ThumbsDown","ThumbsUp","Ticket","Timer","ToggleLeft","ToggleRight",
  "Tool","ToyBrick","Train","Trash","Trash2","TreePine","TrendingDown","TrendingUp","Triangle",
  "Trophy","Truck","Tv","Twitch","Twitter","Type","Umbrella","Underline","Undo","Undo2","Unlock",
  "Upload","UploadCloud","User","UserCheck","UserCircle","UserMinus","UserPlus","UserX","Users",
  "Utensils","Variable","Verified","Vibrate","Video","VideoOff","View","Voicemail","Volume",
  "Volume1","Volume2","VolumeX","Wallet","Wand","Wand2","Watch","Waves","Webcam","Wifi","WifiOff",
  "Wind","Wine","Workflow","Wrench","X","XCircle","XOctagon","XSquare","Youtube","Zap","ZapOff",
  "ZoomIn","ZoomOut",
]);

// React hooks/named exports we can auto-import. Order matters for de-dup.
export const REACT_NAMED = new Set<string>([
  "useState","useEffect","useRef","useMemo","useCallback","useReducer","useContext","useId",
  "useLayoutEffect","useTransition","useDeferredValue","useSyncExternalStore",
  "Fragment","createContext","forwardRef","memo","lazy","Suspense","Children","cloneElement",
]);

// Match identifiers used in JSX as components <Foo …> or <Foo/> or <Foo>
export function findUsedComponentIdents(src: string): Set<string> {
  const out = new Set<string>();
  const re = /<([A-Z][A-Za-z0-9_]*)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.add(m[1]);
  return out;
}

// Match identifiers referenced as bare calls/values: `useState(`, `Fragment`,
// destructured uses, etc. We only need a coarse scan — false positives are
// harmless because we only auto-import names from a closed whitelist.
export function findUsedBareIdents(src: string): Set<string> {
  const out = new Set<string>();
  const re = /\b([A-Za-z_][A-Za-z0-9_]*)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.add(m[1]);
  return out;
}

// Parse an entire file's import map: module spec → { default?, named:Set }
export function parseImportMap(src: string): Map<string, { default?: string; named: Set<string>; raw: string }> {
  const map = new Map<string, { default?: string; named: Set<string>; raw: string }>();
  const re = /(?:^|\n)\s*import\s+([^'"`\n]+?)\s+from\s*['"]([^'"]+)['"];?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const clause = m[1].trim();
    const spec = m[2];
    const entry = map.get(spec) ?? { named: new Set<string>(), raw: m[0] };
    // default import: `Foo` or `Foo, { a, b }`
    const defMatch = clause.match(/^([A-Za-z_$][\w$]*)\s*(?:,|$)/);
    if (defMatch && !clause.startsWith("{")) entry.default = defMatch[1];
    // named imports
    const namedBlock = clause.match(/\{([^}]+)\}/);
    if (namedBlock) {
      for (const part of namedBlock[1].split(",")) {
        const name = part.trim().split(/\s+as\s+/)[0].trim();
        if (name) entry.named.add(name);
      }
    }
    map.set(spec, entry);
  }
  return map;
}

// Insert/upsert imports at the top of the file (after any existing imports).
export function upsertImport(src: string, spec: string, names: string[], asDefault: string | null = null): string {
  const importMap = parseImportMap(src);
  const existing = importMap.get(spec);
  const wantNamed = new Set(names);
  if (existing) {
    // Merge — only rewrite if there's something new
    const newNamed = [...existing.named, ...wantNamed].filter((v, i, a) => a.indexOf(v) === i).sort();
    const sameNamed = newNamed.length === existing.named.size;
    const sameDefault = (asDefault ?? existing.default) === existing.default;
    if (sameNamed && sameDefault) return src;
    const def = asDefault ?? existing.default;
    const namedPart = newNamed.length ? `{ ${newNamed.join(", ")} }` : "";
    const clause = [def, namedPart].filter(Boolean).join(", ");
    const newLine = `import ${clause} from "${spec}";`;
    return src.replace(existing.raw, "\n" + newLine);
  }
  // Insert a fresh import after the last existing import line, or at the top.
  const lastImportRe = /(^|\n)\s*import\s[^\n]*\n/g;
  let lastEnd = 0;
  let m: RegExpExecArray | null;
  while ((m = lastImportRe.exec(src)) !== null) lastEnd = m.index + m[0].length;
  const namedPart = names.length ? `{ ${names.sort().join(", ")} }` : "";
  const clause = [asDefault, namedPart].filter(Boolean).join(", ");
  const line = `import ${clause} from "${spec}";\n`;
  if (lastEnd > 0) return src.slice(0, lastEnd) + line + src.slice(lastEnd);
  return line + src;
}

// Resolve `@/foo/bar` to relative path from `fromPath`, given allPaths.
export function resolveAliasToRelative(fromPath: string, alias: string, allPaths: Set<string>): string | null {
  // alias like "@/components/Foo" → try "/src/components/Foo(.tsx|.ts|...)"
  const sub = alias.replace(/^@\//, "");
  const bases = ["/src/" + sub, "/" + sub];
  for (const b of bases) {
    const candidates = [b, b + ".ts", b + ".tsx", b + ".js", b + ".jsx", b + "/index.ts", b + "/index.tsx"];
    for (const c of candidates) {
      if (allPaths.has(c)) {
        const fromDir = fromPath.replace(/\/[^/]*$/, "");
        let rel = relativizePath(fromDir, b);
        if (!rel.startsWith(".")) rel = "./" + rel;
        return rel;
      }
    }
  }
  return null;
}

export function relativizePath(fromDir: string, toAbs: string): string {
  const f = fromDir.replace(/^\//, "").split("/").filter(Boolean);
  const t = toAbs.replace(/^\//, "").split("/").filter(Boolean);
  let i = 0;
  while (i < f.length && i < t.length && f[i] === t[i]) i++;
  const ups = f.slice(i).map(() => "..");
  const downs = t.slice(i);
  return [...ups, ...downs].join("/") || ".";
}

// Best-effort default-export inference. Looks for `function Name() {…}` or
// `const Name = …` whose name matches the file basename (PascalCase).
export function inferDefaultExportIdent(path: string, src: string): string | null {
  const base = (path.split("/").pop() || "").replace(/\.(tsx?|jsx?)$/, "");
  if (!/^[A-Z][A-Za-z0-9_]*$/.test(base)) return null;
  const re = new RegExp(`(?:function|const|class)\\s+${base}\\b`);
  if (re.test(src)) return base;
  return null;
}

// (AutoFix moved to ./types.ts)

export function autoFixFile(
  path: string,
  content: string,
  allPaths: Set<string>,
): { content: string; fixes: AutoFix[] } {
  const fixes: AutoFix[] = [];
  if (!/\.(tsx?|jsx?)$/.test(path)) return { content, fixes };

  let src = content;

  // 1. Remove obvious truncation markers ("// ... rest of file" etc.).
  const junkRe = /^\s*\/\/\s*\.\.\.\s*(rest of file|keep existing|unchanged).*$/gim;
  if (junkRe.test(src)) {
    src = src.replace(junkRe, "");
    fixes.push({ path, fix: "Removed truncation placeholder comment" });
  }

  // 2. Rewrite `@/foo/bar` alias imports to relative paths. The live preview
  //    sandbox (Sandpack/CodeSandbox) does NOT honor vite.config.ts /
  //    tsconfig path aliases — it resolves modules with raw Node-style
  //    resolution. So `@/components/X` shows as "Could not find module
  //    '@/components/X'" in preview even though APK builds (which use the
  //    real Vite scaffold) work fine. Rewriting to relative makes BOTH
  //    environments resolve identically.
  {
    const aliasRe = /(import\s[^'"]*?from\s*['"]|import\s*['"])(@\/[^'"]+)(['"])/g;
    let aliasFixed = 0;
    src = src.replace(aliasRe, (_m, pre, spec, post) => {
      const rel = resolveAliasToRelative(normalizePath(path), spec, allPaths);
      if (!rel) return _m;
      aliasFixed++;
      return `${pre}${rel}${post}`;
    });
    if (aliasFixed > 0) {
      fixes.push({ path, fix: `Rewrote ${aliasFixed} \`@/\` alias import(s) to relative paths (preview compatibility)` });
    }
  }

  // 3. Resolve lucide-react identifier collisions. Common bug: the model
  //    writes `import { User } from 'lucide-react'` AND `import type { User }
  //    from './types'` (or declares `interface User`, `const User`, etc.).
  //    The duplicate binding crashes the Sandpack/CodeSandbox preview with
  //    cryptic errors like `"message" is read-only` / `"User" is read-only`.
  //    Fix: alias the lucide icon to `<Name>Icon` and rewrite JSX usages.
  {
    const lucideEntry = parseImportMap(src).get("lucide-react");
    if (lucideEntry && lucideEntry.named.size > 0) {
      const otherBindings = new Set<string>();
      for (const [spec, entry] of parseImportMap(src)) {
        if (spec === "lucide-react") continue;
        for (const n of entry.named) otherBindings.add(n);
        if (entry.default) otherBindings.add(entry.default);
      }
      const declRe = /\b(?:interface|type|class|const|let|var|function|enum)\s+([A-Z][A-Za-z0-9_]*)\b/g;
      let dm: RegExpExecArray | null;
      const stripped = stripStringsAndComments(src);
      while ((dm = declRe.exec(stripped)) !== null) otherBindings.add(dm[1]);

      const collisions: string[] = [];
      for (const name of lucideEntry.named) {
        if (otherBindings.has(name)) collisions.push(name);
      }

      if (collisions.length > 0) {
        const newNamed: string[] = [];
        for (const n of lucideEntry.named) {
          newNamed.push(collisions.includes(n) ? `${n} as ${n}Icon` : n);
        }
        const newImport = `import { ${newNamed.sort().join(", ")} } from "lucide-react";`;
        src = src.replace(lucideEntry.raw, "\n" + newImport);

        for (const name of collisions) {
          const tagRe = new RegExp(`(<\\/?)${name}(\\b)`, "g");
          src = src.replace(tagRe, `$1${name}Icon$2`);
        }
        fixes.push({
          path,
          fix: `Aliased colliding lucide icon(s) to <Name>Icon: ${collisions.join(", ")} (avoids "X is read-only" preview crash)`,
        });
      }
    }
  }

  // 4. Auto-add missing imports (lucide-react icons + React named exports).
  const importMap = parseImportMap(src);
  const lucideExisting = importMap.get("lucide-react")?.named ?? new Set<string>();
  const reactExisting = importMap.get("react")?.named ?? new Set<string>();

  const usedComponents = findUsedComponentIdents(src);
  const usedBare = findUsedBareIdents(src);

  // Lucide icons used in JSX but not imported.
  const missingLucide: string[] = [];
  for (const ident of usedComponents) {
    if (LUCIDE_ICONS.has(ident) && !lucideExisting.has(ident)) {
      // Make sure it's not coming from another import line.
      let importedElsewhere = false;
      for (const [spec, entry] of importMap) {
        if (spec === "lucide-react") continue;
        if (entry.named.has(ident) || entry.default === ident) { importedElsewhere = true; break; }
      }
      if (!importedElsewhere) missingLucide.push(ident);
    }
  }
  if (missingLucide.length > 0) {
    src = upsertImport(src, "lucide-react", missingLucide);
    fixes.push({ path, fix: `Auto-imported lucide-react: ${missingLucide.join(", ")}` });
  }

  // React hooks/named exports used but not imported.
  const missingReact: string[] = [];
  for (const ident of usedBare) {
    if (REACT_NAMED.has(ident) && !reactExisting.has(ident)) {
      let importedElsewhere = false;
      for (const [spec, entry] of importMap) {
        if (spec === "react") continue;
        if (entry.named.has(ident)) { importedElsewhere = true; break; }
      }
      if (!importedElsewhere) missingReact.push(ident);
    }
  }
  if (missingReact.length > 0) {
    src = upsertImport(src, "react", missingReact);
    fixes.push({ path, fix: `Auto-imported react: ${missingReact.join(", ")}` });
  }

  // 5. Add missing default export if the file requires one and we can infer
  //    a clear identifier.
  if (requiresDefaultExport(path) && !/export\s+default\s/.test(stripStringsAndComments(src))) {
    const ident = inferDefaultExportIdent(path, src);
    if (ident) {
      src = src.trimEnd() + `\n\nexport default ${ident};\n`;
      fixes.push({ path, fix: `Appended \`export default ${ident};\`` });
    }
  }

  return { content: src, fixes };
}

// Run auto-fix across a batch of files, persisting any changes back to
// project_files. Returns the list of human-readable fixes applied.
export async function autoFixBatch(
  ctx: ToolContext,
  paths: string[],
): Promise<{ fixes: AutoFix[]; changedPaths: string[] }> {
  if (paths.length === 0) return { fixes: [], changedPaths: [] };
  const { data, error } = await ctx.supabase
    .from("project_files")
    .select("path, content")
    .eq("project_id", ctx.projectId);
  if (error || !data) return { fixes: [], changedPaths: [] };

  const rows = data as { path: string; content: string }[];
  const allPaths = new Set(rows.map((r) => normalizePath(r.path)));
  const targetSet = new Set(paths.map((p) => normalizePath(p)));

  const allFixes: AutoFix[] = [];
  const changedPaths: string[] = [];
  const updates: { project_id: string; user_id: string; path: string; content: string; updated_at: string }[] = [];
  const now = new Date().toISOString();

  for (const row of rows) {
    if (!targetSet.has(normalizePath(row.path))) continue;
    const { content: fixed, fixes } = autoFixFile(row.path, row.content, allPaths);
    if (fixed !== row.content && fixes.length > 0) {
      updates.push({
        project_id: ctx.projectId,
        user_id: ctx.userId,
        path: row.path,
        content: fixed,
        updated_at: now,
      });
      changedPaths.push(row.path);
      allFixes.push(...fixes);
      ctx.readCache.set(normalizePath(row.path), { result: { path: row.path, content: fixed }, reads: 0, mutatedSinceLastRead: true });
    }
  }

  if (updates.length > 0) {
    await ctx.supabase.from("project_files").upsert(updates, { onConflict: "project_id,path" });
    for (const u of updates) {
      ctx.filesChanged.push({ path: u.path, action: "updated" });
    }
  }

  // ── package.json sync ────────────────────────────────────────────────
  // Scan every project file for bare imports and ensure each whitelisted
  // package is listed in package.json. Prevents Vite "Could not find
  // dependency" crashes when the model imports react-router-dom / zustand
  // / etc. without remembering to add it to package.json.
  try {
    const pkgRow = rows.find((r) => normalizePath(r.path) === "/package.json");
    if (pkgRow) {
      let pkg: any;
      try { pkg = JSON.parse(pkgRow.content); } catch { pkg = null; }
      if (pkg && typeof pkg === "object") {
        pkg.dependencies = pkg.dependencies || {};
        const used = new Set<string>();
        for (const r of rows) {
          if (!/\.(tsx?|jsx?)$/.test(r.path)) continue;
          // include freshly written content from this batch
          const content = updates.find((u) => u.path === r.path)?.content ?? r.content;
          for (const spec of extractImports(content)) {
            if (spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("@/")) continue;
            // Bare module: take the package root (handles scoped pkgs).
            const root = spec.startsWith("@")
              ? spec.split("/").slice(0, 2).join("/")
              : spec.split("/")[0];
            used.add(root);
          }
        }
        let added = false;
        const addedPkgs: string[] = [];
        for (const name of used) {
          // Skip Node built-ins / virtual modules — Vite handles these.
          if (name.startsWith("node:") || name === "fs" || name === "path" || name === "url" || name === "crypto") continue;
          if (pkg.dependencies[name] || pkg.devDependencies?.[name]) continue;
          // Always add — was previously gated on the whitelist, which meant
          // the model importing any "unknown" package (legitimate or hallucinated)
          // produced a Vite "Could not find dependency" crash → heal loop.
          // Now: add with known-good version if we have one, else "latest".
          // The validator still warns on truly hallucinated names so the
          // model can self-correct; but the build never crashes on a missing
          // dep entry.
          pkg.dependencies[name] = PACKAGE_VERSIONS[name] ?? "latest";
          added = true;
          addedPkgs.push(name);
        }
        if (added) {
          const newContent = JSON.stringify(pkg, null, 2) + "\n";
          await ctx.supabase.from("project_files").upsert({
            project_id: ctx.projectId,
            user_id: ctx.userId,
            path: "/package.json",
            content: newContent,
            updated_at: now,
          }, { onConflict: "project_id,path" });
          ctx.filesChanged.push({ path: "/package.json", action: "updated" });
          ctx.readCache.set("/package.json", { result: { path: "/package.json", content: newContent }, reads: 0, mutatedSinceLastRead: true });
          allFixes.push({ path: "/package.json", fix: `Added missing deps to package.json: ${addedPkgs.join(", ")}` });
          changedPaths.push("/package.json");
        }
      }
    }
  } catch (_e) { /* best-effort */ }

  return { fixes: allFixes, changedPaths };
}

// ═══════════════════════════════════════════════════════════════════════════
// QUALITY GATES ENGINE (Phase 10)
// ───────────────────────────────────────────────────────────────────────────
// Deterministic, in-engine quality checks that mirror what `eslint`, `tsc`,
// `vitest`, `axe-core`, and a security audit would flag — but executed inside
// the Deno edge function (no shell, no Node, no install). The agent calls
// `run_quality_gates` to get a single PASS/FAIL verdict across all gates,
// or individual `code_quality_lint` / `accessibility_scan` / `security_audit`
// / `run_tests` tools to drill into one gate.
// ═══════════════════════════════════════════════════════════════════════════

// (GateFinding moved to ./types.ts)

// (GateResult moved to ./types.ts)

