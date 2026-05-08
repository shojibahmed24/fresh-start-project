// ═══════════════════════════════════════════════════════════════════════════
// ESTIMATE-BUILD — Lightweight cost/effort estimator for a build request
// ───────────────────────────────────────────────────────────────────────────
// Input: { message, isEmpty, fileCount }
// Output: { files, minutes, model, migrations, complexity, summary }
//
// Used by Plan Mode (estimate card) and the chat send box (inline pill) to
// give the user a sense of "how big is this ask?" before they hit send.
// Always responds within ~3s (fast Gemini) so it can be called on every
// debounced keystroke without lag.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type EstimateOut = {
  files: number;
  minutes: number;
  model: "gemini-flash" | "gemini-pro" | "sonnet" | "opus";
  migrations: number;
  complexity: "trivial" | "small" | "medium" | "large" | "epic";
  summary: string;
};

// Cheap heuristic fallback so the UI always gets *something* even when the
// LLM is rate-limited or the user is offline-recovered.
function heuristic(message: string, isEmpty: boolean, fileCount: number): EstimateOut {
  const lower = message.toLowerCase();
  const isScratch = isEmpty || /\b(build|create|make|scaffold|generate)\b.*\b(app|site|dashboard|page|landing)\b/i.test(lower);
  const wantsBackend = /\b(auth|login|signup|user|database|table|store|order|payment|admin|api|backend|crud|supabase)\b/.test(lower);
  const wantsAI = /\b(ai|chat|gpt|llm|generate|summari[sz]e|recommend)\b/.test(lower);
  const isFix = /\b(fix|bug|error|broken|not working|debug)\b/.test(lower);
  const isPolish = /\b(polish|improve|prettier|nicer|redesign|restyle)\b/.test(lower);

  let files = 1;
  let migrations = 0;
  let complexity: EstimateOut["complexity"] = "small";

  if (isScratch) {
    files = 18 + (wantsBackend ? 6 : 0) + (wantsAI ? 3 : 0);
    migrations = wantsBackend ? 1 : 0;
    complexity = wantsBackend || wantsAI ? "large" : "medium";
  } else if (isFix) {
    files = 1 + Math.min(2, Math.floor(fileCount / 30));
    complexity = "small";
  } else if (isPolish) {
    files = 3 + Math.min(4, Math.floor(fileCount / 20));
    complexity = "medium";
  } else {
    files = 2 + (wantsBackend ? 3 : 0);
    migrations = wantsBackend ? 1 : 0;
    complexity = wantsBackend ? "medium" : "small";
  }

  const minutes = Math.max(1, Math.round(files * 0.18 + migrations * 1.2));
  const model: EstimateOut["model"] =
    complexity === "epic" || complexity === "large" ? "sonnet" : "gemini-flash";

  return {
    files,
    minutes,
    model,
    migrations,
    complexity,
    summary: `${complexity} ${isScratch ? "scratch build" : isFix ? "bug fix" : "edit"} — ~${files} files, ~${minutes} min`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Sign in required." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const message: string = String(body.message ?? "").trim();
    const isEmpty: boolean = !!body.isEmpty;
    const fileCount: number = Number(body.fileCount ?? 0);

    if (!message) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fb = heuristic(message, isEmpty, fileCount);

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify(fb), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tight LLM call — ~3s budget. If it fails, return heuristic.
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const upstream = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          signal: ctrl.signal,
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            temperature: 0.1,
            max_tokens: 200,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  `You are a build estimator. Return ONLY a JSON object with these keys:
{
  "files": number (estimated NEW or MODIFIED files, 1-100),
  "minutes": number (wall-clock generation time, 1-15),
  "model": "gemini-flash" | "gemini-pro" | "sonnet" | "opus",
  "migrations": number (DB migrations needed, 0-5),
  "complexity": "trivial" | "small" | "medium" | "large" | "epic",
  "summary": string (one sentence ≤90 chars, plain English)
}
Pick "sonnet" or higher only when the request needs deep reasoning, complex state, or 30+ files.
For pure UI tweaks pick "gemini-flash". For typical CRUD apps pick "gemini-flash" with files in 15-30.`,
              },
              {
                role: "user",
                content: `Project state: ${isEmpty ? "EMPTY (scratch build)" : `${fileCount} existing files (edit)`}\n\nUser request:\n${message.slice(0, 800)}`,
              },
            ],
          }),
        },
      );
      clearTimeout(timer);
      if (!upstream.ok) {
        return new Response(JSON.stringify(fb), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const j = await upstream.json();
      const raw = j?.choices?.[0]?.message?.content ?? "";
      const parsed = JSON.parse(raw);
      // Guard rails: clamp values.
      const out: EstimateOut = {
        files: Math.max(1, Math.min(100, Number(parsed.files) || fb.files)),
        minutes: Math.max(1, Math.min(15, Number(parsed.minutes) || fb.minutes)),
        model: ["gemini-flash", "gemini-pro", "sonnet", "opus"].includes(parsed.model)
          ? parsed.model
          : fb.model,
        migrations: Math.max(0, Math.min(5, Number(parsed.migrations) || 0)),
        complexity: ["trivial", "small", "medium", "large", "epic"].includes(parsed.complexity)
          ? parsed.complexity
          : fb.complexity,
        summary: String(parsed.summary || fb.summary).slice(0, 120),
      };
      return new Response(JSON.stringify(out), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      return new Response(JSON.stringify(fb), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("estimate-build error", err);
    return new Response(
      JSON.stringify({ error: (err as Error)?.message ?? "unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
