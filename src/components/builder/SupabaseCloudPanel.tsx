import { useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Database,
  Link2,
  Link2Off,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Table2,
  AlertCircle,
  ExternalLink,
  Play,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import {
  useSupabaseIntegration,
  type SupabaseProjectInfo,
} from "@/hooks/useSupabaseIntegration";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type SqlResult =
  | { kind: "success"; rows: any; ranAt: number }
  | { kind: "blocked"; reason: string }
  | { kind: "error"; message: string };

const SAMPLE_QUERIES = [
  { label: "List public tables", sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" },
  { label: "Row counts", sql: "SELECT schemaname, relname AS table, n_live_tup AS rows\nFROM pg_stat_user_tables\nORDER BY n_live_tup DESC LIMIT 20;" },
  { label: "Recent activity", sql: "SELECT now() AS server_time, current_user AS db_user, version() AS pg_version;" },
];

export const SupabaseCloudPanel = ({ projectId }: { projectId: string }) => {
  const {
    connection,
    link,
    loading,
    refresh,
    startConnect,
    disconnect,
    listSupabaseProjects,
    linkProject,
    unlinkProject,
  } = useSupabaseIntegration(projectId);

  const [connecting, setConnecting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerProjects, setPickerProjects] = useState<SupabaseProjectInfo[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);

  // SQL runner state
  const [sql, setSql] = useState("SELECT now() AS server_time;");
  const [running, setRunning] = useState(false);
  const [sqlResult, setSqlResult] = useState<SqlResult | null>(null);

  const runSql = async () => {
    if (!link) return;
    const trimmed = sql.trim();
    if (!trimmed) return;
    setRunning(true);
    setSqlResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("supabase-run-sql", {
        body: { project_id: projectId, sql: trimmed },
      });
      if (error) throw error;
      if (data?.blocked) {
        setSqlResult({ kind: "blocked", reason: data.reason || "Query blocked by safety guard" });
        toast.warning("Query blocked by safety guard");
      } else if (data?.ok) {
        setSqlResult({ kind: "success", rows: data.result, ranAt: Date.now() });
        toast.success("Query executed");
        if (/\b(create|alter|drop)\b/i.test(trimmed)) {
          setTimeout(() => handleRefreshSchema(), 800);
        }
      } else {
        setSqlResult({ kind: "error", message: data?.error || "Query failed" });
        toast.error(data?.error || "Query failed");
      }
    } catch (e: any) {
      setSqlResult({ kind: "error", message: e?.message || "Network error" });
      toast.error(e?.message || "Network error");
    } finally {
      setRunning(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await startConnect(window.location.pathname);
      toast.success("Supabase connected");
    } catch (e: any) {
      toast.error(e.message || "Connect failed");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect your Supabase account? Linked projects will lose access.")) return;
    await disconnect();
    toast.success("Disconnected");
  };

  const openPicker = async () => {
    setPickerOpen(true);
    setPickerLoading(true);
    try {
      const { projects } = await listSupabaseProjects();
      setPickerProjects(projects || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load projects");
    } finally {
      setPickerLoading(false);
    }
  };

  const handleLink = async (p: SupabaseProjectInfo) => {
    setLinking(p.id);
    try {
      await linkProject({
        supabase_project_ref: p.id,
        supabase_project_name: p.name,
        supabase_org_id: p.organization_id,
        supabase_region: p.region,
      });
      toast.success(`Linked to ${p.name}`);
      setPickerOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Link failed");
    } finally {
      setLinking(null);
    }
  };

  const handleUnlink = async () => {
    if (!confirm("Unlink this Supabase project from the app?")) return;
    await unlinkProject();
    toast.success("Unlinked");
  };

  const handleRefreshSchema = async () => {
    if (!link) return;
    setLinking(link.supabase_project_ref);
    try {
      await linkProject({
        supabase_project_ref: link.supabase_project_ref,
        supabase_project_name: link.supabase_project_name,
        supabase_org_id: link.supabase_org_id ?? undefined,
        supabase_region: link.supabase_region ?? undefined,
      });
      toast.success("Schema refreshed");
    } catch (e: any) {
      toast.error(e.message || "Refresh failed");
    } finally {
      setLinking(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Connection card */}
      <m.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border bg-card p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm">Supabase Account</h3>
              {connection ? (
                <>
                  <p className="text-xs text-muted-foreground truncate">
                    {connection.supabase_email || "Connected"}
                  </p>
                  <Badge variant="secondary" className="mt-2 gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </Badge>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Connect your Supabase account to add database power to your app.
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {connection ? (
            <>
              <Button size="sm" variant="ghost" onClick={refresh}>
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
              <Button size="sm" variant="destructive" onClick={handleDisconnect}>
                Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={handleConnect} loading={connecting}>
              <Link2 className="h-3.5 w-3.5" />
              Connect Supabase
            </Button>
          )}
        </div>
      </m.div>

      {/* Project link card */}
      {connection && (
        <m.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="font-semibold text-sm">Project Database</h3>
              <p className="text-xs text-muted-foreground">
                Pick which Supabase project this app should use.
              </p>
            </div>
          </div>

          {link ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{link.supabase_project_name}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {link.supabase_project_ref}
                    </p>
                  </div>
                  <a
                    href={`https://supabase.com/dashboard/project/${link.supabase_project_ref}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                {link.api_url && (
                  <p className="text-[10px] text-muted-foreground font-mono mt-1 truncate">
                    {link.api_url}
                  </p>
                )}
              </div>

              {/* Schema viewer */}
              <div className="rounded-lg border border-border">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Table2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">
                      Tables ({link.schema_cache?.tables?.length ?? 0})
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleRefreshSchema}
                    loading={linking === link.supabase_project_ref}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
                <ScrollArea className="max-h-64">
                  <div className="p-2 space-y-1">
                    {link.schema_cache?.tables && link.schema_cache.tables.length > 0 ? (
                      link.schema_cache.tables.map((t) => (
                        <details
                          key={t.name}
                          className="group rounded border border-border/50 bg-muted/20"
                        >
                          <summary className="cursor-pointer px-2 py-1.5 text-xs font-mono flex items-center justify-between">
                            <span>{t.name}</span>
                            <span className="text-muted-foreground">
                              {t.columns.length} cols
                            </span>
                          </summary>
                          <div className="px-2 pb-2 space-y-0.5">
                            {t.columns.map((c) => (
                              <div
                                key={c.name}
                                className="flex items-center justify-between text-[10px] font-mono px-1 py-0.5 text-muted-foreground"
                              >
                                <span className="text-foreground">{c.name}</span>
                                <span>{c.type}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      ))
                    ) : (
                      <div className="text-xs text-muted-foreground text-center py-6">
                        No tables yet. Create one in Supabase or via AI.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* SQL runner — server-side guards block destructive ops + reserved schemas */}
              <div className="rounded-lg border border-border">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">SQL Runner</span>
                  </div>
                  <Button size="sm" onClick={runSql} loading={running} disabled={!sql.trim()}>
                    <Play className="h-3 w-3" /> Run
                  </Button>
                </div>
                <div className="p-2 space-y-2">
                  <Textarea
                    value={sql}
                    onChange={(e) => setSql(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        e.preventDefault();
                        runSql();
                      }
                    }}
                    placeholder="SELECT * FROM …"
                    spellCheck={false}
                    className="font-mono text-xs min-h-[110px] resize-y"
                  />
                  <div className="flex flex-wrap gap-1">
                    {SAMPLE_QUERIES.map((q) => (
                      <button
                        key={q.label}
                        onClick={() => setSql(q.sql)}
                        className="text-[10px] font-mono px-2 py-0.5 rounded border border-border bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {q.label}
                      </button>
                    ))}
                    <span className="ml-auto text-[10px] text-muted-foreground self-center">
                      ⌘/Ctrl+Enter to run
                    </span>
                  </div>
                  {sqlResult && (
                    <div className="mt-2 rounded-md border border-border overflow-hidden">
                      {sqlResult.kind === "blocked" && (
                        <div className="flex items-start gap-2 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 p-2 text-xs">
                          <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium">Blocked by safety guard</p>
                            <p className="text-[11px] opacity-80 mt-0.5">{sqlResult.reason}</p>
                          </div>
                        </div>
                      )}
                      {sqlResult.kind === "error" && (
                        <div className="flex items-start gap-2 bg-destructive/10 text-destructive p-2 text-xs">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium">Query failed</p>
                            <p className="text-[11px] opacity-80 mt-0.5 font-mono break-all">{sqlResult.message}</p>
                          </div>
                        </div>
                      )}
                      {sqlResult.kind === "success" && (
                        <div>
                          <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-1 text-[11px]">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>
                              Success ·{" "}
                              {Array.isArray(sqlResult.rows)
                                ? `${sqlResult.rows.length} row${sqlResult.rows.length === 1 ? "" : "s"}`
                                : "ok"}
                            </span>
                          </div>
                          <pre className="text-[10px] font-mono p-2 max-h-[200px] overflow-auto bg-muted/20 text-foreground whitespace-pre">
                            {JSON.stringify(sqlResult.rows, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={openPicker}>
                  Change project
                </Button>
                <Button size="sm" variant="destructive" onClick={handleUnlink}>
                  <Link2Off className="h-3.5 w-3.5" />
                  Unlink
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" onClick={openPicker}>
              <Link2 className="h-3.5 w-3.5" />
              Pick Supabase project
            </Button>
          )}
        </m.div>
      )}

      {/* Notice */}
      {connection && !link && (
        <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            Link a Supabase project so your app can read/write tables, run SQL, and use auth.
          </span>
        </div>
      )}

      {/* Picker dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Choose a Supabase project</DialogTitle>
          </DialogHeader>
          {pickerLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : pickerProjects.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No Supabase projects found. Create one at{" "}
              <a
                href="https://supabase.com/dashboard/projects"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                supabase.com
              </a>
              .
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-2 pr-3">
                <AnimatePresence>
                  {pickerProjects.map((p) => (
                    <m.button
                      key={p.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      onClick={() => handleLink(p)}
                      disabled={!!linking}
                      className="w-full flex items-center justify-between rounded-lg border border-border bg-card hover:bg-muted/50 transition px-3 py-2.5 text-left disabled:opacity-50"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {p.id} • {p.region}
                        </p>
                      </div>
                      {linking === p.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : link?.supabase_project_ref === p.id ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <Link2 className="h-4 w-4 text-muted-foreground" />
                      )}
                    </m.button>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
