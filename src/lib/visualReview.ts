// Captures the Sandpack preview iframe content as a PNG data URL and posts
// it to the `visual-review` edge function for vision-model review.
//
// Two modes:
//  - runVisualReview()  → advisory issues only (manual button)
//  - scoreVisualReview() → 0-50 rubric score + polishPrompt (auto-loop)

// html2canvas (~200KB) is dynamically imported on first capture so it
// never ships in the main bundle.
import { supabase } from "@/integrations/supabase/client";

// ─── Module-level registry so the agent hook can find the live preview ───
// PreviewPanel registers its wrapper + ready state; consumers (auto-polish loop)
// read it without needing prop drilling through the page.
type PreviewRegistration = {
  element: HTMLElement | null;
  isReady: boolean;
};
const previewRegistry: PreviewRegistration = { element: null, isReady: false };

// Rolling buffer of recent runtime errors from the preview iframe.
// PreviewPanel installs listeners on the iframe's window once it loads;
// this module just exposes the read API used by the agent's auto-polish loop.
const consoleErrorBuffer: { ts: number; message: string }[] = [];
const CONSOLE_BUFFER_MAX = 20;
const CONSOLE_BUFFER_TTL_MS = 30_000; // 30s — only "recent" errors count

export function recordPreviewConsoleError(message: string) {
  if (!message) return;
  // De-dupe consecutive identical messages so a render-loop crash doesn't
  // overflow the buffer with the same line.
  const last = consoleErrorBuffer[consoleErrorBuffer.length - 1];
  if (last && last.message === message) return;
  consoleErrorBuffer.push({ ts: Date.now(), message: message.slice(0, 500) });
  if (consoleErrorBuffer.length > CONSOLE_BUFFER_MAX) {
    consoleErrorBuffer.shift();
  }
}

export function clearPreviewConsoleErrors() {
  consoleErrorBuffer.length = 0;
}

/**
 * Collect runtime errors recorded from the preview iframe in the last 30s.
 * Used by the agent's "did this actually work?" check after a build.
 * The `_el` parameter is accepted for API parity (so callers pass the
 * preview element they already have) but the buffer is module-global.
 */
export function collectPreviewConsoleErrors(_el?: HTMLElement | null): string[] {
  const cutoff = Date.now() - CONSOLE_BUFFER_TTL_MS;
  return consoleErrorBuffer
    .filter((e) => e.ts >= cutoff)
    .map((e) => e.message);
}

export function registerPreviewElement(el: HTMLElement | null) {
  previewRegistry.element = el;
}
export function setPreviewReady(ready: boolean) {
  previewRegistry.isReady = ready;
}
export function getPreviewElement(): HTMLElement | null {
  return previewRegistry.isReady && previewRegistry.element && isPreviewCaptureReady(previewRegistry.element)
    ? previewRegistry.element
    : null;
}

// Wait up to `timeoutMs` for the preview to be both registered AND ready.
// Sandpack typically takes 1-3s after files are written before the iframe paints.
export async function waitForPreviewReady(timeoutMs = 8000): Promise<HTMLElement | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = getPreviewElement();
    if (el && isPreviewCaptureReady(el)) return el;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

export type VisualIssue = {
  severity: "error" | "warn";
  message: string;
  suggestion: string;
};

export type VisualReviewResult = {
  summary: string;
  issues: VisualIssue[];
  model?: string;
  error?: string;
};

export type VisualScores = {
  hierarchy: number;
  color: number;
  layout: number;
  polish: number;
  completeness: number;
};

export type VisualScoreResult = {
  mode: "score";
  scores: VisualScores;
  total: number;          // 0-50
  max: 50;
  passed: boolean;        // total >= 35
  summary: string;
  issues: VisualIssue[];
  polishPrompt: string | null;
  model?: string;
  error?: string;
};

function getPreviewIframe(el: HTMLElement): HTMLIFrameElement | null {
  return el.querySelector("iframe");
}

function getIframeDocument(iframe: HTMLIFrameElement): Document | null {
  try {
    return iframe.contentDocument ?? iframe.contentWindow?.document ?? null;
  } catch {
    return null;
  }
}

function isPreviewCaptureReady(el: HTMLElement): boolean {
  if (/starting live preview|retry \d+\/\d+|preview couldn't start/i.test(el.innerText || "")) return false;
  const iframe = getPreviewIframe(el);
  if (!iframe) return true;
  const doc = getIframeDocument(iframe);
  const root = doc?.getElementById("root");
  if (!doc?.body || !root) return false;
  const text = (root.innerText || doc.body.innerText || "").trim();
  return root.children.length > 0 && !/^loading|starting live preview/i.test(text);
}

function getCaptureTarget(el: HTMLElement): HTMLElement {
  const iframe = getPreviewIframe(el);
  if (!iframe) return el;
  const doc = getIframeDocument(iframe);
  const root = doc?.getElementById("root") as HTMLElement | null;
  if (!doc?.body || !root || !isPreviewCaptureReady(el)) {
    throw new Error("Preview content is not ready or cannot be captured yet.");
  }
  return root;
}

export async function captureElementToDataUrl(el: HTMLElement): Promise<string> {
  const target = getCaptureTarget(el);
  await target.ownerDocument.fonts?.ready?.catch(() => undefined);
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(target, {
    backgroundColor: "#ffffff",
    scale: 1,
    logging: false,
    useCORS: true,
  });
  return canvas.toDataURL("image/png");
}

export async function runVisualReview(opts: {
  element: HTMLElement;
  appDescription?: string;
  filePaths?: string[];
}): Promise<VisualReviewResult> {
  const dataUrl = await captureElementToDataUrl(opts.element);
  const rect = getCaptureTarget(opts.element).getBoundingClientRect();
  const { data, error } = await supabase.functions.invoke("visual-review", {
    body: {
      screenshot: dataUrl,
      viewportWidth: Math.round(rect.width),
      viewportHeight: Math.round(rect.height),
      appDescription: opts.appDescription,
      filePaths: opts.filePaths,
    },
  });
  if (error) return { summary: "", issues: [], error: error.message };
  return data as VisualReviewResult;
}

// Phase 2 — scoring mode. Used by the auto-polish loop after a scratch build.
export async function scoreVisualReview(opts: {
  element: HTMLElement;
  appDescription?: string;
  domainHint?: string;
}): Promise<VisualScoreResult> {
  const dataUrl = await captureElementToDataUrl(opts.element);
  const rect = getCaptureTarget(opts.element).getBoundingClientRect();
  const { data, error } = await supabase.functions.invoke("visual-review", {
    body: {
      screenshot: dataUrl,
      viewportWidth: Math.round(rect.width),
      viewportHeight: Math.round(rect.height),
      appDescription: opts.appDescription,
      domainHint: opts.domainHint,
      mode: "score",
    },
  });
  if (error) {
    return {
      mode: "score",
      scores: { hierarchy: 0, color: 0, layout: 0, polish: 0, completeness: 0 },
      total: 0,
      max: 50,
      passed: false,
      summary: "",
      issues: [],
      polishPrompt: null,
      error: error.message,
    };
  }
  return data as VisualScoreResult;
}
