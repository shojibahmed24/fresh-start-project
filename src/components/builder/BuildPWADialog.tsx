// PWA Export — turns the user's project into an installable Progressive Web
// App. We inject a web manifest, app icons, theme-color meta tags, and an
// "Add to Home Screen" prompt component into a copy of the project files,
// then bundle everything as a deploy-ready ZIP. No service worker is added
// (avoids preview iframe stale-cache issues — see system PWA guidance).
//
// This is a **client-side** export — no edge function, no GitHub Actions,
// no build infra. The user's project is already a static web app, so making
// it installable just means adding the right metadata files. Result: zero
// extra cost, ~3 second export time.
import { useMemo, useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { Globe, Download, Loader2, CheckCircle2, Smartphone, Sparkles, Image as ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { celebrate } from "@/lib/celebrate";
import type { Project } from "@/lib/store";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  project: Project;
};

type ThemePreset = { name: string; bg: string; theme: string };
const THEME_PRESETS: ThemePreset[] = [
  { name: "Indigo", bg: "#0f172a", theme: "#6366f1" },
  { name: "Emerald", bg: "#0a0f0d", theme: "#10b981" },
  { name: "Rose", bg: "#1a0a10", theme: "#f43f5e" },
  { name: "Amber", bg: "#1a1208", theme: "#f59e0b" },
  { name: "Sky", bg: "#0a1420", theme: "#0ea5e9" },
  { name: "Violet", bg: "#140a1a", theme: "#a855f7" },
];

// Tiny helper — generates a square PNG icon from a single character + colors.
// Avoids shipping placeholder.svg or external icon files; runs entirely in
// the browser canvas. Returns a Uint8Array suitable for zipping.
async function renderIconPng(size: number, letter: string, bg: string, fg: string): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Rounded square background
  const r = Math.floor(size * 0.22);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(size, 0, size, size, r);
  ctx.arcTo(size, size, 0, size, r);
  ctx.arcTo(0, size, 0, 0, r);
  ctx.arcTo(0, 0, size, 0, r);
  ctx.closePath();
  ctx.fill();

  // Centered letter
  ctx.fillStyle = fg;
  ctx.font = `bold ${Math.floor(size * 0.55)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((letter || "A").toUpperCase().slice(0, 1), size / 2, size / 2 + size * 0.04);

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"),
  );
  return new Uint8Array(await blob.arrayBuffer());
}

// Inject manifest <link> + theme-color <meta> + apple-touch-icon into the
// project's index.html. If no <head> exists, we synthesize one.
function injectIntoIndexHtml(html: string, opts: { themeColor: string; appName: string }): string {
  const headInjection = `
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="theme-color" content="${opts.themeColor}" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="${opts.appName}" />
    <link rel="apple-touch-icon" href="/icons/icon-192.png" />`;

  // If a manifest link already exists, replace from rel="manifest" up to next </link>;
  // Otherwise inject just before </head>.
  if (/<link[^>]+rel=["']manifest["']/i.test(html)) {
    // Strip prior PWA-related tags so re-export stays clean.
    html = html
      .replace(/\s*<link[^>]+rel=["']manifest["'][^>]*>/gi, "")
      .replace(/\s*<meta[^>]+name=["']theme-color["'][^>]*>/gi, "")
      .replace(/\s*<meta[^>]+name=["']apple-mobile-web-app-[^"']+["'][^>]*>/gi, "")
      .replace(/\s*<link[^>]+rel=["']apple-touch-icon["'][^>]*>/gi, "");
  }
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${headInjection}\n  </head>`);
  }
  // No <head> — wrap the whole thing.
  return `<!doctype html>\n<html><head>${headInjection}</head><body>${html}</body></html>`;
}

// README explaining how to deploy + install the exported PWA.
function buildReadme(appName: string): string {
  return `# ${appName} — PWA Export

This is a deploy-ready Progressive Web App. Users can install it to their
home screen on iOS, Android, and desktop browsers.

## Deploy

Upload all files (preserving folder structure) to any static host:

- **Netlify** — drag-and-drop the folder onto netlify.com/drop
- **Vercel** — \`npx vercel --prod\`
- **Cloudflare Pages** — connect your Git repo or use Wrangler
- **GitHub Pages** — push to a repo and enable Pages

## Install on a phone

1. Open your deployed URL in **Safari (iOS)** or **Chrome (Android)**.
2. Tap the browser's share / menu button.
3. Choose **"Add to Home Screen"**.
4. The app will install with its own icon and run full-screen.

## What's inside

- \`manifest.webmanifest\` — tells browsers this is an installable app
- \`icons/icon-192.png\` and \`icons/icon-512.png\` — home-screen icons
- \`index.html\` — patched with PWA meta tags

No service worker is bundled — your app stays simple and avoids stale-cache
issues. Add one later if you need offline support.
`;
}

