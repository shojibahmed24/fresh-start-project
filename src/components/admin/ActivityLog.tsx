import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle, RefreshCw, Search, ShieldAlert, Activity, Filter, X,
  CheckCircle2, XCircle, Info, AlertOctagon,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type LogRow = {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  summary: string;
  old_values: any;
  new_values: any;
  severity: "info" | "warn" | "critical";
  ip_address: string | null;
  user_agent: string | null;
  metadata: any;
  created_at: string;
};

type Alert = {
  type: string;
  severity: "info" | "warn" | "critical";
  message: string;
  count: number;
};

const ACTION_OPTIONS = [
  { value: "all", label: "All actions" },
  { value: "order.approved", label: "Order approved" },
  { value: "order.rejected", label: "Order rejected" },
  { value: "order.refunded", label: "Order refunded" },
  { value: "package.created", label: "Package created" },
  { value: "package.updated", label: "Package updated" },
  { value: "package.deleted", label: "Package deleted" },
  { value: "credits.admin_gift", label: "Credits granted" },
  { value: "credits.admin_deduct", label: "Credits deducted" },
  { value: "credits.refund", label: "Credits refunded" },
  { value: "role.admin_granted", label: "Admin granted" },
  { value: "role.admin_revoked", label: "Admin revoked" },
  { value: "user.banned", label: "User banned" },
  { value: "user.unbanned", label: "User unbanned" },
  { value: "settings.updated", label: "Settings changed" },
  { value: "promo.created", label: "Promo created" },
  { value: "promo.updated", label: "Promo updated" },
  { value: "promo.deleted", label: "Promo deleted" },
  { value: "auth.login_failed", label: "Failed login" },
  { value: "auth.signup", label: "Sign up" },
];

const sevColor = (s: string) =>
  s === "critical"
    ? "bg-red-500/15 text-red-300 border-red-500/30"
    : s === "warn"
    ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
    : "bg-sky-500/15 text-sky-300 border-sky-500/30";

const sevIcon = (s: string) =>
  s === "critical" ? <AlertOctagon size={12} /> : s === "warn" ? <AlertTriangle size={12} /> : <Info size={12} />;

