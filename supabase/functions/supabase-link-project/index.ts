import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import {
  corsHeaders,
  SBOAUTH_API_BASE,
  getValidAccessToken,
  encrypt,
  logOp,
} from "../_shared/sboauth.ts";

const BodySchema = z.object({
  project_id: z.string().uuid(),
  supabase_project_ref: z.string().min(1).max(100),
  supabase_project_name: z.string().max(200).optional().default(""),
  supabase_org_id: z.string().optional(),
  supabase_region: z.string().optional(),
});

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

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { project_id, supabase_project_ref, supabase_project_name, supabase_org_id, supabase_region } = parsed.data;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify project belongs to this user
    const { data: proj, error: projErr } = await admin
      .from("projects")
      .select("id, user_id")
      .eq("id", project_id)
      .maybeSingle();

    if (projErr || !proj) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (proj.user_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getValidAccessToken(admin, userData.user.id);

    // Fetch project API keys
    const keysRes = await fetch(
      `${SBOAUTH_API_BASE}/projects/${supabase_project_ref}/api-keys?reveal=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    let anonKey: string | null = null;
    let serviceKey: string | null = null;
    if (keysRes.ok) {
      const keys = await keysRes.json();
      if (Array.isArray(keys)) {
        for (const k of keys) {
          if (k.name === "anon" || k.name === "anon_key") anonKey = k.api_key || k.value;
          if (k.name === "service_role" || k.name === "service_role_key") serviceKey = k.api_key || k.value;
        }
      }
    }

    const apiUrl = `https://${supabase_project_ref}.supabase.co`;

    // Introspect schema via Postgres meta endpoint
    let schemaCache: Record<string, unknown> = {};
    try {
      const tablesRes = await fetch(
        `${SBOAUTH_API_BASE}/projects/${supabase_project_ref}/database/tables?included_schemas=public`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (tablesRes.ok) {
        const tables = await tablesRes.json();
        schemaCache = {
          tables: Array.isArray(tables)
            ? tables.map((t: any) => ({
                name: t.name,
                schema: t.schema,
                rows: t.live_rows_estimate,
                columns: (t.columns || []).map((c: any) => ({
                  name: c.name,
                  type: c.data_type,
                  nullable: c.is_nullable,
                  default: c.default_value,
                })),
              }))
            : [],
        };
      }
    } catch (e) {
      console.error("Schema introspection failed:", e);
    }

    // Upsert link
    const { error: linkErr } = await admin
      .from("project_supabase_links")
      .upsert({
        project_id,
        user_id: userData.user.id,
        supabase_project_ref,
        supabase_project_name,
        supabase_org_id: supabase_org_id ?? null,
        supabase_region: supabase_region ?? null,
        anon_key_encrypted: anonKey ? await encrypt(anonKey) : null,
        service_role_key_encrypted: serviceKey ? await encrypt(serviceKey) : null,
        api_url: apiUrl,
        schema_cache: schemaCache,
        schema_cached_at: new Date().toISOString(),
      }, { onConflict: "project_id" });

    if (linkErr) {
      await logOp(admin, userData.user.id, "link_project", "error", linkErr.message,
        { project_id, supabase_project_ref });
      return new Response(JSON.stringify({ error: linkErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await logOp(admin, userData.user.id, "link_project", "success",
      `Linked ${supabase_project_name || supabase_project_ref}`,
      { project_id, supabase_project_ref });

    return new Response(JSON.stringify({
      success: true,
      api_url: apiUrl,
      schema: schemaCache,
      has_anon_key: !!anonKey,
      has_service_key: !!serviceKey,
    }), {
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
