// Triggers a GitHub Actions workflow_dispatch on the central build repo.
// Creates an app_builds row + step rows, then dispatches the workflow with
// a payload containing the build_id and a callback URL the action will hit
// to report progress.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STEPS: Array<{ key: string; label: string; order: number }> = [
  { key: "queued",       label: "Queued on GitHub Actions",          order: 1 },
  { key: "checkout",     label: "Preparing build environment",       order: 2 },
  { key: "inject",       label: "Injecting your project files",      order: 3 },
  { key: "install",      label: "Installing dependencies",           order: 4 },
  { key: "web_build",    label: "Building web bundle (Vite)",        order: 5 },
  { key: "cap_sync",     label: "Capacitor sync (Android)",          order: 6 },
  { key: "gradle",       label: "Compiling APK with Gradle",         order: 7 },
  { key: "upload",       label: "Uploading to GitHub Release",       order: 8 },
  { key: "ready",        label: "APK ready to download",             order: 9 },
];

if (import.meta.main) {
  Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const PAT = Deno.env.get("GITHUB_BUILD_PAT");
    const rawRepo = Deno.env.get("GITHUB_BUILD_REPO");
    const REPO = normalizeGitHubRepo(rawRepo);
    const WEBHOOK_SECRET = Deno.env.get("GITHUB_WEBHOOK_SECRET");
    const WORKFLOW = Deno.env.get("GITHUB_BUILD_WORKFLOW")?.trim() || "build-apk.yml";
    const BUILD_REF = Deno.env.get("GITHUB_BUILD_REF")?.trim() || "main";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!PAT || !rawRepo || !WEBHOOK_SECRET) {
      return json({ error: "Build service not configured. Missing GITHUB_BUILD_PAT / GITHUB_BUILD_REPO / GITHUB_WEBHOOK_SECRET." }, 500);
    }
    if (!REPO) {
      return json({ error: "Build service not configured. GITHUB_BUILD_REPO must be an 'owner/repo' pair or a full GitHub repository URL." }, 500);
    }

    // Authenticate caller
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const projectId: string | undefined = body.projectId;
    const platform: "android" | "ios" = body.platform === "ios" ? "ios" : "android";
    if (!projectId) return json({ error: "projectId required" }, 400);
    if (platform === "ios") return json({ error: "iOS build not yet enabled. Android only for now." }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verify project ownership + load project + files
    const { data: project, error: projErr } = await admin
      .from("projects")
      .select("id, user_id, name, description")
      .eq("id", projectId)
      .single();
    if (projErr || !project) return json({ error: "Project not found" }, 404);
    if (project.user_id !== user.id) return json({ error: "Not your project" }, 403);

    const { data: files, error: filesErr } = await admin
      .from("project_files")
      .select("path, content")
      .eq("project_id", projectId);
    if (filesErr) return json({ error: "Could not load project files" }, 500);
    if (!files || files.length === 0) return json({ error: "Project has no files to build" }, 400);

    // Sanitize app + package metadata
    const appName = (project.name || "My App").slice(0, 40);
    const safeId = (user.id.replace(/-/g, "")).slice(0, 12);
    const packageId = `app.lovable.u${safeId}`;

    // Create build row
    const { data: build, error: buildErr } = await admin
      .from("app_builds")
      .insert({
        project_id: projectId,
        user_id: user.id,
        platform,
        status: "queued",
        app_name: appName,
        package_id: packageId,
        version_name: "1.0.0",
        version_code: 1,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (buildErr || !build) return json({ error: "Could not create build record", detail: buildErr?.message }, 500);

    // Seed steps
    await admin.from("app_build_steps").insert(
      STEPS.map((s) => ({
        build_id: build.id,
        step_key: s.key,
        label: s.label,
        step_order: s.order,
        status: s.key === "queued" ? "running" : "pending",
        started_at: s.key === "queued" ? new Date().toISOString() : null,
      })),
    );

    // Build payload for GitHub Action.
    // Files are sent compressed-base64 via the webhook fetch (GH Actions will pull it back),
    // but workflow_dispatch inputs are limited (~64KB). So we publish files as a separate
    // signed-fetch endpoint: the action calls /functions/v1/build-files?build_id=... with the secret.
    const callbackUrl = `${SUPABASE_URL}/functions/v1/build-webhook`;
    const filesUrl = `${SUPABASE_URL}/functions/v1/build-files?build_id=${build.id}`;

    const dispatchRes = await fetch(
      `https://api.github.com/repos/${REPO}/actions/workflows/${encodeURIComponent(WORKFLOW)}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAT}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: BUILD_REF,
          inputs: {
            build_id: build.id,
            app_name: appName,
            package_id: packageId,
            version_name: "1.0.0",
            version_code: "1",
            callback_url: callbackUrl,
            files_url: filesUrl,
            webhook_secret: WEBHOOK_SECRET,
          },
        }),
      },
    );

    if (!dispatchRes.ok) {
      const txt = await dispatchRes.text();
      const failureDetail = `GitHub dispatch failed for ${REPO}/${WORKFLOW}@${BUILD_REF}: ${dispatchRes.status} ${txt.slice(0, 220)}`;
      await admin
        .from("app_builds")
        .update({ status: "failed", error_message: failureDetail, finished_at: new Date().toISOString() })
        .eq("id", build.id);
      await admin
        .from("app_build_steps")
        .update({ status: "failed", finished_at: new Date().toISOString(), detail: `${dispatchRes.status} ${txt.slice(0, 200)}` })
        .eq("build_id", build.id)
        .eq("step_key", "queued");
      return json({ error: "Failed to dispatch GitHub workflow", detail: txt.slice(0, 300) }, 502);
    }

    return json({ build_id: build.id, status: "queued" }, 200);
  } catch (e: unknown) {
    console.error("trigger-build error", e);
    return json({ error: "Internal error", detail: e instanceof Error ? e.message : String(e) }, 500);
  }
  });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function normalizeGitHubRepo(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim().replace(/\.git$/i, "");
  const slugMatch = trimmed.match(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
  if (slugMatch) return trimmed;

  try {
    const url = new URL(trimmed);
    if (!/(^|\.)github\.com$/i.test(url.hostname)) return null;

    const [owner, repo] = url.pathname.split("/").filter(Boolean);
    const normalizedRepo = repo?.replace(/\.git$/i, "");
    if (!owner || !normalizedRepo) return null;

    return `${owner}/${normalizedRepo}`;
  } catch {
    return null;
  }
}