export const ActivityLog = () => {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("all");
  const [severity, setSeverity] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<LogRow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_activity", {
      _action: action === "all" ? null : action,
      _severity: severity === "all" ? null : (severity as any),
      _search: search.trim() || null,
      _limit: 300,
    });
    if (error) toast.error(error.message);
    else setLogs((data ?? []) as LogRow[]);

    const { data: a } = await supabase.rpc("admin_get_activity_alerts");
    if (a) {
      setAlerts(((a as any).alerts ?? []) as Alert[]);
      setTotals((a as any).totals ?? {});
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [action, severity]);

  const filteredCount = logs.length;

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Last 24h" value={totals.last_24h ?? 0} icon={<Activity size={14} />} />
        <StatCard label="Last 7 days" value={totals.last_7d ?? 0} icon={<Activity size={14} />} />
        <StatCard label="Warnings (7d)" value={totals.warn_7d ?? 0} icon={<AlertTriangle size={14} />} tone="warn" />
        <StatCard label="Critical (7d)" value={totals.critical_7d ?? 0} icon={<AlertOctagon size={14} />} tone="critical" />
      </div>

      <Tabs defaultValue="logs">
        <TabsList className="bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.06)]">
          <TabsTrigger value="logs" className="gap-2">
            <Activity size={14} /> Activity Log
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2 relative">
            <ShieldAlert size={14} /> Alerts
            {alerts.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-red-500 text-white">
                {alerts.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* LOGS TAB */}
        <TabsContent value="logs" className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search summary or admin email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load()}
                className="pl-9 h-9"
              />
            </div>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-[180px] h-9">
                <Filter size={12} className="mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {ACTION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={load} disabled={loading} leftIcon={<RefreshCw size={12} className={loading ? "animate-spin" : ""} />}>
              Refresh
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">{filteredCount} entries</div>

          <div className="rounded-lg border border-[hsl(0_0%_100%/0.06)] overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Loading…</div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No activity yet</div>
            ) : (
              <div className="divide-y divide-[hsl(0_0%_100%/0.06)]">
                {logs.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setSelected(l)}
                    className="w-full text-left p-3 sm:p-4 hover:bg-[hsl(var(--bg-elevated))] transition flex items-start gap-3"
                  >
                    <Badge className={`${sevColor(l.severity)} gap-1 shrink-0 mt-0.5`}>
                      {sevIcon(l.severity)}
                      {l.severity}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground">{l.action}</span>
                        <span className="text-[11px] text-muted-foreground">·</span>
                        <span className="text-[11px] text-muted-foreground">
                          {format(new Date(l.created_at), "MMM d, HH:mm:ss")}
                        </span>
                      </div>
                      <div className="text-sm mt-0.5 truncate">{l.summary}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        by {l.actor_email || "system"} {l.actor_role && `(${l.actor_role})`}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ALERTS TAB */}
        <TabsContent value="alerts" className="mt-4 space-y-2">
          {alerts.length === 0 ? (
            <div className="rounded-lg border border-[hsl(0_0%_100%/0.06)] p-8 text-center">
              <CheckCircle2 className="mx-auto mb-2 text-green-400" size={32} />
              <div className="font-medium">All clear</div>
              <div className="text-sm text-muted-foreground">No suspicious activity detected.</div>
            </div>
          ) : (
            alerts.map((a, i) => (
              <div
                key={i}
                className={`rounded-lg border p-4 flex items-start gap-3 ${sevColor(a.severity)}`}
              >
                <div className="mt-0.5">{sevIcon(a.severity)}</div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{a.message}</div>
                  <div className="text-[11px] opacity-70 mt-1 font-mono">type: {a.type}</div>
                </div>
                <Badge variant="outline" className="shrink-0">{a.count}</Badge>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge className={sevColor(selected?.severity ?? "info")}>{selected?.severity}</Badge>
              <span className="font-mono text-sm">{selected?.action}</span>
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Summary</div>
                <div>{selected.summary}</div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <Field label="Actor" value={selected.actor_email || "system"} />
                <Field label="Role" value={selected.actor_role || "—"} />
                <Field label="Target type" value={selected.target_type || "—"} />
                <Field label="Target id" value={selected.target_id || "—"} mono />
                <Field label="When" value={format(new Date(selected.created_at), "PPpp")} />
                <Field label="ID" value={selected.id} mono />
              </div>
              {selected.old_values && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Old values</div>
                  <pre className="text-[11px] bg-[hsl(var(--bg-elevated))] p-3 rounded-lg overflow-x-auto border border-[hsl(0_0%_100%/0.06)]">
                    {JSON.stringify(selected.old_values, null, 2)}
                  </pre>
                </div>
              )}
              {selected.new_values && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">New values</div>
                  <pre className="text-[11px] bg-[hsl(var(--bg-elevated))] p-3 rounded-lg overflow-x-auto border border-[hsl(0_0%_100%/0.06)]">
                    {JSON.stringify(selected.new_values, null, 2)}
                  </pre>
                </div>
              )}
              {selected.metadata && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Metadata</div>
                  <pre className="text-[11px] bg-[hsl(var(--bg-elevated))] p-3 rounded-lg overflow-x-auto border border-[hsl(0_0%_100%/0.06)]">
                    {JSON.stringify(selected.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StatCard = ({
  label, value, icon, tone,
}: { label: string; value: number; icon: React.ReactNode; tone?: "warn" | "critical" }) => (
  <div className={`rounded-lg p-4 border ${
    tone === "critical" ? "border-red-500/30 bg-red-500/5"
      : tone === "warn" ? "border-amber-500/30 bg-amber-500/5"
      : "border-[hsl(0_0%_100%/0.06)] bg-[hsl(var(--bg-elevated))]"
  }`}>
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
      {icon} {label}
    </div>
    <div className="text-2xl font-bold tracking-tight">{value}</div>
  </div>
);

const Field = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div>
    <div className="text-muted-foreground mb-0.5">{label}</div>
    <div className={mono ? "font-mono text-[11px] break-all" : "break-all"}>{value}</div>
  </div>
);
