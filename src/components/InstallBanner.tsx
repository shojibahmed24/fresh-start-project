import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";
import { m, AnimatePresence } from "framer-motion";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { InstallAppButton } from "@/components/InstallAppButton";

const DISMISS_KEY = "pwa-install-banner-dismissed";

/**
 * Floating "Install OneClick" banner shown on the first visit on mobile.
 *  - Hidden inside iframes (so it never appears in the Lovable preview)
 *  - Hidden once installed / standalone
 *  - Dismissible — remembered in localStorage for 14 days
 */
export function InstallBanner() {
  const { canInstall, platform } = usePWAInstall();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Never show inside an iframe (preview / embed)
    let inIframe = false;
    try { inIframe = window.self !== window.top; } catch { inIframe = true; }
    if (inIframe) return;

    // Mobile-only banner
    if (platform !== "ios" && platform !== "android") return;

    const raw = localStorage.getItem(DISMISS_KEY);
    if (raw) {
      const ts = Number(raw);
      if (!Number.isNaN(ts) && Date.now() - ts < 14 * 24 * 60 * 60 * 1000) return;
    }

    if (canInstall) {
      const t = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(t);
    }
  }, [canInstall, platform]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && canInstall && (
        <m.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-4 inset-x-4 z-[60] md:hidden"
        >
          <div className="rounded-2xl border border-border/60 bg-background/95 backdrop-blur-xl shadow-2xl p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0">
              <Download className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm leading-tight">Install OneClick Studio</div>
              <div className="text-xs text-muted-foreground mt-0.5">Add to your home screen for the full app experience.</div>
            </div>
            <InstallAppButton size="sm" label="Install" />
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
