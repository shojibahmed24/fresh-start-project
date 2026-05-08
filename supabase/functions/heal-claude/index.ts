// Layer-2 heal: when the auto-heal loop is about to give up, this function
// asks Claude (via OpenRouter) to deeply review the suspected file using the
// runtime error context and returns a corrected full-file rewrite.
//
// Phase 3 upgrades:
//  - Inject prior failed-fix history for this project/file into the prompt
//    so Claude does not repeat strategies that have already failed.
//  - Iterative refinement: up to 3 passes; after each pass we run lightweight
//    structural validation (balanced brackets, no forbidden imports, JSX
//    sanity, default export when required). On failure we feed the validator
//    diagnostics back to Claude and ask for another pass.
//  - On success, write a row into `project_error_history` so future runs
//    (both heal-claude and ai-agent) can learn from this fix.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY = "https://openrouter.ai/api/v1/chat/completions";
// Default heal model — used when caller doesn't pass an override.
// Claude fallback disabled per user preference; uses the same default as the
// main agent so heals respect the user's model selection.
const DEFAULT_MODEL = "google/gemini-2.5-flash";
const MAX_PASSES = 3;

// Pass 1 — full system prompt (rules + runtime safety guidance).
const SYSTEM_PROMPT_FULL = `You are an expert React + TypeScript + Vite mobile-app code reviewer.
You receive a single TSX/TS file that crashed the live preview at runtime, plus the runtime error and stack.

Your job: return ONLY the corrected full file content — no markdown, no fences, no explanation.

Hard rules:
- Keep the file's original intent, structure, and styling. Do NOT rewrite from scratch.
- Allowed imports ONLY: react, react-dom, lucide-react, framer-motion, and relative imports (./, ../).
- Forbidden: next/*, react-router*, react-native*, @supabase/*, axios, node built-ins, image URLs.
- Functional components only. Hooks at top level only.
- Balanced brackets, closed JSX tags, className/htmlFor, semicolons.
- Default-export the main component when the file is /src/App.tsx, /src/screens/* or /src/components/*.

RUNTIME SAFETY (this is the whole point — apply aggressively):
- Hook destructuring MUST have defaults:
    const { balance = 0, transactions = [], user = null } = useXxx()
- Array methods on uncertain values MUST be guarded:
    BAD: items.map(...)        GOOD: (items ?? []).map(...)
- Number methods on uncertain values MUST be guarded:
    BAD: balance.toFixed(2)    GOOD: (balance ?? 0).toFixed(2)
- .length on uncertain values MUST use optional chaining:
    BAD: items.length          GOOD: items?.length ?? 0
- Object property access MUST use optional chaining when the object can be null/undefined:
    BAD: user.name             GOOD: user?.name ?? ""
- Component props receiving uncertain data must default in the signature:
    BAD: function List({ items })   GOOD: function List({ items = [] })

Return the corrected file content as raw text. NOTHING ELSE.`;

// Pass 2+ — brief system prompt (model has rules in context from pass 1).
// Saves ~350 tokens per refinement pass (~700 tokens across passes 2 & 3).
const SYSTEM_PROMPT_BRIEF = `Continue fixing the same file. Same rules as pass 1: keep original intent, allowed imports only, runtime safety guards on uncertain values. Return raw corrected file content only — no fences, no explanation.`;

const SYSTEM_PROMPT = SYSTEM_PROMPT_FULL;

function stripFences(raw: string): string {
  let s = raw.trim();
  const fence = s.match(/^```(?:tsx?|jsx?|typescript|javascript)?\s*\n([\s\S]*?)\n```$/);
  if (fence) s = fence[1];
  return s.trim();
}

