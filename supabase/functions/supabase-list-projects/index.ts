import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, SBOAUTH_API_BASE, getValidAccessToken, logOp } from "../_shared/sboauth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Auth required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const accessToken = await getValidAccessToken(admin, userData.user.id);

    // Fetch organizations + projects
    const [orgsRes, projectsRes] = await Promise.all([
      fetch(`${SBOAUTH_API_BASE}/organizations`, { headers: { Authorization: `Bearer ${accessToken}` } }),
      fetch(`${SBOAUTH_API_BASE}/projects`, { headers: { Authorization: `Bearer ${accessToken}` } }),
    ]);

    if (!projectsRes.ok) {
      const txt = await projectsRes.text();
      await logOp(admin, userData.user.id, "list_projects", "error", txt.slice(0, 200));
      return new Response(JSON.stringify({ error: `Supabase API: ${txt.slice(0, 200)}` }), {
        status: projectsRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgs = orgsRes.ok ? await orgsRes.json() : [];
    const projects = await projectsRes.json();

    await logOp(admin, userData.user.id, "list_projects", "success",
      `Listed ${Array.isArray(projects) ? projects.length : 0} projects`);

    return new Response(JSON.stringify({ organizations: orgs, projects }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
