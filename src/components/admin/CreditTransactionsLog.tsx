import { useEffect, useMemo, useState } from "react";
import { Download, Filter, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type CreditSource =
  | "purchase"
  | "admin_gift"
  | "admin_deduct"
  | "refund"
  | "ai_usage"
  | "promo_bonus"
  | "signup_bonus";

type Tx = {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  delta: number;
  balance_after: number;
  source: CreditSource;
  reason: string;
  reference_id: string | null;
  created_at: string;
};

const SOURCE_META: Record<CreditSource, { label: string; cls: string }> = {
  purchase: { label: "Purchase", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  admin_gift: { label: "Admin gift", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  admin_deduct: { label: "Admin deduct", cls: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
  refund: { label: "Refund", cls: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  ai_usage: { label: "AI usage", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
  promo_bonus: { label: "Promo bonus", cls: "bg-pink-500/15 text-pink-300 border-pink-500/30" },
  signup_bonus: { label: "Signup", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
};

export const CreditTransactionsLog = () => {
  const [rows, setRows] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<"all" | CreditSource>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_credit_transactions", {
      _user_id: null,
      _source: source === "all" ? null : source,
      _from: from ? new Date(from).toISOString() : null,
      _to: to ? new Date(to + "T23:59:59").toISOString() : null,
      _limit: 1000,
    });
    if (error) toast.error(error.message);
    else setRows((data ?? []) as Tx[]);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, from, to]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.email ?? "").toLowerCase().includes(q) ||
        (r.display_name ?? "").toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q) ||
        r.user_id.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const totals = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const r of filtered) {
      if (r.delta > 0) added += r.delta;
      else removed += r.delta;
    }
    return { added, removed, count: filtered.length };
  }, [filtered]);

  const exportCsv = () => {
    const header = ["Date", "User", "Email", "Source", "Delta", "Balance after", "Reason", "Ref ID"];
    const lines = filtered.map((r) =>
      [
        new Date(r.created_at).toISOString(),
        r.display_name ?? "",
        r.email ?? "",
        r.source,
        r.delta,
        r.balance_after,
        r.reason.split('"').join('""'),
        r.reference_id ?? "",
      ]
        .map((v) => `"${String(v ?? "")}"`)
        .join(","),
    );
    const csv = [header.map((h) => `"${h}"`).join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `credit-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} rows`);
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl p-4 bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.08)]">
          <div className="text-xs text-muted-foreground">Transactions</div>
          <div className="text-2xl font-bold">{totals.count}</div>
        </div>
        <div className="rounded-xl p-4 bg-[hsl(var(--bg-elevated))] border border-emerald-500/20">
          <div className="text-xs text-muted-foreground">Credits added</div>
          <div className="text-2xl font-bold text-emerald-300">+{totals.added.toLocaleString()}</div>
        </div>
        <div className="rounded-xl p-4 bg-[hsl(var(--bg-elevated))] border border-red-500/20">
          <div className="text-xs text-muted-foreground">Credits removed</div>
          <div className="text-2xl font-bold text-red-300">{totals.removed.toLocaleString()}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl p-3 bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.08)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-2 items-end">
          <div className="lg:flex-1 lg:min-w-[180px] sm:col-span-2">
            <Label className="text-xs flex items-center gap-1">
              <Search size={12} /> Search
            </Label>
            <Input
              placeholder="email, name, reason…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="lg:min-w-[140px] sm:col-span-2">
            <Label className="text-xs flex items-center gap-1">
              <Filter size={12} /> Source
            </Label>
            <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {(Object.keys(SOURCE_META) as CreditSource[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {SOURCE_META[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button variant="ghost" size="sm" onClick={refresh} leftIcon={<RefreshCw size={14} />} className="w-full sm:w-auto">
            Refresh
          </Button>
          <Button size="sm" onClick={exportCsv} leftIcon={<Download size={14} />} className="w-full sm:w-auto">
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">No transactions match filters.</div>
      ) : (
        <div className="rounded-xl border border-[hsl(0_0%_100%/0.08)] overflow-hidden">
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[hsl(var(--bg-elevated))] text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">User</th>
                  <th className="text-left p-3">Source</th>
                  <th className="text-right p-3">Delta</th>
                  <th className="text-right p-3">Balance</th>
                  <th className="text-left p-3">Reason</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-[hsl(0_0%_100%/0.06)] bg-[hsl(var(--bg-elevated))]/40 hover:bg-[hsl(var(--bg-elevated))]"
                  >
                    <td className="p-3 text-xs whitespace-nowrap text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{r.display_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.email ?? r.user_id.slice(0, 8)}</div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={SOURCE_META[r.source].cls}>
                        {SOURCE_META[r.source].label}
                      </Badge>
                    </td>
                    <td
                      className={`p-3 text-right font-mono font-semibold ${
                        r.delta > 0 ? "text-emerald-300" : "text-red-300"
                      }`}
                    >
                      {r.delta > 0 ? "+" : ""}
                      {r.delta}
                    </td>
                    <td className="p-3 text-right font-mono text-muted-foreground">{r.balance_after}</td>
                    <td className="p-3 text-xs text-muted-foreground max-w-[280px] truncate" title={r.reason}>
                      {r.reason || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y divide-[hsl(0_0%_100%/0.06)]">
            {filtered.map((r) => (
              <div key={r.id} className="p-3 bg-[hsl(var(--bg-elevated))]">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{r.display_name ?? r.email ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{r.email}</div>
                  </div>
                  <div
                    className={`font-mono font-semibold text-sm ${
                      r.delta > 0 ? "text-emerald-300" : "text-red-300"
                    }`}
                  >
                    {r.delta > 0 ? "+" : ""}
                    {r.delta}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={SOURCE_META[r.source].cls}>
                    {SOURCE_META[r.source].label}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    bal: {r.balance_after}
                  </span>
                  <span className="text-[11px] text-muted-foreground ml-auto">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                {r.reason && (
                  <div className="mt-1.5 text-xs text-muted-foreground">{r.reason}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
