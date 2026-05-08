// Runtime interaction audit — clicks every visible button in the preview
// iframe and records (a) buttons that produced no observable effect and
// (b) buttons that threw a runtime error. The result is fed back to the
// agent's auto-heal loop so failures get fixed in the backend instead of
// reaching the user's preview.
//
// Strategy:
//   1. Snapshot the iframe DOM (HTML + URL + a hash of body innerText).
//   2. For each visible <button> / [role="button"] / submit input:
//        - record a console-error count snapshot
//        - dispatch a synthetic click
//        - wait ~250ms for React to flush
//        - re-snapshot DOM + console errors
//        - if DOM unchanged AND no new console error AND no navigation AND
//          no aria-expanded toggle AND no new toast/dialog/route → "dead"
//        - if console error count grew → "errored"
//   3. Restore initial state where possible (close any opened dialog).
//
// Safe-guards:
//   - skip buttons that have type="submit" inside a form (would submit data)
//     UNLESS the form has no action= — then we still test it, the agent
//     usually handles client-side submits.
//   - skip buttons matching /delete|remove|sign\s*out|logout|clear/i.
//   - hard cap: 25 buttons audited, 8 second total budget.

import { collectPreviewConsoleErrors } from "./visualReview";

export type DeadButton = {
  label: string;
  selector: string;
  reason: "no-effect" | "errored" | "handler-missing";
  errorMessage?: string;
};

export type InteractionAuditResult = {
  buttonsTested: number;
  dead: DeadButton[];
  healPrompt: string | null;
};

const SKIP_LABEL = /delete|remove|sign\s*out|logout|log\s*out|clear|cancel|close|back|reset/i;
const MAX_BUTTONS = 25;
const TOTAL_BUDGET_MS = 8000;
const PER_BUTTON_WAIT_MS = 250;

function getIframeDoc(el: HTMLElement): Document | null {
  const iframe = el.querySelector("iframe") as HTMLIFrameElement | null;
  if (!iframe) return null;
  try {
    return iframe.contentDocument ?? iframe.contentWindow?.document ?? null;
  } catch {
    return null;
  }
}

function isVisible(el: Element): boolean {
  const r = (el as HTMLElement).getBoundingClientRect?.();
  if (!r) return false;
  if (r.width < 4 || r.height < 4) return false;
  const style = (el.ownerDocument?.defaultView ?? window).getComputedStyle(el as HTMLElement);
  if (style.visibility === "hidden" || style.display === "none" || style.pointerEvents === "none") return false;
  return true;
}

function describe(btn: Element): { label: string; selector: string } {
  const text = ((btn as HTMLElement).innerText || btn.textContent || "").trim().slice(0, 60);
  const aria = (btn as HTMLElement).getAttribute?.("aria-label") || "";
  const label = text || aria || (btn as HTMLElement).getAttribute?.("title") || "(unlabeled)";
  let selector = btn.tagName.toLowerCase();
  const id = (btn as HTMLElement).id;
  if (id) selector += `#${id}`;
  const cls = ((btn as HTMLElement).className || "").toString().split(/\s+/).filter(Boolean).slice(0, 2).join(".");
  if (cls) selector += `.${cls}`;
  return { label, selector };
}

function snapshotBody(doc: Document): string {
  const body = doc.body;
  if (!body) return "";
  // crude fingerprint — innerHTML length + first 200 chars of innerText +
  // dialog/toast counts, count of nodes with role=dialog/alert.
  const html = body.innerHTML;
  const text = (body.innerText || "").slice(0, 200);
  const dialogs = doc.querySelectorAll('[role="dialog"], [role="alertdialog"], [data-state="open"]').length;
  const toasts = doc.querySelectorAll('[role="status"], [role="alert"], [data-sonner-toast]').length;
  return `${html.length}|${text}|${dialogs}|${toasts}`;
}

