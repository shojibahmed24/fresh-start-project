import { forwardRef, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { RefreshCw, Smartphone, Monitor, ExternalLink, Terminal, Share2, Check, AlertTriangle, Loader2, Eye, X, RotateCw, Sun, Moon, Tablet, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  SandpackProvider,
  SandpackPreview,
  SandpackLayout,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { haptic } from "@/lib/haptics";
import type { ProjectFile } from "@/lib/store";
import {
  runVisualReview,
  registerPreviewElement,
  setPreviewReady,
  recordPreviewConsoleError,
  type VisualIssue,
} from "@/lib/visualReview";
import { DeviceFrame, DEVICE_SPECS, type DeviceId, type Orientation, type ColorScheme } from "./DeviceFrame";

// Simplified Sandpack-powered preview. Sandpack handles the bundler,
// JSX/TS transform, module resolution, and runtime — so we don't have to
// keep patching a hand-rolled Babel runtime.

const DEFAULT_APP = `export default function App() {
  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,background:'linear-gradient(180deg,#1a0a18,#0a0510)',color:'#fff',textAlign:'center',fontFamily:'-apple-system,sans-serif'}}>
      <div style={{fontSize:48,marginBottom:16}}>📱</div>
      <h1 style={{margin:0,fontSize:20}}>Ready to build</h1>
      <p style={{opacity:0.6,fontSize:13,marginTop:8}}>Generate an app from chat to see it live.</p>
    </div>
  );
}`;

const TAILWIND_INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      *,*::before,*::after{box-sizing:border-box}
      html,body,#root{width:100%;height:100%;min-height:100%;margin:0;padding:0}
      body{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,sans-serif;background:#000;color:#fff;-webkit-font-smoothing:antialiased;overflow:hidden}
      #root{display:flex;flex-direction:column;overflow:hidden}
    </style>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

const PREVIEW_RESET_CSS = `
*,*::before,*::after{box-sizing:border-box}
html,body,#root{width:100%;height:100%;min-height:100%;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,sans-serif;background:#000;color:#fff;-webkit-font-smoothing:antialiased;overflow:hidden}
#root{display:flex;flex-direction:column;overflow:hidden}
#preview-viewport{
  position:relative;
  width:100%;
  height:100%;
  min-height:100%;
  display:flex;
  flex-direction:column;
  overflow:hidden;
  background:#000;
  padding-top:env(safe-area-inset-top, 24px);
  padding-bottom:env(safe-area-inset-bottom, 8px);
}
#preview-viewport > *{
  flex:1 1 auto !important;
  width:100% !important;
  min-height:0 !important;
  height:100% !important;
  display:flex;
  flex-direction:column;
}
/* Neutralize fixed viewport units inside the phone frame so apps fit the
   actual preview height instead of the desktop window height. */
#preview-viewport .h-screen{height:100% !important}
#preview-viewport .min-h-screen{min-height:100% !important}
#preview-viewport .w-screen{width:100% !important}
button,input,textarea,select{font:inherit}
`;

const BROWSER_PREVIEW_HTML = `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
    <script src="https://cdn.tailwindcss.com"></script>
    <style>${PREVIEW_RESET_CSS}</style>
  </head>
  <body>
    <div id="preview-viewport">
      <iframe
        title="Live app preview"
        src="about:blank"
        style="width:100%;height:100%;border:0;background:#000;display:block;"
      ></iframe>
    </div>
  </body>
</html>`;

const ENTRY_INDEX = `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./src/App";
import "./src/preview-reset.css";

const ensureTailwind = () =>
  new Promise<void>((resolve) => {
    if ((window as any).tailwind) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[src="https://cdn.tailwindcss.com"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => resolve(), { once: true });
      setTimeout(() => resolve(), 1200);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.tailwindcss.com";
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
    setTimeout(() => resolve(), 1200);
  });

const container = document.getElementById("root");
if (container) {
  ensureTailwind().finally(() => {
    createRoot(container).render(
      <div id="preview-viewport">
        <App />
      </div>
    );
  });
}
`;

type View = "phone" | "desktop";

function normalizePath(path: string): string {
  let next = path.startsWith("/") ? path : `/${path}`;
  if (!next.startsWith("/src/") && !next.startsWith("/public/") && next !== "/index.html") {
    next = `/src${next}`;
  }
  return next.replace(/\/+/g, "/");
}

function buildSandpackFiles(files: ProjectFile[]): Record<string, { code: string }> {
  const map: Record<string, { code: string }> = {};
  for (const file of files) {
    map[normalizePath(file.path)] = { code: file.content };
  }
  // Always provide a working App if the AI hasn't written one yet.
  if (!map["/src/App.tsx"] && !map["/src/App.jsx"] && !map["/src/App.ts"] && !map["/src/App.js"]) {
    map["/src/App.tsx"] = { code: DEFAULT_APP };
  }
  // Sandpack's react-ts template uses a root entry file, not /src/index.tsx.
  map["/index.tsx"] = { code: ENTRY_INDEX };
  map["/src/preview-reset.css"] = { code: PREVIEW_RESET_CSS };
  // Inject Tailwind CDN via a custom index.html so generated apps using
  // Tailwind classes look right out-of-the-box.
  map["/public/index.html"] = { code: TAILWIND_INDEX_HTML };
  return map;
}

function formatConsoleArg(arg: unknown): string {
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  if (typeof arg === "string") return arg;
  if (!arg || typeof arg !== "object") return String(arg);
  const value = arg as Record<string, unknown>;
  const ctor = value.constructor?.name ?? "Object";
  const isBrowserEvent = /Event$/.test(ctor) || ("type" in value && ("target" in value || "currentTarget" in value));
  if (isBrowserEvent) {
    const type = typeof value.type === "string" ? value.type : "event";
    const message = typeof value.message === "string" ? ` ${value.message}` : "";
    return `[${ctor}:${type}]${message}`;
  }
  try {
    return JSON.stringify(arg);
  } catch {
    return `[${ctor}]`;
  }
}

function sanitizeConsoleArg(arg: unknown): unknown {
  if (!arg || typeof arg !== "object") return arg;
  const value = arg as Record<string, unknown>;
  const ctor = value.constructor?.name ?? "Object";
  const isBrowserEvent = /Event$/.test(ctor) || ("type" in value && ("target" in value || "currentTarget" in value));
  if (!isBrowserEvent) return arg;
  return {
    type: typeof value.type === "string" ? value.type : ctor,
    message: typeof value.message === "string" ? value.message : formatConsoleArg(arg),
  };
}

// Bridge component — listens to Sandpack errors + startup status and forwards
// them to the Builder's auto-heal pipeline via `preview-error` window events.
// Sandpack's bundler worker (sandbox.<hash>.js) and react-error-overlay
// occasionally throw "'message' is read-only" while trying to mutate a
// browser-owned MessageEvent. This is NOT user code — it's an internal quirk
// of @codesandbox/sandpack-react. Filter it out so it never reaches the
// auto-heal pipeline (otherwise the AI keeps rewriting random files looking
// for a `message =` assignment that doesn't exist).
function isSandpackInternalNoise(message: string, stack: string = ""): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  const s = stack.toLowerCase();
  const isReadOnlyMessage = /["']?message["']?\s+is\s+read-only/.test(m);
  // Lovable's own MutationObserver tagger occasionally trips on getter-only
  // DOM properties (attributeName / nodeType) — also not user code.
  const isGetterOnly = /setting getter-only property/.test(m);
  const fromSandpack =
    /sandpack\.codesandbox\.io|sandbox\.[a-f0-9]+\.js|handlecallresponse|handlemessage|loadworker|compile\.ts|react-error-overlay/.test(s);
  const fromLovableTagger = /lovable\.js|gpteng\.co|processmutation/.test(s);
  // If the read-only-message error has no stack at all, it's still almost
  // certainly the Sandpack worker — user code that reassigns `message` would
  // surface with a real source location.
  if (isReadOnlyMessage && (fromSandpack || !s)) return true;
  if (isGetterOnly && (fromLovableTagger || !s)) return true;
  return false;
}

const SandpackErrorBridge = forwardRef<
  HTMLDivElement,
  {
    onError: (msg: string) => void;
    onReady: () => void;
    onStartupTimeout: () => void;
    startupTimeoutMs?: number;
  }
>(({ onError, onReady, onStartupTimeout, startupTimeoutMs = 20000 }, _ref) => {
  const { sandpack } = useSandpack();
  const lastSentRef = useRef<string>("");
  const readyFiredRef = useRef(false);
  const status = (sandpack as any).status;

  useEffect(() => {
    if (!readyFiredRef.current && (status === "running" || status === "idle")) {
      readyFiredRef.current = true;
      onReady();
    }
  }, [status, onReady]);

  useEffect(() => {
    readyFiredRef.current = false;
    const t = window.setTimeout(() => {
      if (!readyFiredRef.current) onStartupTimeout();
    }, startupTimeoutMs);
    return () => window.clearTimeout(t);
  }, [onStartupTimeout, startupTimeoutMs]);

  useEffect(() => {
    const error = sandpack.error;
    if (!error) return;
    const message = error.message || "Unknown preview error";
    const path = (error as any).path || "";
    const line = (error as any).line ?? "";
    const column = (error as any).column ?? "";
    const stack = `${message}\n  at ${path}${line ? `:${line}` : ""}${column ? `:${column}` : ""}`;
    if (isSandpackInternalNoise(message, stack)) {
      console.warn("[preview] Suppressed Sandpack internal noise:", message);
      return;
    }
    const key = `${message}|${path}|${line}`;
    if (key === lastSentRef.current) return;
    lastSentRef.current = key;
    onError(stack);
    window.dispatchEvent(
      new CustomEvent("preview-error", {
        detail: { message, stack, componentStack: "" },
      }),
    );
  }, [sandpack.error, onError]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data: any = e?.data;
      if (!data || typeof data !== "object") return;
      const isErr =
        data.type === "action" && (data.action === "show-error" || data.action === "notification" && data.notificationType === "error");
      const payload = data.payload || data;
      const message: string = payload?.message || payload?.title || data?.message || "";
      if (!isErr && !(message && /error|read-only|is not defined|unexpected token|cannot find/i.test(message))) return;
      const path: string = payload?.path || "";
      const line = payload?.line ?? "";
      const stack = `${message}\n  at ${path}${line ? `:${line}` : ""}`;
      if (isSandpackInternalNoise(message, stack)) {
        console.warn("[preview] Suppressed Sandpack internal postMessage noise:", message);
        return;
      }
      const key = `${message}|${path}|${line}`;
      if (!message || key === lastSentRef.current) return;
      lastSentRef.current = key;
      onError(stack);
      window.dispatchEvent(
        new CustomEvent("preview-error", {
          detail: { message, stack, componentStack: "" },
        }),
      );
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onError]);

  return null;
});
SandpackErrorBridge.displayName = "SandpackErrorBridge";

const MAX_AUTO_RETRIES = 2;

export const PreviewPanel = ({
  files,
  appDescription,
  onAutoFix,
}: {
  files: ProjectFile[];
  appDescription?: string;
  onAutoFix?: (prompt: string) => void;
}) => {
  const [device, setDevice] = useState<DeviceId>("iphone15");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [scheme, setScheme] = useState<ColorScheme>("dark");
  const [reloadKey, setReloadKey] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showConsole, setShowConsole] = useState(false);
  const [shared, setShared] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [startupFailed, setStartupFailed] = useState(false);
  const [autoRetries, setAutoRetries] = useState(0);
  const [visualLoading, setVisualLoading] = useState(false);
  const [visualIssues, setVisualIssues] = useState<VisualIssue[] | null>(null);
  const [visualSummary, setVisualSummary] = useState<string>("");
  const [showVisual, setShowVisual] = useState(false);
  const previewWrapRef = useRef<HTMLDivElement>(null);
  // Auto-fit: measured size of the preview stage so the device frame can
  // shrink to fit on small viewports (e.g. the mobile Builder preview tab).
  const [stageSize, setStageSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const sandpackFiles = useMemo(() => buildSandpackFiles(files), [files]);

  // Merge dependencies from the project's own package.json (if present) into
  // the Sandpack customSetup. Sandpack does NOT read package.json from the
  // virtual file system — whatever isn't declared here will trigger
  // "Could not find dependency: 'X'" at preview time even if the build
  // scaffolder includes it. Keeping this list aligned with
  // scripts/inject-files.js prevents un-healable preview errors.
  const sandpackDependencies = useMemo<Record<string, string>>(() => {
    const base: Record<string, string> = {
      "react": "^18.3.1",
      "react-dom": "^18.3.1",
      "react-router-dom": "^6.30.0",
      "react-router": "^6.30.0",
      "lucide-react": "^0.462.0",
      "framer-motion": "^11.18.2",
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
      "qrcode.react": "^4.2.0",
      "class-variance-authority": "^0.7.1",
      "@tanstack/react-query": "^5.56.2",
    };
    // Merge any extras from the project's own package.json so newly added
    // dependencies (via add_dependency tool) are also available in preview.
    const pkgFile = files.find((f) => {
      const p = f.path.startsWith("/") ? f.path : `/${f.path}`;
      return p === "/package.json";
    });
    if (pkgFile) {
      try {
        const pkg = JSON.parse(pkgFile.content);
        if (pkg && typeof pkg.dependencies === "object") {
          for (const [name, ver] of Object.entries(pkg.dependencies)) {
            if (typeof ver === "string" && !base[name]) base[name] = ver;
          }
        }
      } catch { /* ignore malformed package.json */ }
    }
    return base;
  }, [files]);

  // Reset transient state when files change or user manually reloads.
  useEffect(() => {
    setErrorMsg(null);
    setIsReady(false);
    setStartupFailed(false);
  }, [files, reloadKey]);

  // Register the preview wrapper + readiness with the visual-review module so
  // the auto-polish loop in useBuilderAgent can find the live iframe without
  // prop drilling. Cleanup on unmount.
  useEffect(() => {
    registerPreviewElement(previewWrapRef.current);
    return () => registerPreviewElement(null);
  }, []);
  useEffect(() => {
    setPreviewReady(isReady);
  }, [isReady]);

  // Track the available stage size so the device frame can auto-scale to fit.
  // Without this the fixed-px iPhone/iPad/Desktop frames overflow on small
  // mobile viewports and the bottom of the preview gets clipped.
  useEffect(() => {
    const el = previewWrapRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setStageSize({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sync the preview iframe's color scheme so apps using Tailwind `dark:` or
  // `prefers-color-scheme` actually flip when the user toggles the Sun/Moon button.
  useEffect(() => {
    if (!previewWrapRef.current) return;
    const apply = () => {
      const iframe = previewWrapRef.current?.querySelector("iframe") as HTMLIFrameElement | null;
      const doc = iframe?.contentDocument;
      if (!doc?.documentElement) return false;
      const root = doc.documentElement;
      root.classList.toggle("dark", scheme === "dark");
      root.style.colorScheme = scheme;
      return true;
    };
    if (apply()) return;
    // Iframe may not be ready yet — retry briefly.
    const id = window.setInterval(() => { if (apply()) window.clearInterval(id); }, 200);
    const stop = window.setTimeout(() => window.clearInterval(id), 5000);
    return () => { window.clearInterval(id); window.clearTimeout(stop); };
  }, [scheme, reloadKey, isReady]);

  // Capture runtime errors from inside the preview iframe so the agent can
  // see "did this actually work?" — broken renders, undefined access, failed
  // imports, network failures inside the app. Recorded into a module-level
  // buffer that the auto-polish loop reads after each build.
  useEffect(() => {
    if (!isReady) return;
    const wrap = previewWrapRef.current;
    if (!wrap) return;
    const iframe = wrap.querySelector("iframe") as HTMLIFrameElement | null;
    const win = iframe?.contentWindow;
    if (!win) return;

    // Buffer + auto-heal trigger. We dispatch `preview-error` so the
    // useBuilderHeal pipeline picks up runtime crashes that Sandpack itself
    // never surfaces (rejected promises in async effects, render-time throws
    // caught only by React's error boundary, etc.).
    const dispatchHeal = (message: string, stack: string) => {
      try {
        window.dispatchEvent(
          new CustomEvent("preview-error", {
            detail: { message, stack, componentStack: "" },
          }),
        );
      } catch { /* ignore */ }
    };
    const onError = (ev: ErrorEvent) => {
      const msg = ev.message || (ev.error && String(ev.error)) || "Unknown runtime error";
      const where = ev.filename ? ` (${ev.filename}:${ev.lineno || 0})` : "";
      const stack = (ev.error && (ev.error as Error).stack) || `${msg}${where}`;
      recordPreviewConsoleError(`Runtime: ${msg}${where}`);
      dispatchHeal(msg, stack);
    };
    const onRejection = (ev: PromiseRejectionEvent) => {
      const reason = ev.reason instanceof Error ? ev.reason.message : String(ev.reason);
      const stack = (ev.reason instanceof Error && ev.reason.stack) || reason;
      recordPreviewConsoleError(`UnhandledRejection: ${reason}`);
      dispatchHeal(reason, stack);
    };
    // Wrap console.error inside the iframe.
    let originalConsoleError: typeof console.error | null = null;
    try {
      const c = (win as any).console;
      if (c && typeof c.error === "function") {
        originalConsoleError = c.error.bind(c);
        c.error = (...args: unknown[]) => {
          try {
            const text = args
              .map(formatConsoleArg)
              .join(" ")
              .slice(0, 500);
            recordPreviewConsoleError(`Console: ${text}`);
            // If a real Error was logged (React render error, async crash,
            // network failure logged with .catch(console.error), etc.) feed
            // it to the heal pipeline. We exclude pure warnings / dev noise
            // by requiring an Error object in the args.
            const errArg = args.find((a) => a instanceof Error) as Error | undefined;
            if (errArg) dispatchHeal(errArg.message || text, errArg.stack || text);
            else if (/^(Error|TypeError|ReferenceError|SyntaxError|RangeError):/.test(text)) {
              dispatchHeal(text, text);
            }
          } catch { /* swallow */ }
          originalConsoleError?.(...args.map(sanitizeConsoleArg));
        };
      }
    } catch { /* cross-origin or detached */ }

    try {
      win.addEventListener("error", onError);
      win.addEventListener("unhandledrejection", onRejection);
    } catch { /* cross-origin */ }

    return () => {
      try {
        win.removeEventListener("error", onError);
        win.removeEventListener("unhandledrejection", onRejection);
        if (originalConsoleError) {
          (win as any).console.error = originalConsoleError;
        }
      } catch { /* ignore */ }
    };
  }, [isReady, reloadKey]);

  useEffect(() => {
    if (errorMsg) setShowConsole(true);
  }, [errorMsg]);

  const handleReady = useCallback(() => {
    setIsReady(true);
    setStartupFailed(false);
    setAutoRetries(0);
  }, []);

  const handleStartupTimeout = useCallback(() => {
    if (autoRetries < MAX_AUTO_RETRIES) {
      setAutoRetries((n) => n + 1);
      setReloadKey((v) => v + 1); // silent retry
    } else {
      setStartupFailed(true);
    }
  }, [autoRetries]);

  const handleManualReload = useCallback(() => {
    haptic("light");
    setAutoRetries(0);
    setStartupFailed(false);
    setReloadKey((v) => v + 1);
  }, []);

  // Share — copy a snapshot of /src/App.tsx since Sandpack runs in its own iframe.
  const handleShare = async () => {
    haptic("medium");
    try {
      const appFile = files.find((f) => /App\.(tsx|jsx|ts|js)$/.test(f.path));
      const code = appFile?.content ?? DEFAULT_APP;
      await navigator.clipboard.writeText(code);
      toast.success("App.tsx copied to clipboard", {
        description: "Paste it into any sandbox to share your work.",
      });
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      toast.error("Couldn't copy preview", { description: err?.message });
    }
  };

  const handleVisualReview = useCallback(async () => {
    if (!previewWrapRef.current) return;
    if (!isReady) {
      toast.info("Wait for the preview to finish loading first.");
      return;
    }
    haptic("medium");
    setVisualLoading(true);
    setShowVisual(true);
    try {
      const result = await runVisualReview({
        element: previewWrapRef.current,
        appDescription,
        filePaths: files.map((f) => f.path),
      });
      if (result.error) {
        toast.error("Visual review failed", { description: result.error });
        setVisualIssues([]);
        setVisualSummary(result.error);
      } else {
        setVisualIssues(result.issues);
        setVisualSummary(result.summary);
        if (result.issues.length === 0) {
          toast.success("No visual issues detected");
        } else {
          toast.warning(`${result.issues.length} visual issue${result.issues.length === 1 ? "" : "s"} found`);
        }
      }
    } catch (err: any) {
      toast.error("Visual review failed", { description: err?.message });
      setVisualIssues([]);
    } finally {
      setVisualLoading(false);
    }
  }, [isReady, appDescription, files]);

  // Global trigger — Command Palette ("Run AI visual review") fires this.
  useEffect(() => {
    const onRun = () => { handleVisualReview(); };
    window.addEventListener("oneclick:run-visual-review", onRun);
    return () => window.removeEventListener("oneclick:run-visual-review", onRun);
  }, [handleVisualReview]);

  const sandpackKey = `${reloadKey}-${files.length}`;

  const previewArea = (
    <SandpackProvider
      key={sandpackKey}
      template="react-ts"
      files={sandpackFiles}
      customSetup={{ dependencies: sandpackDependencies }}
      options={{
        recompileMode: "delayed",
        recompileDelay: 400,
        classes: {
          "sp-wrapper": "!h-full !w-full !min-h-full",
          "sp-layout": "!h-full !w-full !min-h-full !border-0",
          "sp-preview": "!h-full !w-full !min-h-full",
          "sp-preview-container": "!h-full !w-full !min-h-full !bg-black",
          "sp-preview-iframe": "!h-full !w-full !min-h-full !bg-black",
        },
      }}
    >
      <SandpackErrorBridge
        onError={setErrorMsg}
        onReady={handleReady}
        onStartupTimeout={handleStartupTimeout}
      />
      <SandpackLayout style={{ height: "100%", minHeight: "100%", width: "100%", border: 0, borderRadius: 0 }}>
        <SandpackPreview
          showOpenInCodeSandbox={false}
          showRefreshButton={false}
          showRestartButton={false}
          showNavigator={false}
          showSandpackErrorOverlay={false}
          style={{ height: "100%", minHeight: "100%", width: "100%", border: 0, display: "flex" }}
        />
      </SandpackLayout>

      {/* Loading overlay — shown until Sandpack reports ready */}
      {!isReady && !startupFailed && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm pointer-events-none">
          <Loader2 className="h-6 w-6 animate-spin text-primary mb-3" />
          <div className="text-xs font-mono text-[hsl(var(--foreground-muted))]">
            Starting live preview…
          </div>
          {autoRetries > 0 && (
            <div className="text-[10px] font-mono text-[hsl(var(--foreground-subtle))] mt-1">
              Retry {autoRetries}/{MAX_AUTO_RETRIES}
            </div>
          )}
        </div>
      )}

      {/* Startup failure overlay — replaces "Sorry, we ran into an issue" */}
      {startupFailed && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/90 backdrop-blur-sm p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Preview couldn't start</div>
            <div className="text-xs text-[hsl(var(--foreground-muted))] mt-1 max-w-xs">
              The sandbox bundler timed out. This usually clears after a reload — slow network, blocked CDN, or low memory can cause it.
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleManualReload}
              className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="h-3 w-3" />
              Reload preview
            </button>
            <button
              onClick={() => setStartupFailed(false)}
              className="px-3 py-1.5 rounded-md border border-[hsl(0_0%_100%/0.1)] text-xs font-medium text-[hsl(var(--foreground-muted))] hover:text-foreground hover:bg-[hsl(0_0%_100%/0.04)] transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </SandpackProvider>
  );

  return (
    <div className="flex h-full flex-col bg-[hsl(var(--bg-subtle))]">
      <div className="flex items-center justify-between border-b border-[hsl(0_0%_100%/0.06)] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-success animate-pulse-soft" aria-hidden />
          <span className="text-[10px] font-mono uppercase tracking-wider text-[hsl(var(--foreground-subtle))]">
            Live Preview
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Device picker — iPhone / Pixel / iPad / Desktop */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-[hsl(var(--bg-muted))] border border-[hsl(0_0%_100%/0.06)]">
            {(["iphone15", "pixel", "ipad", "desktop"] as DeviceId[]).map((id) => {
              const Icon = id === "desktop" ? Monitor : id === "ipad" ? Tablet : Smartphone;
              return (
                <button
                  key={id}
                  onClick={() => { haptic("light"); setDevice(id); }}
                  title={DEVICE_SPECS[id].label}
                  aria-label={DEVICE_SPECS[id].label}
                  className={`p-1.5 rounded transition-colors duration-150 ${
                    device === id
                      ? "bg-[hsl(var(--bg-elevated))] text-foreground shadow-xs"
                      : "text-[hsl(var(--foreground-muted))] hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>

          {/* Rotate (mobile devices only) */}
          {device !== "desktop" && (
            <button
              onClick={() => { haptic("light"); setOrientation((o) => o === "portrait" ? "landscape" : "portrait"); }}
              title={`Rotate (${orientation})`}
              aria-label="Rotate"
              className="p-1.5 rounded text-[hsl(var(--foreground-muted))] hover:text-foreground hover:bg-[hsl(0_0%_100%/0.06)] transition-colors"
            >
              <RotateCw className={`h-3.5 w-3.5 transition-transform duration-300 ${orientation === "landscape" ? "rotate-90" : ""}`} />
            </button>
          )}

          {/* Light/Dark scheme toggle for the preview backdrop */}
          <button
            onClick={() => { haptic("light"); setScheme((s) => s === "dark" ? "light" : "dark"); }}
            title={`Preview theme: ${scheme}`}
            aria-label="Toggle preview theme"
            className="p-1.5 rounded text-[hsl(var(--foreground-muted))] hover:text-foreground hover:bg-[hsl(0_0%_100%/0.06)] transition-colors"
          >
            {scheme === "dark" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
          </button>

          <div className="w-px h-5 bg-[hsl(0_0%_100%/0.06)] mx-0.5" />

          <button
            onClick={() => setReloadKey((v) => v + 1)}
            title="Reload preview"
            aria-label="Reload preview"
            className="p-1.5 rounded text-[hsl(var(--foreground-muted))] hover:text-foreground hover:bg-[hsl(0_0%_100%/0.06)] transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              toast.info("Open-in-tab not supported with the new sandboxed preview yet — use Share to copy the source.");
            }}
            title="Open in new tab (use Share for now)"
            aria-label="Open in new tab"
            className="p-1.5 rounded text-[hsl(var(--foreground-muted))] hover:text-foreground hover:bg-[hsl(0_0%_100%/0.06)] transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleShare}
            title="Copy App.tsx source"
            aria-label="Share preview"
            className={`p-1.5 rounded transition-colors ${
              shared
                ? "bg-success/15 text-success"
                : "text-[hsl(var(--foreground-muted))] hover:text-foreground hover:bg-[hsl(0_0%_100%/0.06)]"
            }`}
          >
            {shared ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={handleVisualReview}
            disabled={visualLoading}
            title={
              visualIssues === null
                ? "Run AI visual review"
                : visualIssues.length === 0
                  ? "Visual review: no issues found — re-run"
                  : `Visual review: ${visualIssues.length} issue${visualIssues.length === 1 ? "" : "s"} — click to view`
            }
            aria-label="Run visual review"
            className={`relative p-1.5 rounded transition-colors ${
              showVisual
                ? "bg-primary/15 text-primary"
                : visualIssues && visualIssues.length > 0
                  ? "text-warning hover:bg-warning/10"
                  : visualIssues && visualIssues.length === 0
                    ? "text-success hover:bg-success/10"
                    : "text-[hsl(var(--foreground-muted))] hover:text-foreground hover:bg-[hsl(0_0%_100%/0.06)]"
            } disabled:opacity-50`}
          >
            {visualLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
            {!visualLoading && visualIssues && visualIssues.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-warning text-[9px] font-bold leading-none flex items-center justify-center text-warning-foreground">
                {visualIssues.length > 9 ? "9+" : visualIssues.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowConsole((v) => !v)}
            title="Toggle console"
            aria-label="Toggle console"
            className={`p-1.5 rounded transition-colors ${
              showConsole
                ? "bg-primary/15 text-primary"
                : "text-[hsl(var(--foreground-muted))] hover:text-foreground hover:bg-[hsl(0_0%_100%/0.06)]"
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div ref={previewWrapRef} className="flex flex-1 items-center justify-center overflow-hidden bg-gradient-to-br from-background via-background to-[hsl(var(--bg-subtle))] p-3 sm:p-6 relative">
        {(() => {
          // Auto-fit: shrink the device frame to fit the available stage.
          // Desktop "frame" is fluid (uses 100%) so it doesn't need scaling.
          if (device === "desktop") {
            return (
              <DeviceFrame device={device} orientation={orientation} scheme={scheme}>
                {previewArea}
              </DeviceFrame>
            );
          }
          const spec = DEVICE_SPECS[device];
          const isLandscape = orientation === "landscape";
          const fw = isLandscape ? spec.height : spec.width;
          const fh = isLandscape ? spec.width : spec.height;
          // Leave a small margin (12px on each axis) so shadows aren't clipped.
          const availW = Math.max(0, stageSize.w - 12);
          const availH = Math.max(0, stageSize.h - 12);
          const fit = stageSize.w > 0 && stageSize.h > 0
            ? Math.min(1, availW / fw, availH / fh)
            : 1;
          return (
            <DeviceFrame
              device={device}
              orientation={orientation}
              scheme={scheme}
              scale={fit}
            >
              {previewArea}
            </DeviceFrame>
          );
        })()}
      </div>

      {showConsole && errorMsg && (
        <div className="border-t border-destructive/30 bg-destructive/5 px-4 py-2 text-xs font-mono text-destructive max-h-32 overflow-auto animate-fade-in">
          <div className="font-semibold mb-1">Runtime error</div>
          <pre className="whitespace-pre-wrap break-all opacity-80">{errorMsg}</pre>
        </div>
      )}

      {showVisual && (visualLoading || visualIssues !== null) && (
        <div className="border-t border-[hsl(0_0%_100%/0.08)] bg-[hsl(var(--bg-muted))] max-h-56 overflow-auto animate-fade-in">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-[hsl(0_0%_100%/0.06)] sticky top-0 bg-[hsl(var(--bg-muted))]">
            <div className="flex items-center gap-2">
              <Eye className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-[hsl(var(--foreground-subtle))]">
                Visual Review
              </span>
              {visualIssues && (
                <span className="text-[10px] font-mono text-[hsl(var(--foreground-muted))]">
                  {visualIssues.length} issue{visualIssues.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {!visualLoading && visualIssues && visualIssues.length > 0 && onAutoFix && (
                <button
                  onClick={() => {
                    haptic("medium");
                    const lines = visualIssues.map((iss, i) => {
                      const tag = iss.severity === "error" ? "🔴" : "🟡";
                      const sug = iss.suggestion ? ` — Suggested fix: ${iss.suggestion}` : "";
                      return `${i + 1}. ${tag} ${iss.message}${sug}`;
                    });
                    const prompt =
                      `Auto-fix the following ${visualIssues.length} visual issue(s) detected in the live preview.\n\n` +
                      `Summary: ${visualSummary || "(no summary)"}\n\n` +
                      `Issues:\n${lines.join("\n")}\n\n` +
                      `Read the relevant file(s) first, then apply targeted fixes (prefer edit_file over write_file). ` +
                      `Address every issue in one pass and verify with run_typecheck or validate_files when done.`;
                    onAutoFix(prompt);
                    setShowVisual(false);
                    setVisualIssues(null);
                    setVisualSummary("");
                  }}
                  className="text-[10px] font-medium px-2 py-1 rounded bg-primary/15 text-primary hover:bg-primary/25 transition-colors flex items-center gap-1"
                  aria-label="Auto-fix all issues with AI"
                >
                  <Wand2 className="h-3 w-3" />
                  Auto-fix all
                </button>
              )}
              <button
                onClick={() => setShowVisual(false)}
                className="p-0.5 rounded text-[hsl(var(--foreground-muted))] hover:text-foreground hover:bg-[hsl(0_0%_100%/0.06)]"
                aria-label="Close visual review"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="px-3 py-2 space-y-2">
            {visualLoading && (
              <div className="flex items-center gap-2 text-xs text-[hsl(var(--foreground-muted))]">
                <Loader2 className="h-3 w-3 animate-spin" />
                Capturing & analyzing preview…
              </div>
            )}
            {!visualLoading && visualSummary && (
              <div className="text-xs text-[hsl(var(--foreground-muted))] italic">{visualSummary}</div>
            )}
            {!visualLoading && visualIssues && visualIssues.length > 0 && (
              <ul className="space-y-1.5">
                {visualIssues.map((issue, i) => (
                  <li
                    key={i}
                    className={`text-xs rounded-md px-2 py-1.5 border ${
                      issue.severity === "error"
                        ? "border-destructive/30 bg-destructive/5 text-destructive"
                        : "border-warning/30 bg-warning/5 text-warning"
                    }`}
                  >
                    <div className="font-semibold">{issue.message}</div>
                    {issue.suggestion && (
                      <div className="opacity-80 mt-0.5">→ {issue.suggestion}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {!visualLoading && visualIssues && visualIssues.length === 0 && (
              <div className="text-xs text-[hsl(var(--foreground-muted))]">
                ✨ No visual issues detected — looks good!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};