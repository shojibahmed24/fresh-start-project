// ═══════════════════════════════════════════════════════════════════════════
// DATABASE EXEC — RLS policy templates
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolHandler } from "./migrations.ts";

export const exec_suggest_rls_policy: ToolHandler = async (args, _ctx, _callId) => {
  const tableRaw = typeof args.table_name === "string" ? args.table_name.trim() : "";
  const table = tableRaw.replace(/[^a-z0-9_]/gi, "");
  if (!table) return { result: { error: "table_name required" } };
  const userCol = (typeof args.user_id_column === "string" ? args.user_id_column : "user_id").replace(/[^a-z0-9_]/gi, "") || "user_id";
  const pattern = String(args.pattern || "");
  const enableRls = `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`;
  let policies = "";
  let notes = "";
  switch (pattern) {
    case "user_owned":
      policies = [
        `CREATE POLICY "Users view own ${table}" ON public.${table} FOR SELECT USING (auth.uid() = ${userCol});`,
        `CREATE POLICY "Users insert own ${table}" ON public.${table} FOR INSERT WITH CHECK (auth.uid() = ${userCol});`,
        `CREATE POLICY "Users update own ${table}" ON public.${table} FOR UPDATE USING (auth.uid() = ${userCol});`,
        `CREATE POLICY "Users delete own ${table}" ON public.${table} FOR DELETE USING (auth.uid() = ${userCol});`,
      ].join("\n");
      notes = `Each user only sees/edits rows where ${userCol} = their auth.uid().`;
      break;
    case "user_owned_admin_override":
      policies = [
        `CREATE POLICY "Users view own ${table}" ON public.${table} FOR SELECT USING (auth.uid() = ${userCol} OR has_role(auth.uid(), 'admin'));`,
        `CREATE POLICY "Users insert own ${table}" ON public.${table} FOR INSERT WITH CHECK (auth.uid() = ${userCol});`,
        `CREATE POLICY "Users update own ${table}" ON public.${table} FOR UPDATE USING (auth.uid() = ${userCol} OR has_role(auth.uid(), 'admin'));`,
        `CREATE POLICY "Admins manage ${table}" ON public.${table} FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));`,
      ].join("\n");
      notes = `Users see only their own rows; admins (via has_role) see/edit everything. Requires the existing has_role(uuid, app_role) security-definer function.`;
      break;
    case "public_read_admin_write":
      policies = [
        `CREATE POLICY "Anyone reads ${table}" ON public.${table} FOR SELECT USING (true);`,
        `CREATE POLICY "Admins manage ${table}" ON public.${table} FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));`,
      ].join("\n");
      notes = `Anyone (including unauthenticated) can read; only admins can insert/update/delete.`;
      break;
    case "admin_only":
      policies = `CREATE POLICY "Admins only ${table}" ON public.${table} FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));`;
      notes = `Only admins can read/write. No public access at all.`;
      break;
    case "authenticated_read":
      policies = [
        `CREATE POLICY "Authenticated read ${table}" ON public.${table} FOR SELECT TO authenticated USING (true);`,
        `CREATE POLICY "Admins write ${table}" ON public.${table} FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));`,
      ].join("\n");
      notes = `Any logged-in user reads; only admins write.`;
      break;
    default:
      return { result: { error: `Unknown pattern: ${pattern}` } };
  }
  const sql = `${enableRls}\n\n${policies}\n`;
  return {
    result: {
      table,
      pattern,
      sql,
      notes,
      next_step: `Pass this SQL into db_migration with name like 'add_rls_${table}'.`,
    },
  };
};
