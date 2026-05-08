// Runtime FORM audit — fills every visible <form> in the preview iframe
// with realistic dummy data, submits it, and verifies that *something*
// actually happened (success toast, navigation, dialog opened, fields
// cleared, or visible "thank you / success" text).
//
// This catches the #1 "it's not functional" complaint:
//   - Forms whose submit button has no onSubmit handler at all
//   - Forms whose handler throws on real input
//   - Forms that look submitted but never confirm to the user
//
// Strategy per form:
//   1. Snapshot DOM + URL + console error count.
//   2. Fill each input/textarea/select with type-appropriate dummy data.
//   3. Dispatch input/change events so React state updates.
//   4. Click the submit button (or dispatch form 'submit').
//   5. Wait ~500ms.
//   6. Verdict:
//        - threw or new console error → "errored"
//        - DOM unchanged AND no nav AND no toast AND no fields cleared → "no-effect"
//        - else → "ok"
//
// Safety:
//   - Skip forms that look like LOGIN/SIGNUP against real backends
//     (action= on a different origin) — we only test client-side flows.
//   - Skip forms containing password+email pairs IF the page URL contains
//     "login" or "signin" (avoid lockouts).
//   - Hard cap: 5 forms, 6s total budget.

import { collectPreviewConsoleErrors } from "./visualReview";

export type FormFailure = {
  formLabel: string;
  selector: string;
  reason: "errored" | "no-effect" | "no-submit-button";
  errorMessage?: string;
  fieldCount: number;
};

export type FormAuditResult = {
  formsTested: number;
  failures: FormFailure[];
  healPrompt: string | null;
};

const MAX_FORMS = 5;
const TOTAL_BUDGET_MS = 6000;
const POST_SUBMIT_WAIT_MS = 500;

function getIframe(el: HTMLElement): { doc: Document; win: Window } | null {
  const iframe = el.querySelector("iframe") as HTMLIFrameElement | null;
  if (!iframe) return null;
  try {
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document ?? null;
    const win = iframe.contentWindow ?? null;
    if (!doc || !win) return null;
    return { doc, win };
  } catch {
    return null;
  }
}

function isVisible(el: Element): boolean {
  const r = (el as HTMLElement).getBoundingClientRect?.();
  if (!r || r.width < 4 || r.height < 4) return false;
  const style = (el.ownerDocument?.defaultView ?? window).getComputedStyle(el as HTMLElement);
  return style.visibility !== "hidden" && style.display !== "none";
}

function describeForm(form: HTMLFormElement): { formLabel: string; selector: string } {
  const heading =
    form.querySelector("h1, h2, h3, legend, [data-form-title]")?.textContent?.trim() ?? "";
  const submitText =
    form.querySelector('button[type="submit"], button:not([type])')?.textContent?.trim() ?? "";
  const label = (heading || submitText || form.getAttribute("name") || "(unnamed form)").slice(0, 60);
  let selector = "form";
  if (form.id) selector += `#${form.id}`;
  const cls = (form.className || "").toString().split(/\s+/).filter(Boolean).slice(0, 2).join(".");
  if (cls) selector += `.${cls}`;
  return { formLabel: label, selector };
}

