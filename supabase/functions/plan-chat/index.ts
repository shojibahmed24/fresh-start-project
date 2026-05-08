// Plan Mode chat — discussion-only assistant.
// Reads the user's full project (file contents up to a token budget, recent
// chat, recent errors) and uses Lovable AI Gateway to provide diagnosis +
// recommendations. NEVER writes code; only discusses, plans, and advises.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ChatMsg = { role: "user" | "assistant" | "system"; content: string };

// Keep total file context under ~120k chars (~30k tokens) so we leave plenty
// of room for the chat history and the model's reply.
const MAX_FILE_CONTEXT_CHARS = 120_000;
// Per-file cap so one giant file doesn't eat the whole budget.
const MAX_PER_FILE_CHARS = 12_000;

// Files we never inline (binary, generated, lockfiles, deps).
const SKIP_PATH_RE =
  /(^|\/)(node_modules|dist|build|\.next|\.turbo|\.cache|coverage|\.git)\//;
const SKIP_EXT_RE =
  /\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|mp4|webm|mp3|wav|pdf|zip|lock)$/i;

function shouldSkipFile(path: string): boolean {
  if (SKIP_PATH_RE.test(path)) return true;
  if (SKIP_EXT_RE.test(path)) return true;
  if (path === "package-lock.json" || path === "bun.lockb") return true;
  return false;
}