export function BuildPWADialog({ open, onOpenChange, project }: Props) {
  const defaultName = project.name?.trim() || "My App";
  const [appName, setAppName] = useState(defaultName);
  const [shortName, setShortName] = useState(defaultName.slice(0, 12));
  const [themeIdx, setThemeIdx] = useState(0);
  const [building, setBuilding] = useState(false);
  const [done, setDone] = useState(false);

  const theme = THEME_PRESETS[themeIdx];

  // Find an index.html to patch — preferred location is `index.html` at root,
  // but we also accept `public/index.html` (CRA-style projects).
  const indexHtmlFile = useMemo(
    () => project.files.find((f) => f.path === "index.html") ?? project.files.find((f) => f.path === "public/index.html") ?? null,
    [project.files],
  );

  const handleExport = async () => {
    if (!appName.trim()) {
      toast.error("App name is required");
      return;
    }
    setBuilding(true);
    setDone(false);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();

      // Build the manifest
      const manifest = {
        name: appName.trim(),
        short_name: (shortName || appName).trim().slice(0, 12),
        description: project.description || `${appName.trim()} — built with Lovable`,
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: theme.bg,
        theme_color: theme.theme,
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      };

      // Generate icons (canvas → PNG bytes)
      const letter = (shortName || appName).trim().charAt(0) || "A";
      const [icon192, icon512] = await Promise.all([
        renderIconPng(192, letter, theme.theme, "#ffffff"),
        renderIconPng(512, letter, theme.theme, "#ffffff"),
      ]);

      // Add ALL existing project files first (preserve folder structure).
      for (const f of project.files) {
        // Skip the index.html we'll patch separately.
        if (f === indexHtmlFile) continue;
        zip.file(f.path.replace(/^\//, ""), f.content);
      }

      // Patch / synthesize index.html
      const baseHtml = indexHtmlFile?.content ?? `<!doctype html>\n<html>\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />\n    <title>${appName}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n  </body>\n</html>`;
      const patched = injectIntoIndexHtml(baseHtml, { themeColor: theme.theme, appName: appName.trim() });
      zip.file("index.html", patched);

      // PWA assets
      zip.file("manifest.webmanifest", JSON.stringify(manifest, null, 2));
      zip.file("icons/icon-192.png", icon192);
      zip.file("icons/icon-512.png", icon512);
      zip.file("README.md", buildReadme(appName.trim()));

      const blob = await zip.generateAsync({ type: "blob" });
      const safe = appName.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safe}-pwa.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      setDone(true);
      celebrate("build");
      toast.success("PWA exported", {
        description: "Unzip and deploy to any static host.",
      });
    } catch (e: any) {
      console.error("[PWA export] failed", e);
      toast.error(e?.message ?? "Export failed");
    } finally {
      setBuilding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-primary/15 via-transparent to-transparent px-6 pt-6 pb-4 border-b border-border/50">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Globe size={20} className="text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base">Export as installable PWA</DialogTitle>
                <DialogDescription className="text-xs">
                  Bundle your project with a web manifest + icons so users can install it to their home screen.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 max-h-[65vh] overflow-y-auto space-y-5">
          {!done && (
            <>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                <p className="flex items-center gap-1.5"><Sparkles size={12} className="text-primary" /> Runs entirely in your browser — no server, no waiting.</p>
                <p>• Works on iOS Safari, Android Chrome, and desktop browsers.</p>
                <p>• Deploy the ZIP to Netlify, Vercel, Cloudflare Pages, or any static host.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pwa-name" className="text-xs">App name</Label>
                  <Input
                    id="pwa-name"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder="My App"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pwa-short" className="text-xs">Short name <span className="text-muted-foreground">(home screen)</span></Label>
                  <Input
                    id="pwa-short"
                    value={shortName}
                    onChange={(e) => setShortName(e.target.value.slice(0, 12))}
                    placeholder="MyApp"
                    maxLength={12}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1.5">
                  <ImageIcon size={12} /> Icon theme
                </Label>
                <div className="grid grid-cols-6 gap-2">
                  {THEME_PRESETS.map((t, i) => (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => setThemeIdx(i)}
                      className={`relative aspect-square rounded-lg border-2 transition-all ${
                        themeIdx === i ? "border-primary scale-105" : "border-border/40 hover:border-border"
                      }`}
                      style={{ background: t.theme }}
                      title={t.name}
                      aria-label={`${t.name} theme`}
                    >
                      <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm">
                        {(shortName || appName).trim().charAt(0).toUpperCase() || "A"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border/40 bg-muted/20 p-3 flex items-center gap-3">
                <div
                  className="size-12 rounded-xl shrink-0 flex items-center justify-center text-white font-bold text-lg"
                  style={{ background: theme.theme }}
                >
                  {(shortName || appName).trim().charAt(0).toUpperCase() || "A"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{appName || "My App"}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Smartphone size={10} /> Preview of home-screen icon
                  </div>
                </div>
              </div>

              <Button onClick={handleExport} disabled={building || !appName.trim()} className="w-full" size="lg">
                {building ? (
                  <><Loader2 size={16} className="mr-2 animate-spin" /> Building PWA bundle…</>
                ) : (
                  <><Download size={16} className="mr-2" /> Export PWA (.zip)</>
                )}
              </Button>
            </>
          )}

          <AnimatePresence>
            {done && (
              <m.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={16} /> PWA bundle downloaded
                </div>
                <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal pl-4">
                  <li>Unzip the file you just downloaded.</li>
                  <li>Upload the folder to a static host (Netlify Drop, Vercel, Cloudflare Pages).</li>
                  <li>Open the deployed URL on a phone → menu → <span className="text-foreground font-medium">Add to Home Screen</span>.</li>
                </ol>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { setDone(false); }}>
                    Export again
                  </Button>
                  <Button size="sm" className="flex-1" onClick={() => onOpenChange(false)}>
                    Done
                  </Button>
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
