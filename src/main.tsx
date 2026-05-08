import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./lib/registerSW";

// ─── Chunk-load recovery ───
// When the published HTML references a JS chunk hash that no longer exists
// (e.g. user has the old page open, we shipped a new build → 404 / wrong MIME),
// the browser throws "Loading chunk failed" / "error loading dynamically
// imported module". We catch that ONCE per session and force a hard reload so
// the user gets the fresh HTML + matching chunk hashes instead of a black screen.
// Track which chunk URLs we've already tried to recover, so a single bad
// chunk can't loop, but a *different* stale chunk later still triggers reload.
const RELOADED_CHUNKS_KEY = "__chunk_reload_urls__";
const isChunkLoadError = (msg: string): boolean =>
  /Loading chunk \d+ failed|error loading dynamically imported module|Failed to fetch dynamically imported module|Importing a module script failed|disallowed MIME type/i.test(
    msg,
  );

const extractChunkUrl = (msg: string): string => {
  const m = msg.match(/https?:\/\/[^\s"')]+\.js/);
  return m ? m[0] : "__generic__";
};

const tryHardReload = (reason: string) => {
  const url = extractChunkUrl(reason);
  let tried: string[] = [];
  try { tried = JSON.parse(sessionStorage.getItem(RELOADED_CHUNKS_KEY) || "[]"); } catch {}
  if (tried.includes(url)) {
    console.error("[chunk-recovery] Already reloaded for this chunk, giving up.", reason);
    return;
  }
  tried.push(url);
  sessionStorage.setItem(RELOADED_CHUNKS_KEY, JSON.stringify(tried));
  console.warn("[chunk-recovery] Stale chunk detected — hard-reloading.", reason);
  const next = new URL(window.location.href);
  next.searchParams.set("_r", Date.now().toString());
  window.location.replace(next.toString());
};

window.addEventListener("error", (e) => {
  if (isChunkLoadError(e.message || "")) tryHardReload(e.message);
});
window.addEventListener("unhandledrejection", (e) => {
  const msg = String(e.reason?.message ?? e.reason ?? "");
  if (isChunkLoadError(msg)) tryHardReload(msg);
});
// Clear the recovery list once the page successfully renders.
window.addEventListener("load", () => {
  setTimeout(() => sessionStorage.removeItem(RELOADED_CHUNKS_KEY), 4000);
});
// bfcache restore — ensure flag is fresh.
window.addEventListener("pageshow", (e) => {
  if ((e as PageTransitionEvent).persisted) sessionStorage.removeItem(RELOADED_CHUNKS_KEY);
});

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker AFTER first paint so it never blocks initial render.
// Internally guards against preview / iframe contexts.
registerServiceWorker();
