// ═══════════════════════════════════════════════════════════════════════════
// TOOL SCHEMAS — Edge Functions (5 tools)
// ───────────────────────────────────────────────────────────────────────────
// JSON-Schema definitions for the LLM's function-calling interface.
// Execution logic lives in `../../index.ts` execTool switch (later phase: split
// alongside this file as `./edge-functions-exec.ts`).
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolSchema } from "../registry.ts";

export const EDGE_FUNCTIONS_TOOLS: ToolSchema[] = [
  {
    type: "function",
    function: {
      name: "deploy_edge_function",
      description:
        "Create or replace a Supabase Edge Function (Deno). Saves the file at supabase/functions/<name>/index.ts where the build pipeline picks it up for deployment. Use for backend logic: AI gateway calls, webhooks, third-party API integration, server-side validation. The function receives HTTP requests; always include CORS headers.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Function name (kebab-case), e.g. 'send-email'" },
          code: { type: "string", description: "Complete Deno TypeScript source for the function (full file contents)" },
          verify_jwt: { type: "boolean", description: "Require Supabase JWT to invoke (default true). Set false for public webhooks." },
        },
        required: ["name", "code"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_edge_functions",
      description:
        "List all edge functions in the project (deployed or pending) with their file paths. Use to see what backend functions exist before adding/modifying one — avoids accidental name collisions.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "invoke_edge_function",
      description:
        "Invoke a deployed Supabase Edge Function with a JSON body and return the response (status, body). Use AFTER deploy_edge_function to verify it works end-to-end. Auth is forwarded automatically (the user's JWT). Returns parsed JSON when possible, otherwise raw text. Times out after 15s.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Function name (kebab-case)" },
          method: { type: "string", description: "HTTP method (default POST). One of GET, POST, PUT, DELETE, PATCH." },
          body: { type: "object", description: "Optional JSON body for POST/PUT/PATCH" },
          query: { type: "object", description: "Optional query string params, e.g. {id:'123'}" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_edge_function_logs",
      description:
        "Fetch recent execution logs for a deployed Supabase Edge Function (errors, console.log output, runtime crashes). Use to debug WHY an edge function call from the frontend failed — pair with read_network_requests which shows the failed HTTP call, then this to see what happened server-side.",
      parameters: {
        type: "object",
        properties: {
          function_name: { type: "string", description: "Edge function name (kebab-case, e.g. 'send-email')" },
          limit: { type: "number", description: "Max log lines (default 30, max 100)" },
        },
        required: ["function_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_dependency",
      description:
        "Add an npm package to package.json so it becomes available to import. Use ONLY for packages NOT already in the allowed default set (react, react-dom, lucide-react, framer-motion, @supabase/supabase-js are pre-installed). Never add forbidden packages (next, react-router, react-native, axios). Reads, edits, and re-writes package.json in one step.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "npm package name, e.g. 'date-fns'" },
          version: { type: "string", description: "Semver range, default '^latest'. Optional." },
          dev: { type: "boolean", description: "Add as devDependency. Default false." },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
];
