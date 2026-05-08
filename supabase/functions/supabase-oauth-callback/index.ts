import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  corsHeaders,
  SBOAUTH_TOKEN_URL,
  SBOAUTH_API_BASE,
  getRedirectUri,
  encrypt,
  logOp,
  verifyState,
} from "../_shared/sboauth.ts";

function htmlResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function normalizeReturnTo(returnTo: string | null | undefined) {
  if (!returnTo) return "/dashboard";
  try {
    const url = new URL(returnTo);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    if (returnTo.startsWith("/")) return returnTo;
  }
  return "/dashboard";
}

function closingPage(success: boolean, message: string, returnTo: string) {
  const safeMsg = message.replace(/</g, "&lt;");
  const safeReturn = JSON.stringify(normalizeReturnTo(returnTo));
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Supabase Connected</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;background:#0F172A;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}
  .card{max-width:440px;background:#1E293B;border-radius:16px;padding:32px;border:1px solid #334155}
  h1{margin:0 0 12px;font-size:20px}
  p{color:#94A3B8;line-height:1.5}
  .ok{color:#10B981} .err{color:#EF4444}
  button{margin-top:20px;background:#3B82F6;color:#fff;border:0;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px}
</style></head>
<body><div class="card">
  <h1 class="${success ? "ok" : "err"}">${success ? "✓ Connected" : "✗ Failed"}</h1>
  <p>${safeMsg}</p>
  <button onclick="closeOrRedirect()">Continue</button>
</div>
<script>
  function closeOrRedirect(){
    try{
      if(window.opener){
        window.opener.postMessage({type:"sboauth_${success ? "success" : "error"}",message:${JSON.stringify(message)}},"*");
        window.close();
        return;
      }
    }catch(e){}
    window.location.replace(${safeReturn});
  }
  // Auto-notify opener
  try{
    if(window.opener){
      window.opener.postMessage({type:"sboauth_${success ? "success" : "error"}",message:${JSON.stringify(message)}},"*");
      setTimeout(()=>window.close(),1500);
    }
  }catch(e){}
</script>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");
    const errorDesc = url.searchParams.get("error_description");

    if (errorParam) {
      return htmlResponse(closingPage(false, errorDesc || errorParam, "/dashboard"), 400);
    }
    if (!code || !state) {
      return htmlResponse(closingPage(false, "Missing code or state", "/dashboard"), 400);
    }

    const parsedState = await verifyState<{ uid: string; rt: string; n: string; ts: number }>(state);
    if (!parsedState) {
      return htmlResponse(closingPage(false, "Invalid or tampered state", "/dashboard"), 400);
    }

    if (Date.now() - parsedState.ts > 10 * 60 * 1000) {
      return htmlResponse(closingPage(false, "State expired (over 10 min)", parsedState.rt), 400);
    }

    const clientId = Deno.env.get("SBOAUTH_CLIENT_ID");
    const clientSecret = Deno.env.get("SBOAUTH_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      return htmlResponse(closingPage(false, "OAuth not configured", parsedState.rt), 500);
    }

    const tokBody = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
      client_id: clientId,
      client_secret: clientSecret,
    });

    const tokRes = await fetch(SBOAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokBody,
    });

    if (!tokRes.ok) {
      const txt = await tokRes.text();
      return htmlResponse(
        closingPage(false, `Token exchange failed: ${txt.slice(0, 200)}`, parsedState.rt),
        400,
      );
    }

    const tok = await tokRes.json();
    const accessToken = tok.access_token as string;
    const refreshToken = tok.refresh_token as string;
    const expiresIn = (tok.expires_in as number) ?? 3600;
    const scopes: string[] = (tok.scope ? String(tok.scope).split(" ") : []);

    let supabaseEmail: string | null = null;
    let supabaseUserId: string | null = null;
    try {
      const meRes = await fetch(`${SBOAUTH_API_BASE}/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (meRes.ok) {
        const me = await meRes.json();
        supabaseEmail = me.primary_email || me.email || null;
        supabaseUserId = me.id || null;
      }
    } catch (_) { /* non-fatal */ }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const { error: upErr } = await admin
      .from("user_supabase_connections")
      .upsert({
        user_id: parsedState.uid,
        access_token_encrypted: await encrypt(accessToken),
        refresh_token_encrypted: await encrypt(refreshToken),
        token_expires_at: expiresAt,
        supabase_email: supabaseEmail,
        supabase_user_id: supabaseUserId,
        scopes,
        connected_at: new Date().toISOString(),
        last_refreshed_at: new Date().toISOString(),
        revoked: false,
      }, { onConflict: "user_id" });

    if (upErr) {
      await logOp(admin, parsedState.uid, "oauth.callback", "error", upErr.message);
      return htmlResponse(closingPage(false, `DB error: ${upErr.message}`, parsedState.rt), 500);
    }

    await logOp(admin, parsedState.uid, "oauth.callback", "success", `Connected ${supabaseEmail ?? ""}`);

    return htmlResponse(closingPage(true, `Connected as ${supabaseEmail ?? "your Supabase account"}`, parsedState.rt));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected callback error";
    return htmlResponse(closingPage(false, message, "/dashboard"), 500);
  }
});
