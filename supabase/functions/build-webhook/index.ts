// Receives progress callbacks from the GitHub Actions workflow.
// The action POSTs JSON like:
// { build_id, secret, event: "step_start"|"step_done"|"step_fail"|"build_done"|"build_failed",
//   step_key?, detail?, github_run_id?, github_run_url?, download_url?, file_size_bytes?, error_message? }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-build-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SECRET = Deno.env.get("GITHUB_WEBHOOK_SECRET");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!SECRET) return json({ error: "Webhook not configured" }, 500);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const provided = body?.secret ?? req.headers.get("x-build-secret");
  if (provided !== SECRET) return json({ error: "Forbidden" }, 403);

  const { build_id, event, step_key, detail, github_run_id, github_run_url,
          download_url, file_size_bytes, error_message } = body ?? {};

  if (!build_id || !event) return json({ error: "build_id and event required" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Stamp run id/url if provided
    const runPatch: Record<string, unknown> = {};
    if (github_run_id) runPatch.github_run_id = String(github_run_id);
    if (github_run_url) runPatch.github_run_url = String(github_run_url);

    switch (event) {
      case "step_start":
        if (!step_key) return json({ error: "step_key required" }, 400);
        await admin.from("app_build_steps")
          .update({ status: "running", started_at: new Date().toISOString(), detail: detail ?? null })
          .eq("build_id", build_id).eq("step_key", step_key);
        await admin.from("app_builds")
          .update({ ...runPatch, status: step_key === "upload" ? "uploading" : "building" })
          .eq("id", build_id);
        break;

      case "step_done":
        if (!step_key) return json({ error: "step_key required" }, 400);
        await admin.from("app_build_steps")
          .update({ status: "done", finished_at: new Date().toISOString(), detail: detail ?? null })
          .eq("build_id", build_id).eq("step_key", step_key);
        if (Object.keys(runPatch).length) {
          await admin.from("app_builds").update(runPatch).eq("id", build_id);
        }
        break;

      case "step_fail":
        await admin.from("app_build_steps")
          .update({ status: "failed", finished_at: new Date().toISOString(), detail: detail ?? error_message ?? null })
          .eq("build_id", build_id).eq("step_key", step_key ?? "");
        await admin.from("app_builds")
          .update({ ...runPatch, status: "failed", error_message: error_message ?? detail ?? "Step failed", finished_at: new Date().toISOString() })
          .eq("id", build_id);
        break;

      case "build_done":
        await admin.from("app_build_steps")
          .update({ status: "done", finished_at: new Date().toISOString() })
          .eq("build_id", build_id).eq("step_key", "ready");
        await admin.from("app_builds")
          .update({
            ...runPatch,
            status: "ready",
            download_url: download_url ?? null,
            file_size_bytes: file_size_bytes ?? null,
            finished_at: new Date().toISOString(),
          })
          .eq("id", build_id);
        break;

      case "build_failed":
        await admin.from("app_builds")
          .update({ ...runPatch, status: "failed", error_message: error_message ?? "Build failed", finished_at: new Date().toISOString() })
          .eq("id", build_id);
        await admin.from("app_build_steps")
          .update({ status: "failed", finished_at: new Date().toISOString() })
          .eq("build_id", build_id).in("status", ["pending", "running"]);
        break;

      default:
        return json({ error: "Unknown event" }, 400);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("build-webhook error", e);
    return json({ error: "Internal error", detail: String(e?.message ?? e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
