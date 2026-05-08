import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, X, RotateCcw, Plus, CheckSquare, Square, ListChecks } from "lucide-react";
import { toast } from "sonner";

type Order = {
  id: string;
  user_id: string;
  package_id: string;
  package_name: string;
  amount: number;
  credits: number;
  payment_method: string;
  sender_account: string;
  transaction_id: string;
  crypto_currency: string;
  status: "pending" | "approved" | "rejected" | "refunded";
  admin_notes: string;
  refund_reason?: string;
  refunded_credits?: number;
  refunded_at?: string;
  created_at: string;
};

type Pkg = { id: string; name: string; credits: number; price: number };

const statusMeta: Record<Order["status"], string> = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  rejected: "bg-red-500/15 text-red-300 border-red-500/30",
  refunded: "bg-violet-500/15 text-violet-300 border-violet-500/30",
};

export const OrdersManager = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [filter, setFilter] = useState<"all" | Order["status"]>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Dialogs
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [refundOrder, setRefundOrder] = useState<Order | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({
    user_id: "",
    package_id: "",
    credits: 100,
    amount: 0,
    package_name: "",
    payment_method: "bkash" as "bkash" | "nagad" | "rocket" | "crypto",
    notes: "",
  });

  const refresh = async () => {
    const [ord, pkg] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("packages").select("id,name,credits,price").order("sort_order"),
    ]);
    setOrders((ord.data ?? []) as Order[]);
    setPackages((pkg.data ?? []) as Pkg[]);
  };

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(
    () => (filter === "all" ? orders : orders.filter((o) => o.status === filter)),
    [orders, filter],
  );

  const pendingIds = useMemo(
    () => filtered.filter((o) => o.status === "pending").map((o) => o.id),
    [filtered],
  );
  const allSelected = pendingIds.length > 0 && pendingIds.every((id) => selected.has(id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pendingIds));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const decideOrder = async (status: "approved" | "rejected") => {
    if (!reviewOrder) return;
    const { error } = await supabase
      .from("orders")
      .update({ status, admin_notes: adminNotes })
      .eq("id", reviewOrder.id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Approved & credits added" : "Rejected");
    setReviewOrder(null);
    setAdminNotes("");
    refresh();
  };

  const bulkApprove = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const { data, error } = await supabase.rpc("admin_bulk_approve_orders", { _order_ids: ids });
    if (error) return toast.error(error.message);
    toast.success(`Approved ${data ?? ids.length} orders`);
    setSelected(new Set());
    refresh();
  };

  const bulkReject = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const { data, error } = await supabase.rpc("admin_bulk_reject_orders", {
      _order_ids: ids,
      _reason: bulkRejectReason,
    });
    if (error) return toast.error(error.message);
    toast.success(`Rejected ${data ?? ids.length} orders`);
    setSelected(new Set());
    setBulkRejectOpen(false);
    setBulkRejectReason("");
    refresh();
  };

  const submitRefund = async () => {
    if (!refundOrder) return;
    const { error } = await supabase.rpc("admin_refund_order", {
      _order_id: refundOrder.id,
      _reason: refundReason,
    });
    if (error) return toast.error(error.message);
    toast.success("Refunded");
    setRefundOrder(null);
    setRefundReason("");
    refresh();
  };

  const submitManual = async () => {
    if (!manual.user_id.trim()) return toast.error("User ID dorkar");
    if (manual.credits <= 0) return toast.error("Credits must be > 0");

    const { error } = await supabase.rpc("admin_create_manual_order", {
      _user_id: manual.user_id.trim(),
      _package_id: manual.package_id || null,
      _credits: manual.credits,
      _amount: manual.amount,
      _package_name: manual.package_name || "Manual order",
      _payment_method: manual.payment_method,
      _notes: manual.notes,
    });
    if (error) return toast.error(error.message);
    toast.success("Manual order created & credits added");
    setManualOpen(false);
    setManual({
      user_id: "",
      package_id: "",
      credits: 100,
      amount: 0,
      package_name: "",
      payment_method: "bkash",
      notes: "",
    });
    refresh();
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "pending", "approved", "rejected", "refunded"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={filter === s ? "primary" : "secondary"}
              onClick={() => {
                setFilter(s);
                setSelected(new Set());
              }}
            >
              {s}
              {s === "pending" && (
                <span className="ml-1.5 text-[10px] opacity-70">
                  ({orders.filter((o) => o.status === "pending").length})
                </span>
              )}
            </Button>
          ))}
        </div>
        <Button size="sm" onClick={() => setManualOpen(true)} leftIcon={<Plus size={14} />}>
          Manual order
        </Button>
      </div>

      {/* Bulk action bar */}
      {pendingIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.08)]">
          <Button size="sm" variant="ghost" onClick={toggleAll} leftIcon={allSelected ? <CheckSquare size={14} /> : <Square size={14} />}>
            {allSelected ? "Unselect all" : `Select all ${pendingIds.length} pending`}
          </Button>
          {selected.size > 0 && (
            <>
              <Badge variant="outline">{selected.size} selected</Badge>
              <div className="flex-1" />
              <Button size="sm" onClick={bulkApprove} leftIcon={<Check size={14} />}>
                Bulk approve
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setBulkRejectOpen(true)} leftIcon={<X size={14} />}>
                Bulk reject
              </Button>
            </>
          )}
        </div>
      )}

      {/* Orders list */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">No orders.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => {
            const isPending = o.status === "pending";
            const isApproved = o.status === "approved";
            return (
              <div
                key={o.id}
                className="flex flex-wrap items-start sm:items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.08)]"
              >
                {isPending && (
                  <Checkbox
                    checked={selected.has(o.id)}
                    onCheckedChange={() => toggleOne(o.id)}
                    aria-label="Select"
                    className="mt-1 sm:mt-0"
                  />
                )}
                <div className="flex-1 min-w-0 basis-full sm:basis-auto sm:min-w-[200px]">
                  <div className="font-medium text-sm sm:text-base truncate">{o.package_name}</div>
                  <div className="text-[11px] sm:text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleString()} · {o.user_id.slice(0, 8)}…
                  </div>
                  <div className="text-[11px] sm:text-xs mt-1 font-mono break-all text-muted-foreground">
                    TX: {o.transaction_id || "—"}
                    {o.sender_account && ` · From: ${o.sender_account}`}
                  </div>
                  {o.status === "refunded" && o.refund_reason && (
                    <div className="text-xs mt-1 text-violet-300">Refund: {o.refund_reason}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px] sm:text-xs">{o.payment_method}</Badge>
                  <div className="text-sm whitespace-nowrap">
                    ৳{o.amount} <span className="text-primary">/ {o.credits}c</span>
                  </div>
                  <Badge variant="outline" className={`text-[10px] sm:text-xs ${statusMeta[o.status]}`}>
                    {o.status}
                  </Badge>
                </div>
                {isPending && (
                  <Button
                    size="sm"
                    className="ml-auto"
                    onClick={() => {
                      setReviewOrder(o);
                      setAdminNotes("");
                    }}
                  >
                    Review
                  </Button>
                )}
                {isApproved && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="ml-auto"
                    onClick={() => {
                      setRefundOrder(o);
                      setRefundReason("");
                    }}
                    leftIcon={<RotateCcw size={14} />}
                  >
                    Refund
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Review dialog */}
      <Dialog open={!!reviewOrder} onOpenChange={(o) => !o && setReviewOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review order</DialogTitle>
          </DialogHeader>
          {reviewOrder && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg p-3 bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.08)] space-y-1">
                <div><span className="text-muted-foreground">Package:</span> {reviewOrder.package_name}</div>
                <div><span className="text-muted-foreground">Amount:</span> ৳{reviewOrder.amount} → {reviewOrder.credits} credits</div>
                <div><span className="text-muted-foreground">Method:</span> {reviewOrder.payment_method} {reviewOrder.crypto_currency && `(${reviewOrder.crypto_currency})`}</div>
                <div><span className="text-muted-foreground">From:</span> <span className="font-mono">{reviewOrder.sender_account || "—"}</span></div>
                <div className="break-all"><span className="text-muted-foreground">TX ID:</span> <span className="font-mono">{reviewOrder.transaction_id}</span></div>
                <div className="text-xs text-muted-foreground">User: {reviewOrder.user_id}</div>
              </div>
              <div>
                <Label className="text-xs">Admin notes (visible to user if rejected)</Label>
                <Textarea rows={2} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => decideOrder("approved")} leftIcon={<Check size={14} />}>
                  Approve & credit
                </Button>
                <Button className="flex-1" variant="destructive" onClick={() => decideOrder("rejected")} leftIcon={<X size={14} />}>
                  Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Refund dialog */}
      <Dialog open={!!refundOrder} onOpenChange={(o) => !o && setRefundOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund order</DialogTitle>
          </DialogHeader>
          {refundOrder && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg p-3 bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.08)]">
                <div><span className="text-muted-foreground">Package:</span> {refundOrder.package_name}</div>
                <div><span className="text-muted-foreground">Will deduct:</span> up to {refundOrder.credits} credits (capped at user's current balance)</div>
              </div>
              <div>
                <Label className="text-xs">Refund reason</Label>
                <Textarea rows={2} value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="Why is this being refunded?" />
              </div>
              <Button className="w-full" variant="destructive" onClick={submitRefund} leftIcon={<RotateCcw size={14} />}>
                Confirm refund
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk reject dialog */}
      <Dialog open={bulkRejectOpen} onOpenChange={setBulkRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk reject {selected.size} orders</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Reason (shown to users)</Label>
              <Textarea rows={2} value={bulkRejectReason} onChange={(e) => setBulkRejectReason(e.target.value)} />
            </div>
            <Button className="w-full" variant="destructive" onClick={bulkReject}>
              Reject {selected.size} orders
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual order dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create manual order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">User ID (UUID)</Label>
              <Input
                value={manual.user_id}
                onChange={(e) => setManual({ ...manual, user_id: e.target.value })}
                placeholder="uuid from Users tab"
              />
            </div>
            <div>
              <Label className="text-xs">Package (optional preset)</Label>
              <Select
                value={manual.package_id}
                onValueChange={(v) => {
                  const p = packages.find((x) => x.id === v);
                  setManual({
                    ...manual,
                    package_id: v,
                    credits: p?.credits ?? manual.credits,
                    amount: p?.price ?? manual.amount,
                    package_name: p?.name ?? manual.package_name,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="-- custom --" />
                </SelectTrigger>
                <SelectContent>
                  {packages.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · ৳{p.price} / {p.credits}c
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Credits to add</Label>
                <Input
                  type="number"
                  value={manual.credits}
                  onChange={(e) => setManual({ ...manual, credits: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs">Amount paid (৳)</Label>
                <Input
                  type="number"
                  value={manual.amount}
                  onChange={(e) => setManual({ ...manual, amount: Number(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Display name on order</Label>
              <Input
                value={manual.package_name}
                onChange={(e) => setManual({ ...manual, package_name: e.target.value })}
                placeholder="e.g. Special deal — 100 credits"
              />
            </div>
            <div>
              <Label className="text-xs">Payment method</Label>
              <Select
                value={manual.payment_method}
                onValueChange={(v) => setManual({ ...manual, payment_method: v as typeof manual.payment_method })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bkash">bKash</SelectItem>
                  <SelectItem value="nagad">Nagad</SelectItem>
                  <SelectItem value="rocket">Rocket</SelectItem>
                  <SelectItem value="crypto">Crypto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Internal notes</Label>
              <Textarea
                rows={2}
                value={manual.notes}
                onChange={(e) => setManual({ ...manual, notes: e.target.value })}
                placeholder="Offline payment, special arrangement, etc."
              />
            </div>
            <Button className="w-full" onClick={submitManual} leftIcon={<ListChecks size={14} />}>
              Create & credit instantly
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