// ---------- structural validator ----------
function validateFile(filePath: string, content: string): string[] {
  const issues: string[] = [];
  if (!content || content.length < 20) {
    issues.push("File content is empty or too short.");
    return issues;
  }

  // Bracket balance
  const pairs: Array<[string, string]> = [["{", "}"], ["(", ")"], ["[", "]"]];
  for (const [open, close] of pairs) {
    const o = (content.match(new RegExp(`\\${open}`, "g")) || []).length;
    const c = (content.match(new RegExp(`\\${close}`, "g")) || []).length;
    if (o !== c) issues.push(`Unbalanced ${open}${close}: ${o} open vs ${c} close.`);
  }

  // Forbidden imports
  const forbidden = [
    /from\s+['"]next\//,
    /from\s+['"]react-router/,
    /from\s+['"]react-native/,
    /from\s+['"]@supabase\//,
    /from\s+['"]axios['"]/,
    /from\s+['"]fs['"]/,
    /from\s+['"]path['"]/,
  ];
  for (const re of forbidden) {
    if (re.test(content)) issues.push(`Forbidden import detected: ${re}`);
  }

  // Allowed imports only
  const importLines = content.match(/from\s+['"][^'"]+['"]/g) || [];
  for (const line of importLines) {
    const m = line.match(/from\s+['"]([^'"]+)['"]/);
    if (!m) continue;
    const spec = m[1];
    const ok =
      spec.startsWith("./") ||
      spec.startsWith("../") ||
      spec === "react" ||
      spec === "react-dom" ||
      spec === "lucide-react" ||
      spec === "framer-motion" ||
      spec.startsWith("react/") ||
      spec.startsWith("react-dom/");
    if (!ok) issues.push(`Disallowed import path: "${spec}".`);
  }

  // Default export when required
  const requiresDefault =
    /^\/?src\/App\.tsx$/.test(filePath) ||
    /^\/?src\/screens\//.test(filePath) ||
    /^\/?src\/components\//.test(filePath);
  if (requiresDefault && !/export\s+default\s+/.test(content)) {
    issues.push(`Missing "export default" in ${filePath}.`);
  }

  // Naive JSX tag balance check (only when JSX clearly present)
  if (/<[A-Za-z][\w.-]*[\s/>]/.test(content)) {
    // self-closing or void are fine; this is a soft heuristic, just flag obvious mismatch
    const opens = (content.match(/<[A-Za-z][\w.-]*(?=[\s/>])/g) || []).length;
    const closes = (content.match(/<\/[A-Za-z][\w.-]*\s*>/g) || []).length;
    const selfClose = (content.match(/\/>/g) || []).length;
    // opens should ≈ closes + selfClose (fragment <> </> ignored)
    const diff = opens - closes - selfClose;
    if (Math.abs(diff) > 4) {
      issues.push(`Possible unclosed JSX tags (open=${opens}, close=${closes}, selfClose=${selfClose}).`);
    }
  }

  return issues;
}

// Per-call upstream timeout. Supabase edge functions die at 150s idle.
// With up to 3 passes × up to 3 attempts each, we MUST cap each call so the
// total stays under the wall budget below.
const PER_CALL_TIMEOUT_MS = 35_000;
// Hard wall budget for the whole heal request — leaves >30s headroom under 150s.
const TOTAL_BUDGET_MS = 115_000;

async function callModel(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens = 4000,
): Promise<{ ok: true; text: string } | { ok: false; status: number; error: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PER_CALL_TIMEOUT_MS);
  let resp: Response;
  try {
    resp = await fetch(GATEWAY, {
    signal: ctrl.signal,
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://lovable.dev",
      "X-Title": "Lovable Heal Layer 2",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: maxTokens,
      // Anthropic prompt caching via OpenRouter: wrap the system message
      // content in a block array with cache_control. The system prompt
      // (SYSTEM_PROMPT_FULL ~500 tokens) is identical across every heal
      // call within a 5-min window, so cached reads cost ~10% of normal
      // input tokens. Other messages stay as plain strings (they vary).
      messages: messages.map((m, i) => {
        if (i === 0 && m.role === "system" && typeof m.content === "string" && m.content.length > 200) {
          return {
            role: "system",
            content: [
              { type: "text", text: m.content, cache_control: { type: "ephemeral" } },
            ],
          };
        }
        return m;
      }),
    }),
  });
  } catch (e: any) {
    clearTimeout(timer);
    const aborted = e?.name === "AbortError";
    return { ok: false, status: aborted ? 504 : 502, error: aborted ? `timeout after ${PER_CALL_TIMEOUT_MS}ms` : (e?.message ?? String(e)) };
  }
  clearTimeout(timer);
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    return { ok: false, status: resp.status, error: txt.slice(0, 200) };
  }
  const data = await resp.json();
  const raw: string | undefined = data?.choices?.[0]?.message?.content;
  if (!raw || typeof raw !== "string") {
    return { ok: false, status: 502, error: "Empty response" };
  }
  return { ok: true, text: stripFences(raw) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

    if (!OPENROUTER_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const {
      projectId,
      filePath,
      errorMessage,
      errorStack,
      componentStack,
      errorLine,
      errorColumn,
      model: requestedModel,
    } = body ?? {};

    const model =
      typeof requestedModel === "string" && requestedModel.trim()
        ? requestedModel.trim()
        : DEFAULT_MODEL;

    if (!projectId || !filePath) {
      return new Response(
        JSON.stringify({ error: "projectId and filePath required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: project, error: projErr } = await admin
      .from("projects")
      .select("id, user_id")
      .eq("id", projectId)
      .maybeSingle();
    if (projErr || !project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (project.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: fileRow, error: fileErr } = await admin
      .from("project_files")
      .select("id, content")
      .eq("project_id", projectId)
      .eq("path", filePath)
      .maybeSingle();
    if (fileErr || !fileRow) {
      return new Response(JSON.stringify({ error: `File not found: ${filePath}` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const brokenContent = String(fileRow.content ?? "");
    if (brokenContent.length < 10) {
      return new Response(JSON.stringify({ error: "File too short to heal" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Phase 3: prior fix history for this file ----
    const { data: history } = await admin
      .from("project_error_history")
      .select("error_message, fix_summary, created_at")
      .eq("project_id", projectId)
      .eq("file_path", filePath)
      .order("created_at", { ascending: false })
      .limit(5);

    const historyBlock =
      Array.isArray(history) && history.length > 0
        ? `Prior fixes attempted on this file (most recent first) — DO NOT repeat strategies that already failed:
${history
  .map(
    (h, i) =>
      `${i + 1}. err="${(h.error_message || "").slice(0, 140)}" → fix="${(h.fix_summary || "").slice(0, 200)}"`,
  )
  .join("\n")}\n\n`
        : "";

    const baseUserMsg = `File: ${filePath}

${historyBlock}Runtime error: ${errorMessage || "(no message)"}${errorLine ? ` (line ${errorLine}${errorColumn ? `, col ${errorColumn}` : ""})` : ""}

Stack trace:
${(errorStack || "(no stack)").slice(0, 2000)}

${componentStack ? `React component stack:\n${String(componentStack).slice(0, 1000)}\n\n` : ""}Broken file content:
\`\`\`tsx
${brokenContent}
\`\`\`

Return the corrected full file content as raw text. No fences, no explanation.`;

    // ---- Phase 3: iterative refinement loop ----
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: baseUserMsg },
    ];

    let fixed = "";
    let lastIssues: string[] = [];
    let pass = 0;
    const startedAt = Date.now();

    while (pass < MAX_PASSES) {
      // Wall-clock guard — bail before Supabase kills us at 150s.
      if (Date.now() - startedAt > TOTAL_BUDGET_MS) {
        console.warn(`[heal-claude] wall budget exceeded after pass ${pass}, returning best-effort`);
        break;
      }
      pass += 1;
      // Pass 2+ swap: model already has the full rules in context from
      // pass 1's system message. Replace with a brief stub for subsequent
      // passes — saves ~350 tokens per pass.
      if (pass >= 2) {
        messages[0] = { role: "system", content: SYSTEM_PROMPT_BRIEF };
      }
      let result = await callModel(OPENROUTER_API_KEY, model, messages);
      // Silent retries for transient gateway hiccups. The OpenRouter edge
      // occasionally returns an empty body (status 502 here) or a real 5xx
      // status — both are almost always transient and resolve on a single
      // re-roll. Retry up to TWICE with a tiny backoff before surfacing
      // anything to the user. The frontend will never see a 502 toast for
      // these cases.
      let transientRetries = 0;
      while (
        !result.ok &&
        (result.status === 502 ||
          result.status === 503 ||
          result.status === 504 ||
          /Empty response/i.test(result.error)) &&
        transientRetries < 2
      ) {
        transientRetries += 1;
        const backoff = 600 * transientRetries; // 600ms, then 1.2s
        console.warn(
          `[heal-claude] transient ${result.status} on pass ${pass}, silent retry ${transientRetries}/2 in ${backoff}ms`,
        );
        await new Promise((r) => setTimeout(r, backoff));
        result = await callModel(OPENROUTER_API_KEY, model, messages);
      }
      // OpenRouter 402 with "can only afford N tokens" → retry once with
      // the affordable budget instead of failing the whole heal.
      if (!result.ok && result.status === 402) {
        const m = result.error.match(/can only afford (\d+)/i);
        const affordable = m ? Math.max(512, Math.floor(parseInt(m[1], 10) * 0.9)) : 0;
        if (affordable >= 512) {
          console.warn(`[heal-claude] retrying pass ${pass} with max_tokens=${affordable}`);
          result = await callModel(OPENROUTER_API_KEY, model, messages, affordable);
        }
      }
      if (!result.ok) {
        console.error(`[heal-claude] gateway pass ${pass} ${result.status}: ${result.error}`);
        if (result.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited — try again in a moment." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (result.status === 402) {
          return new Response(
            JSON.stringify({
              error:
                "Heal provider (OpenRouter) is out of credits. Top up the OPENROUTER_API_KEY account balance to resume auto-heal.",
            }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ error: `Gateway error (${result.status})` }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      fixed = result.text;
      if (fixed.length < 20) {
        lastIssues = ["Response too short."];
      } else if (fixed === brokenContent) {
        lastIssues = ["Returned identical content — no fix produced."];
      } else {
        lastIssues = validateFile(filePath, fixed);
      }

      console.log(`[heal-claude] pass ${pass} issues=${lastIssues.length}`);
      if (lastIssues.length === 0) break;

      // feed validator diagnostics back for the next pass
      messages.push({ role: "assistant", content: fixed });
      messages.push({
        role: "user",
        content: `Your previous output failed validation. Issues:
${lastIssues.map((i) => `- ${i}`).join("\n")}

Return the corrected full file content again — fix ALL of the above plus the original runtime error. Raw text only, no fences.`,
      });
    }

    if (lastIssues.length > 0) {
      return new Response(
        JSON.stringify({
          error: `Validation failed after ${pass} pass(es)`,
          issues: lastIssues,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Persist the corrected file
    const { error: updErr } = await admin
      .from("project_files")
      .update({ content: fixed, updated_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .eq("path", filePath);
    if (updErr) {
      console.error(`[heal-claude] update failed:`, updErr);
      return new Response(JSON.stringify({ error: "Failed to save corrected file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Phase 3: log to error history for future learning ----
    try {
      await admin.from("project_error_history").insert({
        user_id: userId,
        project_id: projectId,
        file_path: filePath,
        error_message: String(errorMessage || "").slice(0, 1000),
        error_stack: String(errorStack || "").slice(0, 4000),
        fix_kind: "heal-claude",
        fix_summary: `Claude heal in ${pass} pass(es). Bytes ${brokenContent.length} → ${fixed.length}.`,
      });
    } catch (e) {
      console.warn(`[heal-claude] failed to record history:`, e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        path: filePath,
        passes: pass,
        bytesBefore: brokenContent.length,
        bytesAfter: fixed.length,
        content: fixed,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(`[heal-claude] uncaught:`, err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
