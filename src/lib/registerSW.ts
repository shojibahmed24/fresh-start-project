// Service worker registration — strictly guarded so the SW never activates in:
//  • the Lovable editor preview (id-preview--…lovable.app, lovableproject.com)
//  • any iframe (preview, embed)
//  • development builds
//
// On the published domain the SW provides:
//  • Installable PWA (matches manifest.webmanifest)
//  • Offline shell (NetworkFirst HTML — never locks you to a stale build)
//  • Image / font runtime cache for instant repeat-visits
//
// If the page IS in a preview/iframe, we proactively unregister any previously-
// installed worker so users who once visited the published site and came back
// in preview don't get cached output.

import { registerSW as workboxRegister } from "virtual:pwa-register";

function isPreviewContext(): boolean {
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const h = window.location.hostname;
  return (
    h.includes("id-preview--") ||
    h.includes("lovableproject.com") ||
    h.includes("localhost") ||
    h === "127.0.0.1"
  );
}

export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  if (isPreviewContext()) {
    // Clean up any previously-installed SW so the preview never serves cache.
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister().catch(() => undefined)))
      .catch(() => undefined);
    return;
  }

  // Auto-update: when a new SW version is found we wait until next page load
  // to apply (skipWaiting is off in vite.config) — prevents tearing live SSE.
  workboxRegister({
    immediate: false,
    onRegisterError(err) {
      console.warn("[sw] register failed", err);
    },
  });
}
