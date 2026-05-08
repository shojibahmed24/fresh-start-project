// Structural completeness validator for scratch builds.
//
// Vision-model (scoreVisualReview) catches design problems but cannot tell us
// whether the agent actually wrote a real app. This file does cheap text-level
// checks on the generated files and returns a list of human-readable failures
// + a polish prompt the heal loop can feed back to the agent.
//
// Triggers an extra heal turn when ANY of these are missing:
//   1. Component count  — at least 10 .tsx/.jsx files (incl. pages + components)
//   2. <img> usage      — at least one <img …/> tag OR an asset import
//   3. useState usage   — at least one React useState/useReducer call
//   4. Header/nav       — at least one <header>, <nav>, or component named
//                         Header/Navbar/BottomNav/TabBar/Sidebar
//
// Used only on scratch builds — edit runs touch a tiny surface and would
// always fail these checks.
//
// Keep this file dependency-free + under 200 lines.

export type CompletenessCheck = {
  id:
    | "componentCount"
    | "images"
    | "useState"
    | "headerNav"
    | "deadHandlers";
  label: string;
  passed: boolean;
  detail: string;
};

export type CompletenessResult = {
  passed: boolean;
  checks: CompletenessCheck[];
  failed: CompletenessCheck[];
  /** Prompt fragment to append to the heal turn when failed.length > 0. */
  healPrompt: string | null;
};

type FileLike = { path: string; content?: string };

const COMPONENT_EXT = /\.(tsx|jsx)$/i;
const HEADER_NAME =
  /\b(Header|NavBar|Navbar|TopBar|BottomNav|TabBar|Sidebar|AppBar|MobileNav)\b/;
const HEADER_TAG = /<\s*(header|nav)\b/i;
const IMG_TAG = /<\s*img\b/i;
const ASSET_IMPORT =
  /\bfrom\s+["'][^"']+\.(png|jpe?g|webp|svg|avif|gif)["']/i;
