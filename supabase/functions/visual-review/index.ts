// Visual feedback loop with SCORING (Phase 2 of the design framework).
//
// Two modes:
//   1. Legacy advisory: returns { issues, summary } — used by manual review.
//   2. Scoring mode (mode: "score"): also returns a 0-50 rubric score across
//      5 categories + a `polishPrompt` the client can feed back into the
//      ai-agent to auto-fix the worst offenders. Used by the auto-polish loop.
//
// Rubric (each 0-10):
//   - hierarchy:   typography scale, spacing, visual focus
//   - color:       palette cohesion, contrast, vibe match
//   - layout:      grids, alignment, breathing room, no broken edges
//   - polish:      shadows, gradients, icons, motion-readiness, no plain divs
//   - completeness: hero/CTA present, navigation clear, content not bare list

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VISION_MODEL = "google/gemini-2.5-flash";
const GATEWAY = "https://openrouter.ai/api/v1/chat/completions";

type Mode = "advisory" | "score";

interface VisualReviewBody {
  screenshot: string;
  viewportWidth?: number;
  viewportHeight?: number;
  appDescription?: string;
  filePaths?: string[];
  mode?: Mode;          // default "advisory" for back-compat
  domainHint?: string;  // e.g. "podcast", "ecommerce" — sharpens the rubric
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth check — prevents anonymous OpenRouter credit drain ──
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return json({ error: "Sign in required." }, 401);
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) {
      return json({ error: "OPENROUTER_API_KEY not configured" }, 500);
    }

    const body = (await req.json()) as VisualReviewBody;
    if (!body.screenshot || !body.screenshot.startsWith("data:image/")) {
      return json({ error: "screenshot must be a data:image/...;base64 URL" }, 400);
    }

    const mode: Mode = body.mode === "score" ? "score" : "advisory";
    const w = body.viewportWidth ?? 390;
    const h = body.viewportHeight ?? 844;
    const desc = body.appDescription?.trim() || "(no description provided)";
    const domain = body.domainHint?.trim() || "";

    const systemPrompt = mode === "score"
      ? scoringSystemPrompt(w, h, domain)
      : advisorySystemPrompt(w, h);

    const userText = mode === "score"
      ? `App description: ${desc}\n${domain ? `Detected domain: ${domain}\n` : ""}\nScore the screenshot honestly. Most AI-generated first drafts score 20-30. Be a strict reviewer — only score 40+ if it would convincingly pass for a published app on the App Store.`
      : `App description: ${desc}\n\nReview the screenshot and report concrete visual problems. If the app looks fine, return { "summary": "Looks good — no visual issues detected.", "issues": [] }.`;

    const resp = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://lovable.dev",
        "X-Title": "Lovable Visual Review",
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: body.screenshot } },
            ],
          },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (resp.status === 429) return json({ error: "Rate limit reached on OpenRouter." }, 429);
    if (resp.status === 402) return json({ error: "OpenRouter credits exhausted." }, 402);
    if (!resp.ok) {
      const t = await resp.text();
      console.error("vision gateway error", resp.status, t);
      return json({ error: `Vision model error (${resp.status})` }, 500);
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";

    let parsed: any;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      const cleaned = String(raw).replace(/```json|```/g, "").trim();
      try { parsed = JSON.parse(cleaned); } catch { parsed = {}; }
    }

    if (mode === "score") {
      const scores = {
        hierarchy: clamp(parsed.scores?.hierarchy),
        color: clamp(parsed.scores?.color),
        layout: clamp(parsed.scores?.layout),
        polish: clamp(parsed.scores?.polish),
        completeness: clamp(parsed.scores?.completeness),
      };
      const total = scores.hierarchy + scores.color + scores.layout + scores.polish + scores.completeness;
      const issues = normalizeIssues(parsed.issues);
      const polishPrompt = buildPolishPrompt(total, scores, issues, domain);
      const errorCount = issues.filter((i) => i.severity === "error").length;
      return json({
        mode: "score",
        scores,
        total,
        max: 50,
        passed: total >= 35 && errorCount === 0,
        summary: String(parsed.summary ?? "").trim() || "Scored.",
        issues,
        polishPrompt,
        model: VISION_MODEL,
      });
    }

    // Advisory mode (legacy)
    return json({
      summary: String(parsed.summary ?? "").trim() || "Review complete.",
      issues: normalizeIssues(parsed.issues),
      model: VISION_MODEL,
    });
  } catch (e) {
    console.error("visual-review error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function advisorySystemPrompt(w: number, h: number) {
  return `You are a senior mobile-app design reviewer. You will be shown a screenshot of an in-progress preview at viewport ${w}×${h}.
Identify SPECIFIC, ACTIONABLE visual issues a code-only validator cannot see:
- Text overlapping other text or images
- **Bottom-nav overlap** — the LAST visible content (text, list item, button) merges with or sits behind the bottom navigation bar so the user cannot read both. This is the #1 reported mobile bug. Flag it as severity=error with the suggestion "Add pb-[calc(64px+env(safe-area-inset-bottom)+16px)] to the scrollable container so content clears the nav."
- **Sticky header overlap** — content scrolls under a transparent header and the title becomes unreadable.
- Content extending off-screen / cut off (right/bottom edge)
- Missing or invisible CTAs (no obvious primary button)
- Broken alignment, weirdly large/small text, illegible contrast
- Empty white blocks where content should be
- Multiple tab bars, duplicated headers, broken layout grids
- Content that clearly contradicts the app's purpose
- **Hardcoded grayscale** — pure white text on light bg, pure black on dark bg, or any text that visually looks like text-gray-300/400 on dark surfaces (low contrast). Flag with suggestion "Replace with text-foreground / text-muted-foreground semantic tokens."

DO NOT report:
- Pure code/architecture concerns
- Generic style suggestions ("could be more colorful")
- Anything you cannot clearly see in the screenshot

For EACH issue return: severity (error|warn), message (what's wrong, where), suggestion (one specific fix).
Output ONLY a JSON object: { "summary": "...", "issues": [...] }. No markdown fences.`;
}

function scoringSystemPrompt(w: number, h: number, domain: string) {
  const domainLine = domain
    ? `\nDOMAIN CONTEXT: This app is in the "${domain}" category. Score "completeness" against the patterns expected for that domain (e.g. podcast → mini-player + show carousels; banking → balance card + transactions; ecommerce → product grid + cart).`
    : "";
  return `You are a STRICT senior product designer reviewing a screenshot of a generated app at ${w}×${h}.

Score the screenshot on FIVE categories, each 0-10, using this scale:
  0-2  = broken / missing / placeholder text everywhere
  3-4  = generic AI default (plain divs, no hierarchy, white-on-white)
  5-6  = functional but unremarkable (basic styling, some spacing)
  7-8  = polished, intentional design (real hierarchy, cohesive palette, signature elements)
  9-10 = App-Store-quality, would not look out of place in a published app
${domainLine}

Categories:
  hierarchy:    Typography scale, weight contrast, clear primary/secondary/tertiary, focal point
  color:        Palette cohesion (≤4 main colors), contrast/legibility, vibe matches the app's purpose
  layout:       Grid alignment, breathing room, no edge-cutoff, no overlapping elements, BOTTOM-NAV NEVER overlapping the last item, sticky headers opaque enough that content doesn't bleed through. Score 0-3 if last visible content sits under or merges with the bottom nav.
  polish:       Shadows, gradients, real icons, refined buttons/cards — NOT plain bordered divs
  completeness: Hero/feature card present, clear CTA, navigation visible, content is not just a bullet list of strings

Then list up to 5 SPECIFIC issues (severity error|warn, message, suggestion) — concrete things to fix. Always include any bottom-nav overlap as severity=error with suggestion "Add pb-[calc(64px+env(safe-area-inset-bottom)+16px)] to the scrollable area so the last item clears the nav." If total is ≥40, issues can be empty.

Output ONLY this JSON shape, no markdown fences:
{
  "scores": { "hierarchy": <0-10>, "color": <0-10>, "layout": <0-10>, "polish": <0-10>, "completeness": <0-10> },
  "summary": "<one-sentence verdict>",
  "issues": [{ "severity": "error|warn", "message": "...", "suggestion": "..." }]
}`;
}

function clamp(n: any): number {
  const v = typeof n === "number" ? n : parseInt(String(n ?? 0), 10);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(10, Math.round(v)));
}

