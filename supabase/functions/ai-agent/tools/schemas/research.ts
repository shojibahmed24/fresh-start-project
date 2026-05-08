// ═══════════════════════════════════════════════════════════════════════════
// TOOL SCHEMAS — Research (7 tools)
// ───────────────────────────────────────────────────────────────────────────
// JSON-Schema definitions for the LLM's function-calling interface.
// Execution logic lives in `../../index.ts` execTool switch (later phase: split
// alongside this file as `./research-exec.ts`).
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolSchema } from "../registry.ts";

export const RESEARCH_TOOLS: ToolSchema[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web for up-to-date information: library docs, API changes, error solutions, npm package details. Returns a list of titles + URLs + short snippets. Use BEFORE adding an unfamiliar dependency or implementing an integration you're not sure about. Then call fetch_url on the most promising result for the full content.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query (be specific, include library/version)" },
          limit: { type: "number", description: "Max results (default 5, max 10)" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_url",
      description:
        "Fetch the text content of a public URL (docs page, README, API spec). Returns the body as plain text (HTML stripped, max ~8000 chars). Use after web_search to read the actual documentation before coding. Never use for private/auth-required URLs.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Full https:// URL" },
        },
        required: ["url"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lookup_npm_package",
      description:
        "Look up a package on the npm registry. Returns the latest version, description, homepage, repository, license, and a link to the README. Use BEFORE asking the user to install a dependency, to verify the package actually exists, see what it does, and confirm the latest version. Much more reliable than web_search for package metadata.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Exact npm package name (e.g. 'zod', '@tanstack/react-query')" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_attachment",
      description:
        "List or read the user's chat attachments for this turn. Without arguments, returns a list of all attachments (name, kind, size). Pass `name` to read the full text content of a specific text/code attachment. Images are already injected into your view at the top of this conversation — you can REFERENCE them directly (e.g. 'the screenshot you shared'); use this tool only for text/code/PDF/document files.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Optional: attachment name to read in full. Omit to list all." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_console_logs",
      description:
        "Read recent runtime errors and console messages captured from the user's live preview. Use when the user reports a bug, blank screen, or unexpected behavior — this shows real browser-side errors (stack traces, failed network calls, React render errors) so you can diagnose without guessing.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max entries to return (default 20, max 50)" },
          search: { type: "string", description: "Optional substring filter on the error message" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_network_requests",
      description:
        "Read recent network/API request failures captured from the user's live preview (4xx/5xx, CORS errors, fetch failures). Use when the user reports a feature is broken or data isn't loading — this shows real failed requests with status codes and URLs.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max entries (default 20, max 50)" },
          status_filter: { type: "string", description: "Optional: 'errors' (4xx/5xx only) or 'all' (default 'errors')" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_snippet",
      description:
        "Fetch the FULL TSX code of one premium reference snippet by exact name. The iter-0 system prompt only lists snippet names + why (to save tokens) — call this when you're ready to adapt a specific snippet into a component. Returns code + required imports (framer-motion, lucide icons). Adapt: rename, swap palette, wire to real props. Never copy verbatim.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Exact snippet name from the references list (e.g. 'Sticky mini-player with scrub bar')",
          },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
];