// Heuristic priority: source files in src/ + supabase/functions get scanned
// first; config / docs go last.
function filePriority(path: string): number {
  if (path.startsWith("src/")) return 0;
  if (path.startsWith("supabase/functions/")) return 1;
  if (path.startsWith("supabase/")) return 2;
  if (path === "index.html" || path === "tailwind.config.ts" || path === "src/index.css") return 0;
  if (path.startsWith("public/")) return 5;
  return 4;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI gateway not configured. Enable Lovable AI in Cloud settings." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Auth check
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
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const message: string = (body.message ?? "").toString();
    const history: ChatMsg[] = Array.isArray(body.history) ? body.history : [];
    const projectId: string | undefined = body.projectId;

    if (!message.trim()) {
      return new Response(JSON.stringify({ error: "Message is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role client to read project files & errors regardless of RLS;
    // we manually verify ownership below.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let projectName = "";
    let projectDescription = "";
    let fileContextBlock = "(no project loaded)";
    let recentErrorsBlock = "";

    if (projectId) {
      // Verify ownership / access before pulling files.
      const { data: project } = await admin
        .from("projects")
        .select("id, name, description, user_id")
        .eq("id", projectId)
        .maybeSingle();

      if (project && project.user_id === userId) {
        projectName = project.name ?? "";
        projectDescription = project.description ?? "";

        // Load all project files. Try common table shapes — we don't know the
        // exact column names ahead of time so we attempt the most likely one
        // and gracefully fall back.
        let files: Array<{ path: string; content: string }> = [];
        const { data: pf } = await admin
          .from("project_files")
          .select("path, content")
          .eq("project_id", projectId);
        if (Array.isArray(pf)) {
          files = pf
            .filter((f) => f && typeof f.path === "string")
            .map((f) => ({ path: String(f.path), content: String(f.content ?? "") }));
        }

        // Sort by priority then path so the budget goes to the most relevant
        // source files first.
        files.sort((a, b) => {
          const pa = filePriority(a.path);
          const pb = filePriority(b.path);
          if (pa !== pb) return pa - pb;
          return a.path.localeCompare(b.path);
        });

        const included: string[] = [];
        const allPaths: string[] = files.map((f) => f.path);
        let used = 0;

        for (const f of files) {
          if (shouldSkipFile(f.path)) continue;
          const content = f.content.length > MAX_PER_FILE_CHARS
            ? f.content.slice(0, MAX_PER_FILE_CHARS) + `\n\n... [truncated, file is ${f.content.length} chars total]`
            : f.content;
          const block = `\n\n=== FILE: ${f.path} ===\n${content}`;
          if (used + block.length > MAX_FILE_CONTEXT_CHARS) {
            // Stop including full content; just list remaining paths.
            break;
          }
          used += block.length;
          included.push(block);
        }

        const remaining = allPaths.length - included.length;
        const pathsList = allPaths.map((p) => `- ${p}`).join("\n");

        fileContextBlock =
          `PROJECT FILE LIST (${allPaths.length} total):\n${pathsList}\n\n` +
          `=== FULL CONTENT OF ${included.length} HIGHEST-PRIORITY FILES ===` +
          included.join("") +
          (remaining > 0
            ? `\n\n[Note: ${remaining} additional files exist but were omitted to fit the context window. You can refer to them by path from the file list above.]`
            : "");

        // Recent errors / fixes (last 10) for diagnosis context.
        const { data: errs } = await admin
          .from("project_error_history")
          .select("created_at, error_message, file_path, fix_summary, fix_kind")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .limit(10);

        if (Array.isArray(errs) && errs.length > 0) {
          recentErrorsBlock =
            "\n\nRECENT PROJECT ERRORS (most recent first):\n" +
            errs
              .map((e) =>
                `- [${e.created_at}] ${e.file_path || "?"}: ${e.error_message || "(no message)"}` +
                (e.fix_summary ? `\n    Last fix attempt (${e.fix_kind || "?"}): ${e.fix_summary}` : ""),
              )
              .join("\n");
        }

      }
    }

    const systemPrompt = `You are **Plan Mode** — a senior product + engineering thinking partner for the user's project${projectName ? ` "${projectName}"` : ""}.

YOUR JOB
- Discuss the project, brainstorm features, debate trade-offs.
- Help the user PLAN changes step-by-step before they switch to Agent mode to actually build.
- **Diagnose problems**: when the user describes an issue, READ the actual file contents below, find the root cause, and explain what's wrong + what the fix should be — in plain language.
- Reference the project's actual files, components, hooks, and routes by path/name.
- Cite specific files when you make a recommendation.
- **Estimate the work**: when the user describes something they want built or changed, end your reply with a one-line estimate block in EXACTLY this format on its own line:
  📊 Estimate: ~<files> files · ~<minutes> min · <model> · <migrations> migration(s)
  Example:  📊 Estimate: ~32 files · ~4 min · Claude Sonnet · 2 migration(s)
  Pick a model: Gemini Flash for typical CRUD/UI, Gemini Pro for medium complexity, Claude Sonnet for 30+ files or deep reasoning, Claude Opus only for extreme complexity.
  Skip the estimate line ONLY for pure discussion / Q&A turns where nothing concrete will be built.

STRICT RULES
- **NEVER write or output code.** No code blocks, no snippets, not even one-liners.
- If the user asks for code, redirect: "Switch to Agent mode and I'll build it." Then summarize the plan in plain language.
- No file edits, no terminal commands, no SQL.
- Keep replies focused and conversational. Use bullets and short paragraphs.
- Reply in the language the user writes in.

PROJECT NAME: ${projectName || "(unnamed)"}
PROJECT DESCRIPTION: ${projectDescription || "(none)"}

${fileContextBlock}${recentErrorsBlock}
`;

    const messages: ChatMsg[] = [
      { role: "system", content: systemPrompt },
      ...history.slice(-20),
      { role: "user", content: message },
    ];

    const upstream = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
          stream: true,
        }),
      },
    );

    if (!upstream.ok) {
      let msg = `AI gateway error (${upstream.status})`;
      if (upstream.status === 429) msg = "Rate limit reached — try again in a moment.";
      if (upstream.status === 402) msg = "AI credits exhausted. Add credits in Lovable Cloud → Workspace → Usage.";
      const detail = await upstream.text().catch(() => "");
      console.error("plan-chat upstream error", upstream.status, detail);
      return new Response(JSON.stringify({ error: msg }), {
        status: upstream.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(upstream.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("plan-chat error", err);
    return new Response(
      JSON.stringify({ error: (err as Error)?.message ?? "unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