function normalizeIssues(raw: any) {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((i: any) => ({
      severity: i.severity === "error" ? "error" : "warn",
      message: String(i.message ?? "").trim(),
      suggestion: String(i.suggestion ?? "").trim(),
    }))
    .filter((i: any) => i.message.length > 0);
}

function buildPolishPrompt(
  total: number,
  scores: Record<string, number>,
  issues: { severity: string; message: string; suggestion: string }[],
  domain: string,
): string | null {
  // Trigger a polish pass if EITHER the score is below threshold OR there is
  // at least one error-severity visual issue. Previously we only polished on
  // sub-35 scores — that meant a build could "pass" with a 36 score while
  // still shipping with bottom-nav overlap or unreadable text. Vision-detected
  // ERRORS now always get a feedback turn.
  const errorIssues = issues.filter((i) => i.severity === "error");
  if (total >= 35 && errorIssues.length === 0) return null;

  // Identify the 2 worst-scoring categories — focus the polish there.
  const ranked = Object.entries(scores).sort((a, b) => a[1] - b[1]);
  const weakest = ranked.slice(0, 2).map(([k, v]) => `${k} (${v}/10)`);

  // Errors first, then warns, capped at 6 total. Each line is concrete.
  const sortedIssues = [
    ...errorIssues,
    ...issues.filter((i) => i.severity !== "error"),
  ].slice(0, 6);
  const issueLines = sortedIssues
    .map((i, idx) => `${idx + 1}. [${i.severity.toUpperCase()}] ${i.message} → ${i.suggestion}`)
    .join("\n");

  const header = total >= 35
    ? `[VISUAL REVIEW — score ${total}/50 passed, but the screenshot shows ${errorIssues.length} concrete error${errorIssues.length === 1 ? "" : "s"} that must be fixed before this build is shippable.`
    : `[AUTO-POLISH PASS — visual review scored this build ${total}/50, below the 35 threshold.`;

  return `${header}

Weakest areas: ${weakest.join(", ")}.

Concrete issues the vision model flagged in the screenshot:
${issueLines || "(no specific issues — focus on the weakest categories above)"}

Polish pass directives:
- Do NOT rewrite the app from scratch. Edit the existing components.
- Fix every ERROR-severity item above first — those are visible bugs (overlap, cutoff, unreadable text).
- Then improve the weakest categories. If polish is low, add real shadows / gradients / icons (lucide-react) to cards and buttons. If hierarchy is low, increase typography scale contrast (e.g. text-3xl headings, text-sm muted captions). If layout is low, add padding/gaps and fix alignment. If color is low, commit to a 3-color palette in index.css and use it consistently. If completeness is low, add the missing hero/CTA/navigation expected for ${domain || "this kind of app"}.
- Touch only the components that need fixing. Use read_file before editing existing files.
- After fixes, write a short summary noting what you polished.]`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
