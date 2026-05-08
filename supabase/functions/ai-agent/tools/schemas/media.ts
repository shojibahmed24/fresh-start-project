// ═══════════════════════════════════════════════════════════════════════════
// TOOL SCHEMAS — Media (1 tools)
// ───────────────────────────────────────────────────────────────────────────
// JSON-Schema definitions for the LLM's function-calling interface.
// Execution logic lives in `../../index.ts` execTool switch (later phase: split
// alongside this file as `./media-exec.ts`).
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolSchema } from "../registry.ts";

export const MEDIA_TOOLS: ToolSchema[] = [
  {
    type: "function",
    function: {
      name: "generate_image",
      description:
        "Generate an image asset (PNG) using AI from a text prompt. Saves the file in the project (default /public/) so it can be referenced as a static asset. Use for placeholder images, hero visuals, icons, illustrations. The image is generated via Lovable AI Gateway (google/gemini-3-flash-image-preview).",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Detailed description of the image (subject, style, colors, mood)" },
          path: { type: "string", description: "Where to save (e.g. '/public/hero.png' or '/src/assets/logo.png')" },
        },
        required: ["prompt", "path"],
        additionalProperties: false,
      },
    },
  },
];
