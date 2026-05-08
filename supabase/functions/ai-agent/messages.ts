// ═══════════════════════════════════════════════════════════════════════════
// MULTIMODAL HELPER — build a user message that can include images
// ───────────────────────────────────────────────────────────────────────────
// OpenAI/OpenRouter chat-completion content can be either a plain string OR
// an array of content parts. When the user attaches images we use the array
// form so vision-capable models (Gemini 2.5 Flash, GPT-4o, Claude Sonnet)
// can actually SEE the screenshot. When there are no images we keep the
// cheap string form to avoid extra serialization overhead.
// ═══════════════════════════════════════════════════════════════════════════

export interface ImageAttachment {
  name: string;
  content: string; // data URL (data:image/png;base64,...)
  mime?: string;
}

export function buildUserMessage(
  text: string,
  imageAttachments: ImageAttachment[],
): { role: "user"; content: any } {
  if (!imageAttachments || imageAttachments.length === 0) {
    return { role: "user", content: text };
  }
  const parts: any[] = [{ type: "text", text }];
  for (const img of imageAttachments) {
    // The "content" field is a data URL. The OpenAI/OpenRouter schema
    // accepts both http(s) URLs and data URLs in image_url.url.
    parts.push({
      type: "image_url",
      image_url: { url: img.content },
    });
  }
  return { role: "user", content: parts };
}