export async function runInteractionAudit(
  el: HTMLElement,
): Promise<InteractionAuditResult> {
  const doc = getIframeDoc(el);
  if (!doc) {
    return { buttonsTested: 0, dead: [], healPrompt: null };
  }

  const buttons = Array.from(
    doc.querySelectorAll<HTMLElement>(
      'button, [role="button"], input[type="submit"], input[type="button"]',
    ),
  ).filter(isVisible).slice(0, MAX_BUTTONS);

  const dead: DeadButton[] = [];
  const startTime = Date.now();
  const initialUrl = doc.location?.href ?? "";

  for (const btn of buttons) {
    if (Date.now() - startTime > TOTAL_BUDGET_MS) break;

    const desc = describe(btn);
    if (SKIP_LABEL.test(desc.label)) continue;
    if ((btn as HTMLButtonElement).disabled) continue;

    // Skip submit buttons inside forms with `action=` — they would actually
    // POST somewhere. Plain submit buttons in client-only forms are fine.
    if (
      (btn as HTMLButtonElement).type === "submit" &&
      btn.closest("form")?.getAttribute("action")
    ) {
      continue;
    }

    const before = snapshotBody(doc);
    const errBefore = collectPreviewConsoleErrors(el).length;
    const ariaExpandedBefore = btn.getAttribute("aria-expanded");

    let threwSync = false;
    let syncError = "";
    try {
      btn.click();
    } catch (e: any) {
      threwSync = true;
      syncError = e?.message ?? String(e);
    }

    await new Promise((r) => setTimeout(r, PER_BUTTON_WAIT_MS));

    const after = snapshotBody(doc);
    const errAfter = collectPreviewConsoleErrors(el);
    const newErrors = errAfter.slice(errBefore);
    const ariaExpandedAfter = btn.getAttribute("aria-expanded");
    const navigated = (doc.location?.href ?? "") !== initialUrl;
    const ariaToggled = ariaExpandedBefore !== ariaExpandedAfter;
    const domChanged = before !== after;

    if (threwSync || newErrors.length > 0) {
      dead.push({
        ...desc,
        reason: "errored",
        errorMessage: syncError || newErrors[0],
      });
      continue;
    }

    if (!domChanged && !navigated && !ariaToggled) {
      dead.push({ ...desc, reason: "no-effect" });
    }

    // Best-effort cleanup: close any opened dialog so subsequent clicks
    // are not blocked. Press Escape inside the iframe.
    try {
      const ev = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
      doc.dispatchEvent(ev);
      await new Promise((r) => setTimeout(r, 60));
    } catch {
      /* noop */
    }
  }

  return {
    buttonsTested: buttons.length,
    dead,
    healPrompt: dead.length === 0 ? null : buildAuditHealPrompt(dead),
  };
}

function buildAuditHealPrompt(dead: DeadButton[]): string {
  const errored = dead.filter((d) => d.reason === "errored");
  const noEffect = dead.filter((d) => d.reason !== "errored");

  const lines: string[] = [
    "[INTERACTION AUDIT — runtime click probe found UI controls that don't work. Fix ALL of them in this turn so the user never sees a broken control in preview.]",
    "",
  ];

  if (errored.length > 0) {
    lines.push("Buttons that THREW a runtime error when clicked (highest priority):");
    errored.forEach((d, i) => {
      lines.push(`${i + 1}. "${d.label}" (${d.selector}) → ${d.errorMessage ?? "unknown error"}`);
    });
    lines.push("");
  }

  if (noEffect.length > 0) {
    lines.push("Buttons that produced NO observable effect (dead handler — wire them up):");
    noEffect.forEach((d, i) => {
      lines.push(`${i + 1}. "${d.label}" (${d.selector})`);
    });
    lines.push("");
  }

  lines.push(
    "Required fixes:",
    "- For each errored button: read the component, find the handler, fix the runtime error (null guard, missing import, undefined prop, etc.). Verify by reasoning through the click flow.",
    "- For each no-effect button: add a real onClick that produces a USER-VISIBLE result — update state (so the screen changes), open a dialog, navigate, call an API, or show a toast via `toast()` from `sonner`. Empty arrows (() => {}) are NOT acceptable.",
    "- Do NOT silence the issue by removing the button. Implement the missing behavior.",
    "- After fixing, re-read the affected files to confirm each handler is non-trivial and uses the surrounding state/router/api.",
  );

  return lines.join("\n");
}
