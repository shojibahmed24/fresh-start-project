import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertOctagon, AlertTriangle, ShieldAlert, RefreshCw, Check, X,
  Eye, Globe, Hash, Phone, Zap, UserX, Info, Ban,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type FlagDetail = {
  id: string;
  type: string;
  severity: "info" | "warn" | "critical";
  reason: string;
  details: any;
  resolved: boolean;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
};

type FlaggedOrder = {
  order_id: string;
  user_id: string;
  user_email: string | null;
  display_name: string | null;
  package_name: string;
  amount: number;
  status: string;
  payment_method: string;
  sender_account: string | null;
  transaction_id: string | null;
  ip_address: string | null;
  risk_score: number;
  needs_review: boolean;
  created_at: string;
  flag_count: number;
  flag_types: string[];
  max_severity: "info" | "warn" | "critical";
  flags: FlagDetail[];
};

const FLAG_ICONS: Record<string, JSX.Element> = {
  duplicate_txid: <Hash size={12} />,
  repeat_account: <Phone size={12} />,
  repeat_ip: <Globe size={12} />,
  velocity: <Zap size={12} />,
  banned_user: <UserX size={12} />,
  high_risk_score: <AlertOctagon size={12} />,
  mismatched_account: <Info size={12} />,
};

const FLAG_LABELS: Record<string, string> = {
  duplicate_txid: "Duplicate TX",
  repeat_account: "Repeat account",
  repeat_ip: "Repeat IP",
  velocity: "Velocity",
  banned_user: "Banned user",
  high_risk_score: "High risk",
  mismatched_account: "Mismatch",
};

const sevColor = (s: string) =>
  s === "critical"
    ? "bg-red-500/15 text-red-300 border-red-500/30"
    : s === "warn"
    ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
    : "bg-sky-500/15 text-sky-300 border-sky-500/30";

const riskColor = (n: number) =>
  n >= 80 ? "text-red-400" : n >= 40 ? "text-amber-400" : "text-sky-400";

