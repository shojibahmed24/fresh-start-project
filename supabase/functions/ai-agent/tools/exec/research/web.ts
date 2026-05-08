// ═══════════════════════════════════════════════════════════════════════════
// RESEARCH EXEC — web (search, fetch, npm lookup)
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolContext } from "../../../types.ts";

export type ToolHandler = (
  args: any,
  ctx: ToolContext,
  callId: string,
) => Promise<{ result: any; askUser?: boolean }>;

export const exec_web_search: ToolHandler = async (args, _ctx, _callId) => {
  if (typeof args.query !== "string" || args.query.length === 0) {
    return { result: { error: "query required" } };
  }
  const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 10);

  // ── 1. Tavily (preferred — proper search API, no bot blocks) ──
  const tavilyKey = Deno.env.get("TAVILY_API_KEY");
  if (tavilyKey) {
    try {
      const r = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: args.query,
          max_results: limit,
          search_depth: "basic",
          include_answer: false,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (r.ok) {
        const data = await r.json();
        const results = (data.results || []).slice(0, limit).map((it: any) => ({
          title: String(it.title || "").slice(0, 200),
          url: it.url,
          snippet: String(it.content || "").slice(0, 300),
        }));
        return {
          result: { query: args.query, count: results.length, results, provider: "tavily" },
        };
      }
      console.warn("[web_search] tavily failed", r.status, "— falling back to DDG");
    } catch (e: any) {
      console.warn("[web_search] tavily error", e?.message, "— falling back to DDG");
    }
  }

  // ── 2. DuckDuckGo HTML fallback (often bot-blocked) ──
  try {
    const r = await fetch(
      `https://duckduckgo.com/html/?q=${encodeURIComponent(args.query)}`,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; LovableAgent/1.0)" } },
    );
    if (!r.ok) {
      return {
        result: {
          error: `search failed: ${r.status}. Set TAVILY_API_KEY secret for reliable web search.`,
        },
      };
    }
    const html = await r.text();
    const results: { title: string; url: string; snippet: string }[] = [];
    const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null && results.length < limit) {
      const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      let url = m[1];
      const u = url.match(/uddg=([^&]+)/);
      if (u) try { url = decodeURIComponent(u[1]); } catch { /* ignore */ }
      results.push({
        title: stripTags(m[2]).slice(0, 200),
        url,
        snippet: stripTags(m[3]).slice(0, 300),
      });
    }
    if (results.length === 0) {
      return {
        result: {
          query: args.query,
          count: 0,
          results: [],
          warning: "DuckDuckGo returned no parseable results (likely bot-blocked). Add TAVILY_API_KEY secret for reliable search.",
        },
      };
    }
    return { result: { query: args.query, count: results.length, results, provider: "duckduckgo" } };
  } catch (e: any) {
    return { result: { error: `search error: ${e?.message ?? e}` } };
  }
};

export const exec_fetch_url: ToolHandler = async (args, _ctx, _callId) => {
  if (typeof args.url !== "string" || !/^https?:\/\//.test(args.url)) {
    return { result: { error: "valid http(s) url required" } };
  }
  try {
    const r = await fetch(args.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LovableAgent/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return { result: { error: `fetch failed: ${r.status}`, url: args.url } };
    const ct = r.headers.get("content-type") || "";
    let body = await r.text();
    if (/html/i.test(ct)) {
      body = body
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
    const truncated = body.length > 8000;
    return {
      result: {
        url: args.url,
        content_type: ct,
        length: body.length,
        truncated,
        content: body.slice(0, 8000),
      },
    };
  } catch (e: any) {
    return { result: { error: `fetch error: ${e?.message ?? e}` } };
  }
};

export const exec_lookup_npm_package: ToolHandler = async (args, _ctx, _callId) => {
  if (typeof args.name !== "string" || !args.name.trim()) {
    return { result: { error: "name (string) required" } };
  }
  try {
    const r = await fetch(`https://registry.npmjs.org/${encodeURIComponent(args.name)}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return { result: { error: `npm registry: ${r.status}`, name: args.name } };
    const j: any = await r.json();
    const latest = j["dist-tags"]?.latest;
    const meta = latest ? j.versions?.[latest] : null;
    return {
      result: {
        name: j.name,
        latest_version: latest,
        description: j.description ?? meta?.description ?? null,
        homepage: j.homepage ?? null,
        repository: typeof j.repository === "object" ? j.repository?.url : j.repository,
        license: j.license ?? meta?.license ?? null,
        keywords: (j.keywords ?? []).slice(0, 12),
        readme_url: `https://www.npmjs.com/package/${j.name}`,
        types: meta?.types || meta?.typings || null,
        dependencies: meta?.dependencies ? Object.keys(meta.dependencies).slice(0, 20) : [],
      },
    };
  } catch (e: any) {
    return { result: { error: `lookup failed: ${e?.message ?? e}` } };
  }
};