function dummyFor(input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string | null {
  if (input.tagName === "SELECT") {
    const sel = input as HTMLSelectElement;
    const realOpt = Array.from(sel.options).find((o) => o.value && !o.disabled);
    return realOpt?.value ?? null;
  }
  const el = input as HTMLInputElement;
  const type = (el.type || "text").toLowerCase();
  const name = (el.name || el.id || el.placeholder || "").toLowerCase();

  if (type === "email" || /email/.test(name)) return "test+audit@example.com";
  if (type === "tel" || /phone|mobile/.test(name)) return "+15555550123";
  if (type === "url" || /url|website|link/.test(name)) return "https://example.com";
  if (type === "number") {
    const min = el.min ? Number(el.min) : 1;
    return String(Number.isFinite(min) ? min : 1);
  }
  if (type === "date") return new Date().toISOString().slice(0, 10);
  if (type === "time") return "12:00";
  if (type === "password") return "TestPass!234";
  if (type === "checkbox" || type === "radio") return "__TOGGLE__";
  if (type === "file" || type === "hidden" || type === "submit" || type === "button" || type === "reset") return null;
  if (/name/.test(name)) return "Test User";
  if (/message|comment|note|description|bio/.test(name) || el.tagName === "TEXTAREA") {
    return "This is an automated audit message to verify the form works.";
  }
  return "Test value";
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const proto = Object.getPrototypeOf(el);
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  const fn = setter && setter !== valueSetter ? setter : valueSetter;
  if (fn) fn.call(el, value);
  else (el as any).value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function fillForm(form: HTMLFormElement, win: Window): number {
  const fields = Array.from(
    form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input, textarea, select",
    ),
  ).filter(isVisible);
  let count = 0;
  for (const f of fields) {
    if ((f as HTMLInputElement).disabled || (f as HTMLInputElement).readOnly) continue;
    const v = dummyFor(f);
    if (v == null) continue;
    if (v === "__TOGGLE__") {
      const cb = f as HTMLInputElement;
      if (!cb.checked) {
        cb.checked = true;
        cb.dispatchEvent(new Event("click", { bubbles: true }));
        cb.dispatchEvent(new Event("change", { bubbles: true }));
      }
    } else {
      try { setNativeValue(f, v); } catch { /* ignore */ }
    }
    count += 1;
  }
  return count;
}

function shouldSkipForm(form: HTMLFormElement, doc: Document): boolean {
  // Skip cross-origin / real-action forms
  const action = form.getAttribute("action");
  if (action && /^https?:\/\//.test(action)) return true;
  // Skip login pages to avoid lockouts
  const url = doc.location?.href ?? "";
  const hasPwd = !!form.querySelector('input[type="password"]');
  const hasEmail = !!form.querySelector('input[type="email"], input[name*="email" i]');
  if (hasPwd && hasEmail && /(login|signin|sign-in|auth)/i.test(url)) return true;
  return false;
}

function snapshot(doc: Document, form: HTMLFormElement): string {
  const fieldVals = Array.from(form.querySelectorAll<HTMLInputElement>("input, textarea"))
    .map((i) => `${i.name || i.id}=${(i.value || "").length}`)
    .join("|");
  const toasts = doc.querySelectorAll('[role="status"], [role="alert"], [data-sonner-toast]').length;
  const dialogs = doc.querySelectorAll('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]').length;
  const successText = /thank you|success|submitted|received|we'll be in touch/i.test(doc.body?.innerText ?? "") ? 1 : 0;
  return `${doc.body?.innerHTML.length ?? 0}|${fieldVals}|${toasts}|${dialogs}|${successText}`;
}

export async function runFormAudit(el: HTMLElement): Promise<FormAuditResult> {
  const ctx = getIframe(el);
  if (!ctx) return { formsTested: 0, failures: [], healPrompt: null };
  const { doc, win } = ctx;

  const forms = Array.from(doc.querySelectorAll<HTMLFormElement>("form"))
    .filter(isVisible)
    .filter((f) => !shouldSkipForm(f, doc))
    .slice(0, MAX_FORMS);

  const failures: FormFailure[] = [];
  const start = Date.now();
  const initialUrl = doc.location?.href ?? "";

  for (const form of forms) {
    if (Date.now() - start > TOTAL_BUDGET_MS) break;
    const desc = describeForm(form);
    const fieldCount = fillForm(form, win);

    const submit = form.querySelector<HTMLButtonElement>(
      'button[type="submit"], input[type="submit"], button:not([type])',
    );

    const before = snapshot(doc, form);
    const errBefore = collectPreviewConsoleErrors(el).length;

    let threw = false;
    let errMsg = "";
    try {
      if (submit) {
        submit.click();
      } else {
        // No submit button at all — that's a defect on its own
        failures.push({ ...desc, reason: "no-submit-button", fieldCount });
        continue;
      }
    } catch (e: any) {
      threw = true;
      errMsg = e?.message ?? String(e);
    }

    await new Promise((r) => setTimeout(r, POST_SUBMIT_WAIT_MS));

    const after = snapshot(doc, form);
    const errAfter = collectPreviewConsoleErrors(el);
    const newErrors = errAfter.slice(errBefore);
    const navigated = (doc.location?.href ?? "") !== initialUrl;

    if (threw || newErrors.length > 0) {
      failures.push({ ...desc, reason: "errored", errorMessage: errMsg || newErrors[0], fieldCount });
      continue;
    }
    if (before === after && !navigated) {
      failures.push({ ...desc, reason: "no-effect", fieldCount });
    }
  }

  return {
    formsTested: forms.length,
    failures,
    healPrompt: failures.length === 0 ? null : buildPrompt(failures),
  };
}

function buildPrompt(failures: FormFailure[]): string {
  const lines: string[] = [
    "[FORM AUDIT — runtime form-submit probe filled and submitted forms in the preview. The following forms FAILED to confirm success to the user. Fix every one in this turn.]",
    "",
  ];
  const errored = failures.filter((f) => f.reason === "errored");
  const noEffect = failures.filter((f) => f.reason === "no-effect");
  const noSubmit = failures.filter((f) => f.reason === "no-submit-button");

  if (errored.length) {
    lines.push("Forms that THREW on submit (highest priority):");
    errored.forEach((f, i) =>
      lines.push(`${i + 1}. "${f.formLabel}" (${f.selector}) [${f.fieldCount} fields] → ${f.errorMessage ?? "unknown"}`),
    );
    lines.push("");
  }
  if (noEffect.length) {
    lines.push("Forms whose submit produced NO visible feedback (no toast, no nav, no dialog, no success text — user thinks the click did nothing):");
    noEffect.forEach((f, i) =>
      lines.push(`${i + 1}. "${f.formLabel}" (${f.selector}) [${f.fieldCount} fields]`),
    );
    lines.push("");
  }
  if (noSubmit.length) {
    lines.push("Forms with NO submit button at all:");
    noSubmit.forEach((f, i) =>
      lines.push(`${i + 1}. "${f.formLabel}" (${f.selector})`),
    );
    lines.push("");
  }

  lines.push(
    "Required fixes:",
    "- Wire a real onSubmit (or react-hook-form handleSubmit) on every failing form. The handler must (a) prevent default, (b) validate, (c) call the appropriate API or update state, and (d) ALWAYS confirm to the user — call `toast.success(...)` from `sonner`, navigate, open a confirmation dialog, or render a success state. Silent submits are unacceptable.",
    "- For errored forms: read the component, fix the runtime error (null guard, missing import, undefined prop, schema mismatch).",
    "- For forms with no submit button: add a `<Button type=\"submit\">` with sensible label.",
    "- Do NOT delete the form to silence the audit. Implement the missing behavior end-to-end.",
    "- After fixing, re-read the affected files to confirm the handler does real work.",
  );
  return lines.join("\n");
}
