// Returns the project files snapshot for a given build_id.
// Called by the GitHub Action with the shared webhook secret.
// Response: { files: [{ path, content }], app_name, package_id, version_name, version_code }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-build-secret",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SECRET = Deno.env.get("GITHUB_WEBHOOK_SECRET");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!SECRET) return json({ error: "Not configured" }, 500);

  const url = new URL(req.url);
  const buildId = url.searchParams.get("build_id");
  const provided = req.headers.get("x-build-secret") ?? url.searchParams.get("secret");
  if (provided !== SECRET) return json({ error: "Forbidden" }, 403);
  if (!buildId) return json({ error: "build_id required" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: build, error: bErr } = await admin
    .from("app_builds")
    .select("id, project_id, app_name, package_id, version_name, version_code")
    .eq("id", buildId)
    .single();
  if (bErr || !build) return json({ error: "Build not found" }, 404);

  const { data: files, error: fErr } = await admin
    .from("project_files")
    .select("path, content")
    .eq("project_id", build.project_id);
  if (fErr) return json({ error: "Could not load files" }, 500);

  return json({
    app_name: build.app_name,
    package_id: build.package_id,
    version_name: build.version_name,
    version_code: build.version_code,
    files: files ?? [],
  });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
