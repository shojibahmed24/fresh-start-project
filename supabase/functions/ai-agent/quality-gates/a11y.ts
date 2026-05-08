// ═══════════════════════════════════════════════════════════════════════════
// A11Y GATE — axe-core-inspired heuristics on JSX (regex, no AST)
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolContext, GateFinding, GateResult } from "../types.ts";
import { normalizePath } from "../validation/parsers.ts";

export function a11yScanFile(path: string, content: string): GateFinding[] {
  const findings: GateFinding[] = [];
  if (!/\.(tsx|jsx)$/.test(path)) return findings;

  // <img> without alt
  const imgRe = /<img\b([^>]*)\/?>/gi;
  let im: RegExpExecArray | null;
  while ((im = imgRe.exec(content)) !== null) {
    const attrs = im[1];
    if (!/\balt\s*=/.test(attrs)) {
      findings.push({
        path,
        rule: "img-alt",
        severity: "error",
        problem: "<img> missing `alt` attribute",
        hint: 'Add `alt="…"` describing the image, or `alt=""` for purely decorative images.',
      });
    }
  }

  // <a> without href
  const anchorRe = /<a\b([^>]*)>/gi;
  let am: RegExpExecArray | null;
  while ((am = anchorRe.exec(content)) !== null) {
    const attrs = am[1];
    if (!/\bhref\s*=/.test(attrs)) {
      findings.push({
        path,
        rule: "anchor-has-href",
        severity: "warn",
        problem: "<a> missing `href` — use a <button> instead for actions",
        hint: "Anchors without href are not focusable / not announced as links.",
      });
    }
  }

  // <button> without text and without aria-label (icon-only buttons)
  const btnRe = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
  let bm: RegExpExecArray | null;
  while ((bm = btnRe.exec(content)) !== null) {
    const attrs = bm[1];
    const inner = bm[2].trim();
    const hasAria = /\baria-label\s*=/.test(attrs) || /\baria-labelledby\s*=/.test(attrs);
    const visibleText = inner.replace(/<[^>]+>/g, "").replace(/\{[^}]*\}/g, "").trim();
    if (!hasAria && !visibleText) {
      findings.push({
        path,
        rule: "button-name",
        severity: "error",
        problem: "Icon-only <button> missing `aria-label`",
        hint: 'Add `aria-label="Close"` (or similar) so screen readers announce the action.',
      });
    }
  }

  // <input> without label/aria
  const inputRe = /<input\b([^>]*)\/?>/gi;
  let inpm: RegExpExecArray | null;
  while ((inpm = inputRe.exec(content)) !== null) {
    const attrs = inpm[1];
    const type = attrs.match(/\btype\s*=\s*["']([^"']+)["']/)?.[1];
    if (type === "hidden" || type === "submit" || type === "button") continue;
    const hasAria = /\baria-label\s*=/.test(attrs) || /\baria-labelledby\s*=/.test(attrs) || /\bid\s*=/.test(attrs);
    if (!hasAria) {
      findings.push({
        path,
        rule: "label-has-associated-control",
        severity: "warn",
        problem: "<input> has no `id`/`aria-label` — likely no accessible label",
        hint: "Either wrap with <label> + matching id, or add `aria-label`.",
      });
    }
  }

  // role="button" without keyboard handler
  if (/role\s*=\s*["']button["']/.test(content) && !/onKey(Down|Press|Up)\s*=/.test(content)) {
    findings.push({
      path,
      rule: "interactive-supports-focus",
      severity: "warn",
      problem: "Element with role='button' but no keyboard handler",
      hint: "Add `onKeyDown` to handle Enter/Space, or use a real <button>.",
    });
  }

  // <html> lang (only meaningful in index.html)
  if (/index\.html$/.test(path) && /<html[^>]*>/i.test(content) && !/<html[^>]*\blang\s*=/i.test(content)) {
    findings.push({
      path,
      rule: "html-has-lang",
      severity: "error",
      problem: "<html> missing `lang` attribute",
      hint: 'Add `lang="en"` (or appropriate language code) to <html>.',
    });
  }

  // tabindex > 0
  if (/\btabIndex\s*=\s*\{?\s*["']?[1-9]/.test(content)) {
    findings.push({
      path,
      rule: "no-positive-tabindex",
      severity: "warn",
      problem: "Positive tabIndex disrupts natural tab order",
      hint: "Use tabIndex={0} or tabIndex={-1} only.",
    });
  }

  // autoFocus (disorienting for screen readers)
  if (/\bautoFocus\b/.test(content)) {
    findings.push({
      path,
      rule: "no-autofocus",
      severity: "info",
      problem: "`autoFocus` can disorient screen-reader users",
      hint: "Use only on a primary input where focus is genuinely expected (e.g. modal search).",
    });
  }

  return findings;
}

export async function runA11yGate(ctx: ToolContext, filterPaths?: string[]): Promise<GateResult> {
  const { data } = await ctx.supabase
    .from("project_files")
    .select("path, content")
    .eq("project_id", ctx.projectId);
  const rows = (data ?? []) as { path: string; content: string }[];
  const filterSet = filterPaths
    ? new Set(filterPaths.map((p) => normalizePath(p)))
    : null;
  const findings: GateFinding[] = [];
  let checked = 0;
  for (const r of rows) {
    if (filterSet && !filterSet.has(normalizePath(r.path))) continue;
    if (!/\.(tsx|jsx|html)$/.test(r.path)) continue;
    checked++;
    findings.push(...a11yScanFile(r.path, r.content));
  }
  return {
    name: "a11y",
    ok: !findings.some((f) => f.severity === "error"),
    findings,
    checked,
  };
}
