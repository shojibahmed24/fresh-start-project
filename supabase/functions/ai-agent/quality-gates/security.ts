// ═══════════════════════════════════════════════════════════════════════════
// SECURITY GATE — Supabase DB linter findings + static code-scan for risks
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolContext, GateFinding, GateResult } from "../types.ts";

export async function runSecurityAudit(ctx: ToolContext): Promise<GateResult> {
  const findings: GateFinding[] = [];

  // (1) DB linter via Supabase Management API — best-effort.
  try {
    const { data: link } = await ctx.supabase
      .from("project_supabase_links")
      .select("supabase_project_ref")
      .eq("project_id", ctx.projectId)
      .maybeSingle();
    const ref = link?.supabase_project_ref;
    const mgmtToken = Deno.env.get("SUPABASE_ACCESS_TOKEN") ?? Deno.env.get("SUPABASE_MANAGEMENT_TOKEN");
    if (ref && mgmtToken) {
      const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/lints`, {
        headers: { Authorization: `Bearer ${mgmtToken}` },
        signal: AbortSignal.timeout(10000),
      });
      if (r.ok) {
        const lints = (await r.json()) as Array<{
          name: string;
          level: string;
          description?: string;
          detail?: string;
          remediation?: string;
        }>;
        for (const lint of lints.slice(0, 30)) {
          findings.push({
            path: "supabase/database",
            rule: lint.name,
            severity: lint.level === "ERROR" ? "error" : lint.level === "WARN" ? "warn" : "info",
            problem: lint.description || lint.detail || lint.name,
            hint: lint.remediation,
          });
        }
      }
    }
  } catch (e) {
    console.warn("[security_audit] db lint failed", (e as any)?.message);
  }

  // (2) Static code scan
  const { data: rows } = await ctx.supabase
    .from("project_files")
    .select("path, content")
    .eq("project_id", ctx.projectId);

  let scanned = 0;
  for (const row of (rows ?? []) as { path: string; content: string }[]) {
    if (!/\.(tsx?|jsx?|html|json|env)$/.test(row.path)) continue;
    scanned++;
    const c = row.content;

    // Hard-coded secrets
    const patterns: Array<[RegExp, string, string]> = [
      [/sk_live_[A-Za-z0-9]{20,}/, "stripe-secret-key", "Stripe LIVE secret key in source"],
      [/sk_test_[A-Za-z0-9]{20,}/, "stripe-test-key", "Stripe TEST secret key in source"],
      [/AIza[0-9A-Za-z\-_]{35}/, "google-api-key", "Google API key in source"],
      [/AKIA[0-9A-Z]{16}/, "aws-access-key", "AWS access key in source"],
      [/-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/, "private-key", "Private key embedded in source"],
      [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, "jwt-token", "JWT token in source"],
    ];
    for (const [re, rule, problem] of patterns) {
      if (re.test(c)) {
        findings.push({
          path: row.path,
          rule,
          severity: "error",
          problem,
          hint: "Move to a Supabase secret and read via `Deno.env.get()` in an edge function.",
        });
      }
    }

    // service_role on the client
    if (/service_role/i.test(c) && !row.path.startsWith("supabase/functions/")) {
      findings.push({
        path: row.path,
        rule: "no-service-role-on-client",
        severity: "error",
        problem: "`service_role` key referenced outside an edge function",
        hint: "service_role bypasses RLS and must NEVER reach the browser. Use the anon key on the client.",
      });
    }

    // dangerouslySetInnerHTML
    if (/dangerouslySetInnerHTML/.test(c)) {
      findings.push({
        path: row.path,
        rule: "no-danger-html",
        severity: "warn",
        problem: "`dangerouslySetInnerHTML` used",
        hint: "Sanitise the HTML (DOMPurify) or render as text — XSS risk.",
      });
    }

    // String-interpolated SQL
    if (/(supabase\.rpc\(\s*["']execute_sql["']|\.from\(\s*`)/.test(c)) {
      findings.push({
        path: row.path,
        rule: "no-raw-sql",
        severity: "error",
        problem: "Raw / interpolated SQL detected",
        hint: "Use the typed Supabase client (`.from('table').select()`) — never build SQL strings.",
      });
    }

    // window.location = userInput (open redirect)
    if (/window\.location\s*=\s*[^"'`]/.test(c)) {
      findings.push({
        path: row.path,
        rule: "no-open-redirect",
        severity: "warn",
        problem: "Dynamic `window.location` assignment — possible open redirect",
      });
    }
  }

  return {
    name: "security",
    ok: !findings.some((f) => f.severity === "error"),
    findings,
    checked: scanned,
  };
}