const USE_STATE = /\buseState\s*</; // generic call captures useState<...>(
const USE_STATE_ANY = /\buse(State|Reducer)\s*\(/;

export function checkCompleteness(files: FileLike[]): CompletenessResult {
  // Only consider source code files we generated.
  const codeFiles = files.filter(
    (f) => f.path?.startsWith("src/") && COMPONENT_EXT.test(f.path),
  );

  // 1. Component count — pages + components together.
  const componentCount = codeFiles.length;
  const componentCheck: CompletenessCheck = {
    id: "componentCount",
    label: "Component count",
    passed: componentCount >= 10,
    detail: `${componentCount} .tsx/.jsx files in src/ (need ≥ 10)`,
  };

  // 2. Images — at least one <img/> or asset import in any file.
  const imagesPresent = codeFiles.some(
    (f) => IMG_TAG.test(f.content ?? "") || ASSET_IMPORT.test(f.content ?? ""),
  );
  const imageCheck: CompletenessCheck = {
    id: "images",
    label: "Image usage",
    passed: imagesPresent,
    detail: imagesPresent
      ? "Found <img> tag or asset import"
      : "No <img> tag or image asset import found anywhere",
  };

  // 3. useState — at least one useState/useReducer call.
  const useStatePresent = codeFiles.some(
    (f) =>
      USE_STATE.test(f.content ?? "") || USE_STATE_ANY.test(f.content ?? ""),
  );
  const stateCheck: CompletenessCheck = {
    id: "useState",
    label: "Interactive state",
    passed: useStatePresent,
    detail: useStatePresent
      ? "Found useState/useReducer call"
      : "No useState or useReducer found — app appears static",
  };

  // 4. Header / nav — by tag OR by component name.
  const headerPresent = codeFiles.some((f) => {
    const c = f.content ?? "";
    return HEADER_TAG.test(c) || HEADER_NAME.test(c) || HEADER_NAME.test(f.path);
  });
  const headerCheck: CompletenessCheck = {
    id: "headerNav",
    label: "Header / navigation",
    passed: headerPresent,
    detail: headerPresent
      ? "Found <header>/<nav> or Header/Navbar/BottomNav component"
      : "No header, nav, or navigation component detected",
  };

  // 5. Dead handlers — buttons/forms with no onClick/onSubmit, or handlers
  //    that are obvious no-ops (TODO / empty arrow / null). Catches the
  //    "AI shipped a UI without wiring it up" failure mode.
  const deadHandlers = findDeadHandlers(codeFiles);
  const handlerCheck: CompletenessCheck = {
    id: "deadHandlers",
    label: "Interactive handlers",
    passed: deadHandlers.length === 0,
    detail:
      deadHandlers.length === 0
        ? "All buttons / forms appear wired"
        : `${deadHandlers.length} button(s)/form(s) without working handlers: ${deadHandlers.slice(0, 4).join("; ")}${deadHandlers.length > 4 ? "; …" : ""}`,
  };

  const checks = [componentCheck, imageCheck, stateCheck, headerCheck, handlerCheck];
  const failed = checks.filter((c) => !c.passed);

  return {
    passed: failed.length === 0,
    checks,
    failed,
    healPrompt: failed.length === 0 ? null : buildHealPrompt(failed),
  };
}

// ── Static handler audit ────────────────────────────────────────────────
// We scan only JSX-looking lines. A handler is "dead" when:
//   - <button …> has no onClick=  AND  no type="submit"  AND  no asChild
//   - onClick={() => {}} / onClick={()=>null} / onClick={undefined}
//   - <form …> has no onSubmit=
// The check is fuzzy on purpose — false positives auto-resolve when the
// agent adds a handler in the heal turn; false negatives are caught by
// the runtime click probe.
const BUTTON_TAG = /<button\b[^>]*>/gi;
const FORM_TAG = /<form\b[^>]*>/gi;
const HAS_ONCLICK = /\bon(Click|Press|Tap|Change|Select|Toggle)\s*=/i;
const HAS_ONSUBMIT = /\bonSubmit\s*=/i;
const SUBMIT_TYPE = /\btype\s*=\s*["']submit["']/i;
const AS_CHILD = /\basChild\b/i;
const HREF_ATTR = /\bhref\s*=/i;
const TO_ATTR = /\bto\s*=/i;
const DISABLED_ATTR = /\bdisabled\b/i;
const NOOP_HANDLER =
  /on(Click|Press|Submit|Change)\s*=\s*\{\s*(\(\s*\)\s*=>\s*(\{\s*\}|null|undefined|void\s+0)|undefined|null)\s*\}/i;
// `// TODO` inside an arrow handler body
const TODO_HANDLER = /on(Click|Press|Submit)\s*=\s*\{\s*\(\s*\)\s*=>\s*\{\s*\/\/\s*TODO/i;

function findDeadHandlers(files: FileLike[]): string[] {
  const findings: string[] = [];
  for (const f of files) {
    const c = f.content ?? "";
    if (!c) continue;
    const shortPath = f.path.replace(/^src\//, "");

    // No-op / TODO handlers anywhere.
    let m: RegExpExecArray | null;
    const noopRe = new RegExp(NOOP_HANDLER.source, "gi");
    while ((m = noopRe.exec(c)) !== null) {
      findings.push(`${shortPath}: no-op ${m[0].slice(0, 60)}`);
      if (findings.length > 20) return findings;
    }
    const todoRe = new RegExp(TODO_HANDLER.source, "gi");
    while ((m = todoRe.exec(c)) !== null) {
      findings.push(`${shortPath}: TODO handler ${m[0].slice(0, 60)}`);
      if (findings.length > 20) return findings;
    }

    // <button> without onClick / submit / asChild.
    BUTTON_TAG.lastIndex = 0;
    while ((m = BUTTON_TAG.exec(c)) !== null) {
      const tag = m[0];
      if (HAS_ONCLICK.test(tag)) continue;
      if (SUBMIT_TYPE.test(tag)) continue;
      if (AS_CHILD.test(tag)) continue;
      if (DISABLED_ATTR.test(tag)) continue;
      findings.push(`${shortPath}: <button> with no onClick`);
      if (findings.length > 20) return findings;
    }

    // <form> without onSubmit AND no <button type="submit"> nearby.
    FORM_TAG.lastIndex = 0;
    while ((m = FORM_TAG.exec(c)) !== null) {
      const tag = m[0];
      if (HAS_ONSUBMIT.test(tag) || HAS_ONCLICK.test(tag)) continue;
      // crude lookahead — next 600 chars after the form opening
      const after = c.slice(m.index, m.index + 600);
      if (SUBMIT_TYPE.test(after)) continue;
      findings.push(`${shortPath}: <form> with no onSubmit`);
      if (findings.length > 20) return findings;
    }

    // Suppress: anchors / Link with href/to are not "dead" — skipped above
    // because we only target <button> + <form>.
    void HREF_ATTR; void TO_ATTR;
  }
  return findings;
}

function buildHealPrompt(failed: CompletenessCheck[]): string {
  const lines = failed.map((f, i) => `${i + 1}. ${f.label} — ${f.detail}`);
  return [
    "[COMPLETENESS HEAL — the scratch build is incomplete. Fix ALL of the issues below in this turn.]",
    "",
    "Failed checks:",
    ...lines,
    "",
    "Required fixes:",
    "- If component count is low: split large pages into smaller feature components under src/components/<feature>/ until you have at least 10 .tsx files.",
    "- If images are missing: add real images (use <img> with unsplash.com URLs or generate assets) in the hero, cards, avatars, or empty-states wherever it makes sense.",
    "- If useState is missing: wire up real interactivity — at minimum a working filter, modal, tab, cart, or form state.",
    "- If header/nav is missing: add a proper <Header/> (top bar) and/or <BottomNav/> (mobile) component used by the main page.",
    "- If interactive handlers are missing: every <button> must have a real onClick (or be type=\"submit\" inside a <form onSubmit>). Every <form> must have onSubmit that actually does something — update state, call an API, show a toast, navigate. Replace any `() => {}`, `() => null`, or `// TODO` handlers with real logic. Wire all CTAs end-to-end so clicking them produces a visible result (state change, toast, navigation, modal, etc.).",
    "",
    "Do NOT just rename files — actually add the missing capability.",
  ].join("\n");
}
