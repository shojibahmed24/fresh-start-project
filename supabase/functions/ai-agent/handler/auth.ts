// ═══════════════════════════════════════════════════════════════════════════
// HANDLER — auth + project ownership verification
// ───────────────────────────────────────────────────────────────────────────
// Validates the Bearer JWT, builds a request-scoped Supabase client, and
// (optionally) verifies project ownership. On any failure returns a 4xx/5xx
// Response that the caller should return verbatim. On success returns the
// authenticated context.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../cors.ts";

export type AuthSuccess = {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  token: string;
  authHeader: string;
  apiKey: string;
};

const jsonResp = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export async function authenticate(req: Request): Promise<AuthSuccess | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResp({ error: "Unauthorized" }, 401);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

  if (!OPENROUTER_API_KEY) {
    return jsonResp(
      { error: "OPENROUTER_API_KEY missing. Add it in Supabase edge function secrets." },
      500,
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) {
    return jsonResp({ error: "Unauthorized" }, 401);
  }
  const userId = claimsData.claims.sub as string;

  return { supabase, userId, token, authHeader, apiKey: OPENROUTER_API_KEY };
}

export async function verifyProjectOwnership(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  userId: string,
): Promise<{ id: string; user_id: string; name: string } | Response> {
  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select("id, user_id, name")
    .eq("id", projectId)
    .maybeSingle();
  if (projErr || !project) return jsonResp({ error: "Project not found" }, 404);
  if (project.user_id !== userId) return jsonResp({ error: "Forbidden" }, 403);
  return project as { id: string; user_id: string; name: string };
}
