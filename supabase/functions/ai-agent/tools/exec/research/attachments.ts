// ═══════════════════════════════════════════════════════════════════════════
// RESEARCH EXEC — attachments
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolContext } from "../../../types.ts";
import type { ToolHandler } from "./web.ts";

export const exec_read_attachment: ToolHandler = async (args, ctx: ToolContext, _callId) => {
  const list = ctx.attachments ?? [];
  if (!args.name) {
    return {
      result: {
        count: list.length,
        attachments: list.map((a) => ({ name: a.name, kind: a.kind, size: a.size, mime: a.mime })),
        note: list.some((a) => a.kind === "image")
          ? "Image attachments are already visible in your context — describe/use them directly without calling this tool."
          : undefined,
      },
    };
  }
  const found = list.find((a) => a.name === args.name);
  if (!found) {
    return { result: { error: `Attachment "${args.name}" not found.`, available: list.map((a) => a.name) } };
  }
  if (found.kind === "image") {
    return { result: { name: found.name, kind: "image", note: "Image already visible in context — reference it directly." } };
  }
  return {
    result: {
      name: found.name,
      kind: found.kind,
      size: found.size,
      mime: found.mime,
      content: found.content,
    },
  };
};
