import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, SBOAUTH_AUTHORIZE_URL, getRedirectUri, signState } from "../_shared/sboauth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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

    const clientId = Deno.env.get("SBOAUTH_CLIENT_ID");
    if (!clientId) {
      return new Response(
        JSON.stringify({ error: "SBOAUTH_CLIENT_ID not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const returnTo: string = body.return_to || "/dashboard";

    // State carries: userId + returnTo, HMAC-signed to prevent tampering
    const state = await signState({
      uid: userData.user.id,
      rt: returnTo,
      n: crypto.randomUUID(),
      ts: Date.now(),
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: getRedirectUri(),
      response_type: "code",
      state,
    });

    const url = `${SBOAUTH_AUTHORIZE_URL}?${params.toString()}`;

    return new Response(JSON.stringify({ url, state }), {
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