export const FraudReview = () => {
  const [orders, setOrders] = useState<FlaggedOrder[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [selected, setSelected] = useState<FlaggedOrder | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [ordersRes, statsRes] = await Promise.all([
      supabase.rpc("admin_list_flagged_orders", { _resolved: showResolved, _limit: 200 }),
      supabase.rpc("admin_fraud_stats"),
    ]);
    if (ordersRes.error) toast.error(ordersRes.error.message);
    else setOrders((ordersRes.data ?? []) as FlaggedOrder[]);
    if (statsRes.data) setStats(statsRes.data as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [showResolved]);

  const resolveAll = async () => {
    if (!selected) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_resolve_order_flags", {
      _order_id: selected.order_id,
      _note: resolveNote.trim(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Flags resolved");
    setSelected(null);
    setResolveNote("");
    load();
  };

  const approveOrder = async () => {
    if (!selected) return;
    setBusy(true);
    const { error: rErr } = await supabase.rpc("admin_resolve_order_flags", {
      _order_id: selected.order_id,
      _note: resolveNote.trim() || "Approved after review",
    });
    if (rErr) {
      setBusy(false);
      return toast.error(rErr.message);
    }
    const { error } = await supabase
      .from("orders")
      .update({ status: "approved" })
      .eq("id", selected.order_id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Order approved");
    setSelected(null);
    setResolveNote("");
    load();
  };

  const rejectOrder = async () => {
    if (!selected) return;
    setBusy(true);
    const { error: rErr } = await supabase.rpc("admin_resolve_order_flags", {
      _order_id: selected.order_id,
      _note: resolveNote.trim() || "Rejected — fraud suspected",
    });
    if (rErr) {
      setBusy(false);
      return toast.error(rErr.message);
    }
    const { error } = await supabase
      .from("orders")
      .update({
        status: "rejected",
        admin_notes: resolveNote.trim() || "Rejected — fraud suspected",
      })
      .eq("id", selected.order_id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Order rejected");
    setSelected(null);
    setResolveNote("");
    load();
  };

  // Reject the order AND ban the user — for clear-cut fraud cases.
  const rejectAndBan = async () => {
    if (!selected) return;
    if (!confirm(`Ban user ${selected.user_email ?? selected.user_id} permanently?\nThey will no longer be able to create orders, builds, or support tickets.`)) {
      return;
    }
    setBusy(true);
    const note = resolveNote.trim() || "Fraud — order rejected and user banned";
    const { error: rErr } = await supabase.rpc("admin_resolve_order_flags", {
      _order_id: selected.order_id,
      _note: note,
    });
    if (rErr) { setBusy(false); return toast.error(rErr.message); }
    const { error: oErr } = await supabase
      .from("orders")
      .update({ status: "rejected", admin_notes: note })
      .eq("id", selected.order_id);
    if (oErr) { setBusy(false); return toast.error(oErr.message); }
    const { error: bErr } = await supabase.rpc("admin_ban_user", {
      _user_id: selected.user_id,
      _reason: note,
    });
    setBusy(false);
    if (bErr) return toast.error(bErr.message);
    toast.success("Order rejected and user banned");
    setSelected(null);
    setResolveNote("");
    load();
  };

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Pending review" value={stats.pending_review ?? 0} tone="critical" icon={<ShieldAlert size={14} />} />
        <StatCard label="Open flags" value={stats.total_flags_open ?? 0} tone="warn" icon={<AlertTriangle size={14} />} />
        <StatCard label="Flags 24h" value={stats.flags_24h ?? 0} icon={<AlertTriangle size={14} />} />
        <StatCard label="Resolved" value={stats.total_flags_resolved ?? 0} icon={<Check size={14} />} />
      </div>

      {/* By type */}
      {stats.by_type && Object.keys(stats.by_type).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(stats.by_type).map(([k, v]: any) => (
            <Badge key={k} variant="outline" className="gap-1.5">
              {FLAG_ICONS[k] ?? <Info size={12} />}
              {FLAG_LABELS[k] ?? k}: {v as number}
            </Badge>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <Select value={showResolved ? "all" : "pending"} onValueChange={(v) => setShowResolved(v === "all")}>
          <SelectTrigger className="w-full sm:w-[200px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending review only</SelectItem>
            <SelectItem value="all">All flagged orders</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={load} disabled={loading} leftIcon={<RefreshCw size={12} className={loading ? "animate-spin" : ""} />} className="w-full sm:w-auto">
          Refresh
        </Button>
      </div>

      {/* Orders list */}
      <div className="rounded-lg border border-[hsl(0_0%_100%/0.06)] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center">
            <Check className="mx-auto mb-2 text-green-400" size={32} />
            <div className="font-medium">No flagged orders</div>
            <div className="text-sm text-muted-foreground">All clear — no fraud signals detected.</div>
          </div>
        ) : (
          <div className="divide-y divide-[hsl(0_0%_100%/0.06)]">
            {orders.map((o) => (
              <div key={o.order_id} className="p-3 sm:p-4 hover:bg-[hsl(var(--bg-elevated))] transition">
                <div className="flex flex-wrap items-start gap-3">
                  <div className={`text-2xl font-bold tracking-tight ${riskColor(o.risk_score)} shrink-0 w-12 text-center`}>
                    {o.risk_score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-medium">{o.package_name}</span>
                      <span className="text-sm text-muted-foreground">৳{o.amount}</span>
                      <Badge className={sevColor(o.max_severity)}>{o.max_severity}</Badge>
                      <Badge variant="outline" className="text-[10px]">{o.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {o.user_email || "unknown"} · {format(new Date(o.created_at), "MMM d, HH:mm")}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {o.flag_types.map((t, i) => (
                        <Badge key={i} variant="outline" className="gap-1 text-[10px]">
                          {FLAG_ICONS[t] ?? <Info size={10} />}
                          {FLAG_LABELS[t] ?? t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setSelected(o)} leftIcon={<Eye size={12} />} className="w-full sm:w-auto">
                    Review
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setResolveNote(""); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert size={18} />
              Fraud review
              {selected && (
                <span className={`ml-2 text-2xl font-bold ${riskColor(selected.risk_score)}`}>
                  {selected.risk_score}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              {/* Order summary */}
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 p-3 rounded-lg bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.06)]">
                <Field label="Package" value={selected.package_name} />
                <Field label="Amount" value={`৳${selected.amount}`} />
                <Field label="User" value={selected.user_email || "?"} />
                <Field label="Method" value={selected.payment_method} />
                <Field label="Sender account" value={selected.sender_account || "—"} mono />
                <Field label="Transaction ID" value={selected.transaction_id || "—"} mono />
                <Field label="IP address" value={selected.ip_address || "—"} mono />
                <Field label="Status" value={selected.status} />
              </div>

              {/* Flags */}
              <div>
                <div className="text-xs text-muted-foreground mb-2">Flags ({selected.flags.length})</div>
                <div className="space-y-2">
                  {selected.flags.map((f) => (
                    <div key={f.id} className={`p-3 rounded-lg border ${sevColor(f.severity)} ${f.resolved ? "opacity-50" : ""}`}>
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5">{FLAG_ICONS[f.type] ?? <Info size={12} />}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{FLAG_LABELS[f.type] ?? f.type}</span>
                            {f.resolved && <Badge variant="outline" className="text-[10px]">resolved</Badge>}
                          </div>
                          <div className="text-xs mt-0.5">{f.reason}</div>
                          {f.resolution_note && (
                            <div className="text-[11px] mt-1 opacity-70 italic">Note: {f.resolution_note}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resolution note */}
              {selected.flags.some((f) => !f.resolved) && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Resolution note (optional)</div>
                  <Input
                    value={resolveNote}
                    onChange={(e) => setResolveNote(e.target.value)}
                    placeholder="e.g. Verified via WhatsApp, legit user"
                  />
                </div>
              )}
            </div>
          )}
          {selected && selected.flags.some((f) => !f.resolved) && (
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={resolveAll} disabled={busy} className="flex-1">
                Mark reviewed (no action)
              </Button>
              {selected.status === "pending" && (
                <>
                  <Button variant="destructive" onClick={rejectOrder} disabled={busy} leftIcon={<X size={14} />} className="flex-1">
                    Reject order
                  </Button>
                  <Button onClick={approveOrder} disabled={busy} leftIcon={<Check size={14} />} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                    Approve anyway
                  </Button>
                </>
              )}
              <Button
                variant="destructive"
                onClick={rejectAndBan}
                disabled={busy}
                leftIcon={<Ban size={14} />}
                className="flex-1 bg-red-700 hover:bg-red-800 text-white"
                title="Reject this order and permanently ban the user"
              >
                Reject &amp; ban user
              </Button>
            </DialogFooter>
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
    <div className="text-[11px] text-muted-foreground mb-0.5">{label}</div>
    <div className={mono ? "font-mono text-xs break-all" : "text-sm break-all"}>{value}</div>
  </div>
);
