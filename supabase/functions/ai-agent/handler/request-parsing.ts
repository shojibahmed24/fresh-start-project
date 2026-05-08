// ═══════════════════════════════════════════════════════════════════════════
// HANDLER — request body parsing + multimodal attachment processing
// ───────────────────────────────────────────────────────────────────────────
// Phase 9 — Multi-modal attachments:
// The client may pass `attachments: [{name,kind,size,content,mime}]`
// where `content` is either plain text (kind="file") or a data URL
// (kind="image"). We split them into:
//   • imageAttachments → injected as `image_url` parts in the first user
//     message so the multimodal model can SEE the screenshot/Figma export.
//   • textAttachments  → appended to the text portion as labeled fences
//     (PDFs are pre-parsed client-side or kept as raw text excerpts).
// ═══════════════════════════════════════════════════════════════════════════

import { corsHeaders } from "../cors.ts";
import { DEFAULT_MODEL } from "../config.ts";
import { trimResumedHistory } from "../llm/history.ts";

export type RawAttachment = {
  id?: string;
  name: string;
  kind: "file" | "image";
  size?: number;
  content: string;
  mime?: string;
};

export type ParsedRequest = {
  projectId: string;
  userMessage: string;
  priorMessages: any[];
  resumedHistory: any[];
  model: string;
  attachments: RawAttachment[];
  imageAttachments: RawAttachment[];
  textAttachments: RawAttachment[];
  attachmentTextBlock: string;
};

const jsonResp = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export async function parseRequest(req: Request): Promise<ParsedRequest | Response> {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResp({ error: "Invalid JSON" }, 400);
  }

  const projectId: string | undefined = body.projectId;
  const userMessage: string | undefined = body.message;
  if (!projectId || !userMessage) {
    return jsonResp({ error: "projectId and message are required" }, 400);
  }

  const priorMessages: any[] = Array.isArray(body.messages) ? body.messages : [];
  // resumedHistory: full OpenAI-format conversation (assistant tool_calls,
  // tool results, user messages) returned by the previous `paused` event.
  // When present, we use it directly instead of rebuilding from priorMessages —
  // this preserves all tool_call_ids and avoids dedup / reordering bugs.
  const resumedHistoryRaw: any[] = Array.isArray(body.resumedHistory) ? body.resumedHistory : [];
  // Priority 4: resumed history can balloon to 20k+ tokens because it
  // includes every prior tool result. Trim large tool-message bodies down
  // to summaries before the loop ever sees them.
  const resumedHistory = trimResumedHistory(resumedHistoryRaw);
  const model: string = typeof body.model === "string" ? body.model : DEFAULT_MODEL;

  // Sanity caps to protect token budget: max 6 attachments, max 200KB text each.
  const rawAttachments: RawAttachment[] = Array.isArray(body.attachments)
    ? body.attachments.filter((a: any) => a && typeof a.name === "string" && typeof a.content === "string")
    : [];
  const attachments = rawAttachments.slice(0, 6).map((a) => ({
    id: a.id || crypto.randomUUID(),
    name: a.name,
    kind: a.kind === "image" ? "image" : "file",
    size: a.size ?? a.content.length,
    mime: a.mime || (a.kind === "image" ? "image/png" : "text/plain"),
    content: a.kind === "image"
      ? a.content // keep data URL intact for image_url
      : (a.content || "").slice(0, 200_000),
  })) as RawAttachment[];
  const imageAttachments = attachments.filter((a) => a.kind === "image" && /^data:image\//.test(a.content));
  const textAttachments = attachments.filter((a) => a.kind !== "image");

  const attachmentTextBlock = textAttachments.length > 0
    ? "\n\n## Attached files\n" + textAttachments.map((a) => {
        const ext = (a.name.split(".").pop() || "").toLowerCase();
        const lang = ["ts","tsx","js","jsx","json","css","html","md","py","sql","yaml","yml","sh","bash"].includes(ext) ? ext : "";
        return `\n### ${a.name} (${a.size} bytes)\n\`\`\`${lang}\n${a.content}\n\`\`\``;
      }).join("\n")
    : "";

  return {
    projectId,
    userMessage,
    priorMessages,
    resumedHistory,
    model,
    attachments,
    imageAttachments,
    textAttachments,
    attachmentTextBlock,
  };
}
