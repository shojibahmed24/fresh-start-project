// Shared utilities for Supabase OAuth integration

export const SBOAUTH_AUTHORIZE_URL = "https://api.supabase.com/v1/oauth/authorize";
export const SBOAUTH_TOKEN_URL = "https://api.supabase.com/v1/oauth/token";
export const SBOAUTH_API_BASE = "https://api.supabase.com/v1";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// AES-GCM encryption helpers using SBOAUTH_ENCRYPTION_KEY (base64, 32 bytes)
function normalizeBase64(input: string): string {
  const sanitized = input
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\s+/g, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padding = sanitized.length % 4;
  return padding === 0 ? sanitized : sanitized + "=".repeat(4 - padding);
}

async function getKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("SBOAUTH_ENCRYPTION_KEY");
  if (!raw) throw new Error("SBOAUTH_ENCRYPTION_KEY not set");

  let keyBytes: Uint8Array;
  try {
    keyBytes = Uint8Array.from(atob(normalizeBase64(raw)), (c) => c.charCodeAt(0));
  } catch {
    throw new Error("SBOAUTH_ENCRYPTION_KEY must be valid base64 for a 32-byte key");
  }

  if (keyBytes.length !== 32) {
    throw new Error(`Encryption key must be 32 bytes (got ${keyBytes.length})`);
  }

  return await crypto.subtle.importKey(
    "raw",
    keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encrypt(plain: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(plain);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc);
  const combined = new Uint8Array(iv.length + cipher.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipher), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decrypt(b64: string): Promise<string> {
  const key = await getKey();
  const combined = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const cipher = combined.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return new TextDecoder().decode(plain);
}

// ── HMAC-signed OAuth state (prevents uid tampering / CSRF) ──
async function getHmacKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("SBOAUTH_ENCRYPTION_KEY");
  if (!raw) throw new Error("SBOAUTH_ENCRYPTION_KEY not set");
  const keyBytes = Uint8Array.from(atob(normalizeBase64(raw)), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "raw",
    keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function b64urlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const norm = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Uint8Array.from(atob(norm), (c) => c.charCodeAt(0));
}

export async function signState(payload: Record<string, unknown>): Promise<string> {
  const key = await getHmacKey();
  const json = JSON.stringify(payload);
  const payloadB64 = b64urlEncode(new TextEncoder().encode(json));
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  const sigB64 = b64urlEncode(new Uint8Array(sigBuf));
  return `${payloadB64}.${sigB64}`;
}

export async function verifyState<T = any>(state: string): Promise<T | null> {
  // Backwards-compat: legacy plain base64 JSON has no "." separator.
  if (!state.includes(".")) return null;
  const [payloadB64, sigB64] = state.split(".");
  if (!payloadB64 || !sigB64) return null;
  const key = await getHmacKey();
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    b64urlDecode(sigB64),
    new TextEncoder().encode(payloadB64),
  ).catch(() => false);
  if (!ok) return null;
  try {
    return JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64))) as T;
  } catch {
    return null;
  }
}

export function getRedirectUri(): string {
  const base = Deno.env.get("SUPABASE_URL");
  return `${base}/functions/v1/supabase-oauth-callback`;
}

// Fetch a fresh access token (refresh if expired)
export async function getValidAccessToken(
  admin: any,
  userId: string,
): Promise<string> {
  const { data: conn, error } = await admin
    .from("user_supabase_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !conn) throw new Error("No Supabase connection found");
  if (conn.revoked) throw new Error("Supabase connection has been revoked");

  const expiresAt = new Date(conn.token_expires_at).getTime();
  const now = Date.now();

  // Refresh if expiring within 60s
  if (expiresAt - now > 60_000) {
    return await decrypt(conn.access_token_encrypted);
  }

  // Refresh
  const refreshToken = await decrypt(conn.refresh_token_encrypted);
  const clientId = Deno.env.get("SBOAUTH_CLIENT_ID")!;
  const clientSecret = Deno.env.get("SBOAUTH_CLIENT_SECRET")!;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(SBOAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Token refresh failed [${res.status}]: ${txt}`);
  }

  const tok = await res.json();
  const newExpires = new Date(Date.now() + (tok.expires_in ?? 3600) * 1000);

  await admin
    .from("user_supabase_connections")
    .update({
      access_token_encrypted: await encrypt(tok.access_token),
      refresh_token_encrypted: await encrypt(tok.refresh_token ?? refreshToken),
      token_expires_at: newExpires.toISOString(),
      last_refreshed_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return tok.access_token;
}

export async function logOp(
  admin: any,
  userId: string,
  operation: string,
  status: "success" | "error",
  summary: string,
  extra?: Record<string, unknown>,
) {
  try {
    await admin.from("supabase_operation_logs").insert({
      user_id: userId,
      operation,
      status,
      request_summary: summary,
      error_message: status === "error" ? summary : null,
      metadata: extra ?? null,
      project_id: extra?.project_id ?? null,
      supabase_project_ref: extra?.supabase_project_ref ?? null,
    });
  } catch (e) {
    console.error("logOp failed:", e);
  }
}
