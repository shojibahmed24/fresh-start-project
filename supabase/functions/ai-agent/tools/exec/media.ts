// ═══════════════════════════════════════════════════════════════════════════
// TOOL EXECUTORS — Media (1 handlers)
// ───────────────────────────────────────────────────────────────────────────
// Handlers for tools defined in ../schemas/media.ts. Dispatched by
// ./index.ts → execTool(name, args, ctx, callId).
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolContext } from "../../types.ts";

export type ToolHandler = (
  args: any,
  ctx: ToolContext,
  callId: string,
) => Promise<{ result: any; askUser?: boolean }>;

export const exec_generate_image: ToolHandler = async (args, ctx, callId) => {
if (typeof args.prompt !== "string" || typeof args.path !== "string") {
  return { result: { error: "prompt and path required" } };
}
const apiKey = Deno.env.get("LOVABLE_API_KEY");
if (!apiKey) return { result: { error: "LOVABLE_API_KEY not set" } };
try {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-image-preview",
      messages: [{ role: "user", content: args.prompt }],
      modalities: ["image", "text"],
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    return { result: { error: `image gen failed: ${r.status} ${t.slice(0, 200)}` } };
  }
  const j = await r.json();
  const imgUrl: string | undefined = j?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!imgUrl) return { result: { error: "no image returned by model" } };
  // Strip data URI prefix → store the raw base64 as text. Build pipeline
  // can decode. (We don't have storage in this edge fn.)
  const m = imgUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return { result: { error: "unexpected image format" } };
  const dataUri = imgUrl; // store the full data URI as file content
  const path = args.path.startsWith("/") ? args.path : `/${args.path}`;
  const { error } = await ctx.supabase.from("project_files").upsert(
    {
      project_id: ctx.projectId,
      user_id: ctx.userId,
      path,
      content: dataUri,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id,path" },
  );
  if (error) return { result: { error: error.message } };
  ctx.filesChanged.push({ path, action: "created" });
  return {
    result: {
      success: true,
      path,
      mime: m[1],
      size_b64: m[2].length,
      note: "Saved as data-URI in project_files. Reference via import or <img src='/path'>.",
    },
  };
} catch (e: any) {
  return { result: { error: `image error: ${e?.message ?? e}` } };
}
};

export const MEDIA_EXEC: Record<string, ToolHandler> = {
  generate_image: exec_generate_image,
};
