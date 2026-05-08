// Returns decrypted anon key + api url for the calling user's linked Supabase project,
// so the live preview Sandpack can inject `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`
// into generated child apps.
//
// Auth: requires a valid user JWT. Only returns creds for projects the user owns.
// Never returns the service_role_key.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, decrypt } from "../_shared/sboauth.ts";

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

    const { project_id } = await req.json().catch(() => ({}));
    if (!project_id || typeof project_id !== "string") {
      return new Response(JSON.stringify({ error: "project_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: link, error: linkErr } = await admin
      .from("project_supabase_links")
      .select("user_id, api_url, anon_key_encrypted, supabase_project_ref")
      .eq("project_id", project_id)
      .maybeSingle();

    if (linkErr) {
      return new Response(JSON.stringify({ error: linkErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!link) {
      return new Response(JSON.stringify({ linked: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (link.user_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let anonKey: string | null = null;
    if (link.anon_key_encrypted) {
      try {
        anonKey = await decrypt(link.anon_key_encrypted);
      } catch (e) {
        console.error("decrypt anon_key failed", e);
      }
    }

    return new Response(
      JSON.stringify({
        linked: true,
        api_url: link.api_url,
        anon_key: anonKey,
        project_ref: link.supabase_project_ref,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
