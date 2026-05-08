// ═══════════════════════════════════════════════════════════════════════════
// TOOL SCHEMAS — Database (5 tools)
// ───────────────────────────────────────────────────────────────────────────
// JSON-Schema definitions for the LLM's function-calling interface.
// Execution logic lives in `../../index.ts` execTool switch (later phase: split
// alongside this file as `./database-exec.ts`).
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolSchema } from "../registry.ts";

export const DATABASE_TOOLS: ToolSchema[] = [
  {
    type: "function",
    function: {
      name: "db_migration",
      description:
        "Create a Supabase SQL migration file (CREATE TABLE, ALTER TABLE, RLS policies, triggers, functions). The migration is saved as a timestamped file under supabase/migrations/ and applied by the build pipeline. ALWAYS include RLS policies for user-scoped tables. Never use this for data SELECT/INSERT — only for schema changes.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Short snake_case name, e.g. 'create_notes_table'" },
          sql: { type: "string", description: "Full SQL statements (CREATE TABLE / ALTER / policies / triggers)" },
          description: { type: "string", description: "Plain-English summary of what this migration does (1-2 sentences)" },
        },
        required: ["name", "sql"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tables",
      description:
        "List all tables in the user's linked Supabase project (public schema) with column names, types, RLS-enabled flag, and row count. Reads from the cached schema snapshot — fast, no SQL roundtrip. Use BEFORE writing migrations or queries to understand existing schema. Returns empty list if Supabase isn't linked yet.",
      parameters: {
        type: "object",
        properties: {
          include_columns: { type: "boolean", description: "Include column details (default true)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "introspect_schema",
      description:
        "Live schema introspection — runs SELECT queries against information_schema and pg_catalog to fetch tables, columns, indexes, RLS policies, foreign keys, or triggers. More accurate than list_tables (no cache lag). Use `target` to pick what to inspect. Returns structured rows.",
      parameters: {
        type: "object",
        properties: {
          target: {
            type: "string",
            enum: ["tables", "columns", "policies", "indexes", "foreign_keys", "triggers", "functions"],
            description: "What to introspect",
          },
          table_name: { type: "string", description: "Optional: filter to a specific table (public schema)" },
        },
        required: ["target"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_query",
      description:
        "Run a read-only SELECT query against the user's linked Supabase database. SELECT statements only — INSERT/UPDATE/DELETE/DDL are rejected. Use for inspecting data when debugging (e.g. `SELECT * FROM orders WHERE status='pending' LIMIT 10`). Reserved schemas (auth, storage, etc.) are blocked. Returns rows or an error.",
      parameters: {
        type: "object",
        properties: {
          sql: { type: "string", description: "A single SELECT statement. No semicolons except a trailing one." },
          limit: { type: "number", description: "Optional row cap (default 100, max 1000) — appended automatically if missing" },
        },
        required: ["sql"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_rls_policy",
      description:
        "Generate a vetted RLS policy template for a table based on the access pattern. Returns ready-to-paste SQL (CREATE POLICY ...) following project conventions: `auth.uid() = user_id` for user-scoped data, `has_role(auth.uid(), 'admin')` for admin overrides, security-definer functions for cross-table checks (avoids recursion). Use BEFORE writing a migration that creates a new table.",
      parameters: {
        type: "object",
        properties: {
          table_name: { type: "string", description: "Target table name (public schema)" },
          pattern: {
            type: "string",
            enum: ["user_owned", "user_owned_admin_override", "public_read_admin_write", "admin_only", "authenticated_read"],
            description: "Access pattern: user_owned = each user only sees/edits own rows; user_owned_admin_override = same + admins see all; public_read_admin_write = anyone reads, only admins write; admin_only = admins only; authenticated_read = any logged-in user reads, only admins write.",
          },
          user_id_column: { type: "string", description: "Column that holds the owning user's auth.uid (default 'user_id'). Only relevant for user_owned patterns." },
        },
        required: ["table_name", "pattern"],
        additionalProperties: false,
      },
    },
  },
];
