// ═══════════════════════════════════════════════════════════════════════════
// EDGE-FUNCTIONS EXEC — invoke (HTTP call to a deployed edge function)
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolHandler } from "./deploy.ts";

export const exec_invoke_edge_function: ToolHandler = async (args, ctx, _callId) => {
  if (typeof args.name !== "string") return { result: { error: "name required" } };
  const fnName = args.name.replace(/[^a-z0-9-]/gi, "");
  if (!fnName) return { result: { error: "invalid function name" } };
  const method = (typeof args.method === "string" ? args.method : "POST").toUpperCase();
  if (!["GET", "POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    return { result: { error: "method must be GET/POST/PUT/DELETE/PATCH" } };
  }
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  let url = `${SUPABASE_URL}/functions/v1/${fnName}`;
  if (args.query && typeof args.query === "object") {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(args.query)) qs.set(k, String(v));
    const s = qs.toString();
    if (s) url += `?${s}`;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const r = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ctx.userJwt || ANON}`,
        apikey: ANON,
      },
      body: method === "GET" ? undefined : JSON.stringify(args.body ?? {}),
      signal: ctrl.signal,
    });
    const text = await r.text();
    let parsed: any = text;
    try { parsed = JSON.parse(text); } catch { /* keep raw */ }
    return {
      result: {
        status: r.status,
        ok: r.ok,
        body: typeof parsed === "string" ? parsed.slice(0, 4000) : parsed,
      },
    };
  } catch (e: any) {
    return { result: { error: e?.name === "AbortError" ? "timeout (15s)" : (e?.message ?? String(e)) } };
  } finally {
    clearTimeout(timer);
  }
};
