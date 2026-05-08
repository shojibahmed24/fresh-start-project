import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Search,
  ShieldCheck,
  ShieldOff,
  Ban,
  CheckCircle2,
  Coins,
  Plus,
  Minus,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type ManagedUser = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  is_admin: boolean;
  is_banned: boolean;
  ban_reason: string;
  credit_balance: number;
  total_purchased: number;
  total_spent: number;
  order_count: number;
};

export const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "admins" | "banned">("all");

  // Dialogs
  const [creditUser, setCreditUser] = useState<ManagedUser | null>(null);
  const [creditDelta, setCreditDelta] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [creditMode, setCreditMode] = useState<"add" | "deduct">("add");

  const [banUser, setBanUser] = useState<ManagedUser | null>(null);
  const [banReason, setBanReason] = useState("");

  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setUsers((data ?? []) as ManagedUser[]);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (filter === "admins" && !u.is_admin) return false;
      if (filter === "banned" && !u.is_banned) return false;
      if (!q) return true;
      return (
        u.email?.toLowerCase().includes(q) ||
        u.display_name?.toLowerCase().includes(q) ||
        u.user_id.toLowerCase().includes(q)
      );
    });
  }, [users, search, filter]);

  const stats = useMemo(
    () => ({
      total: users.length,
      admins: users.filter((u) => u.is_admin).length,
      banned: users.filter((u) => u.is_banned).length,
      revenue: users.reduce((sum, u) => sum + Number(u.total_spent || 0), 0),
    }),
    [users],
  );

  // ----- Actions -----
  const toggleAdmin = async (u: ManagedUser) => {
    if (u.user_id === currentUser?.id && u.is_admin) {
      toast.error("Nije ke demote kora jabe na");
      return;
    }
    const action = u.is_admin ? "demote" : "promote";
    if (!confirm(`Are you sure you want to ${action} ${u.email}?`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_role", {
      _user_id: u.user_id,
      _make_admin: !u.is_admin,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(u.is_admin ? "Demoted to user" : "Promoted to admin");
      refresh();
    }
  };

  const submitBan = async () => {
    if (!banUser) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_ban", {
      _user_id: banUser.user_id,
      _ban: !banUser.is_banned,
      _reason: banReason,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(banUser.is_banned ? "User unbanned" : "User banned");
    setBanUser(null);
    setBanReason("");
    refresh();
  };

  const submitCreditAdjust = async () => {
    if (!creditUser) return;
    const amount = parseInt(creditDelta, 10);
    if (!amount || amount <= 0) {
      toast.error("Valid amount din");
      return;
    }
    const delta = creditMode === "add" ? amount : -amount;
    setBusy(true);
    const { error } = await supabase.rpc("admin_adjust_credits", {
      _user_id: creditUser.user_id,
      _delta: delta,
      _reason: creditReason,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${creditMode === "add" ? "Added" : "Deducted"} ${amount} credits`);
    setCreditUser(null);
    setCreditDelta("");
    setCreditReason("");
    refresh();
  };

  const openCreditDialog = (u: ManagedUser, mode: "add" | "deduct") => {
    setCreditUser(u);
    setCreditMode(mode);
    setCreditDelta("");
    setCreditReason("");
  };

  if (loading) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">Loading users…</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="Total users" value={stats.total} />
        <StatCard label="Admins" value={stats.admins} />
        <StatCard label="Banned" value={stats.banned} tone="danger" />
        <StatCard label="Total revenue" value={`৳${stats.revenue.toLocaleString()}`} tone="success" />
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, name, or ID…"
            className="pl-9"
            maxLength={100}
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-[hsl(0_0%_100%/0.08)] p-1 bg-[hsl(var(--bg-elevated))]">
          {(["all", "admins", "banned"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded-md capitalize transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="icon-sm" onClick={refresh} aria-label="Refresh">
          <RefreshCw size={14} />
        </Button>
      </div>

      {/* User list */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">No users found.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => {
            const initial = (u.display_name?.[0] ?? u.email?.[0] ?? "?").toUpperCase();
            const isMe = u.user_id === currentUser?.id;
            return (
              <div
                key={u.user_id}
                className="flex flex-wrap sm:flex-nowrap items-start sm:items-center gap-3 p-3 sm:p-4 rounded-lg bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.08)]"
              >
                {/* Avatar */}
                <div className="size-10 rounded-full overflow-hidden flex items-center justify-center font-semibold text-background bg-gradient-primary shrink-0">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="text-sm">{initial}</span>
                  )}
                </div>

                {/* Identity */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-sm truncate max-w-full">
                      {u.display_name || u.email?.split("@")[0] || "User"}
                    </span>
                    {isMe && <Badge variant="outline" className="text-[10px]">you</Badge>}
                    {u.is_admin && (
                      <Badge className="text-[10px] bg-primary/15 text-primary border border-primary/30">
                        admin
                      </Badge>
                    )}
                    {u.is_banned && (
                      <Badge className="text-[10px] bg-red-500/15 text-red-300 border border-red-500/30">
                        banned
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                  <div className="text-[11px] text-muted-foreground/70 mt-0.5">
                    Joined {new Date(u.created_at).toLocaleDateString()} · {u.order_count} orders
                  </div>
                  {u.is_banned && u.ban_reason && (
                    <div className="text-[11px] text-red-300/80 mt-1">Reason: {u.ban_reason}</div>
                  )}
                </div>

                {/* Stats */}
                <div className="text-right text-xs shrink-0">
                  <div className="flex items-center gap-1 justify-end text-primary font-medium">
                    <Coins size={12} /> {u.credit_balance}
                  </div>
                  <div className="text-muted-foreground">
                    ৳{Number(u.total_spent).toLocaleString()}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-0.5 sm:gap-1 basis-full sm:basis-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-[hsl(0_0%_100%/0.06)]">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => openCreditDialog(u, "add")}
                    title="Add credits"
                  >
                    <Plus size={14} className="text-emerald-400" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => openCreditDialog(u, "deduct")}
                    title="Deduct credits"
                    disabled={u.credit_balance <= 0}
                  >
                    <Minus size={14} className="text-amber-400" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => toggleAdmin(u)}
                    disabled={busy || (isMe && u.is_admin)}
                    title={u.is_admin ? "Demote" : "Promote to admin"}
                  >
                    {u.is_admin ? (
                      <ShieldOff size={14} className="text-amber-400" />
                    ) : (
                      <ShieldCheck size={14} className="text-primary" />
                    )}
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => {
                      setBanUser(u);
                      setBanReason(u.ban_reason);
                    }}
                    disabled={isMe && !u.is_banned}
                    title={u.is_banned ? "Unban" : "Ban"}
                  >
                    {u.is_banned ? (
                      <CheckCircle2 size={14} className="text-emerald-400" />
                    ) : (
                      <Ban size={14} className="text-destructive" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Credit adjustment dialog */}
      <Dialog open={!!creditUser} onOpenChange={(o) => !o && setCreditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {creditMode === "add" ? "Add credits" : "Deduct credits"}
            </DialogTitle>
            <DialogDescription>
              {creditUser?.email} — current balance:{" "}
              <span className="text-primary font-semibold">{creditUser?.credit_balance}</span>
            </DialogDescription>
          </DialogHeader>
          {creditUser && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Amount</Label>
                <Input
                  type="number"
                  min={1}
                  max={1000000}
                  value={creditDelta}
                  onChange={(e) => setCreditDelta(e.target.value)}
                  placeholder="e.g. 100"
                />
                {creditMode === "deduct" && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Max deductible: {creditUser.credit_balance}
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs">Reason (logged in user history)</Label>
                <Textarea
                  rows={2}
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  placeholder={
                    creditMode === "add"
                      ? "Gift, refund, compensation…"
                      : "Refund processed, abuse, etc."
                  }
                  maxLength={500}
                />
              </div>
              <Button className="w-full" onClick={submitCreditAdjust} loading={busy}>
                {creditMode === "add" ? "Add credits" : "Deduct credits"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Ban dialog */}
      <Dialog open={!!banUser} onOpenChange={(o) => !o && setBanUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{banUser?.is_banned ? "Unban user" : "Ban user"}</DialogTitle>
            <DialogDescription>
              {banUser?.email}{" "}
              {!banUser?.is_banned && "— banned users cannot place new orders."}
            </DialogDescription>
          </DialogHeader>
          {banUser && (
            <div className="space-y-3">
              {!banUser.is_banned && (
                <div>
                  <Label className="text-xs">Reason (visible to user)</Label>
                  <Textarea
                    rows={2}
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="Spam, fraud, ToS violation…"
                    maxLength={500}
                  />
                </div>
              )}
              <Button
                className="w-full"
                variant={banUser.is_banned ? "primary" : "destructive"}
                onClick={submitBan}
                loading={busy}
              >
                {banUser.is_banned ? "Unban user" : "Ban user"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StatCard = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "danger" | "success";
}) => (
  <div className="rounded-lg p-3 bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.08)]">
    <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</div>
    <div
      className={`text-xl font-bold mt-1 ${
        tone === "danger" ? "text-red-300" : tone === "success" ? "text-emerald-300" : ""
      }`}
    >
      {value}
    </div>
  </div>
);
