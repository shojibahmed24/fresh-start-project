import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Pencil, Package as PkgIcon, CreditCard, ListChecks, Users, Receipt, Tag, BarChart3, ShieldCheck, Settings as SettingsIcon, FileText, Activity, ShieldAlert, MessageSquare, Megaphone } from "lucide-react";
import { SupportInbox } from "@/components/admin/SupportInbox";
import { ContentManager } from "@/components/admin/ContentManager";
import { UserManagement } from "@/components/admin/UserManagement";
import { CreditTransactionsLog } from "@/components/admin/CreditTransactionsLog";
import { PromoCodesManager } from "@/components/admin/PromoCodesManager";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";
import { OrdersManager } from "@/components/admin/OrdersManager";
import { PackagesManager } from "@/components/admin/PackagesManager";
import { SettingsManager } from "@/components/admin/SettingsManager";
import { InvoicesManager } from "@/components/admin/InvoicesManager";
import { FraudReview } from "@/components/admin/FraudReview";
import { NotificationBell } from "@/components/NotificationBell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type PaymentMethod = {
  id: string;
  type: "bkash" | "nagad" | "rocket" | "crypto";
  label: string;
  account_number: string;
  instructions: string;
  is_active: boolean;
};

const emptyMethod: Omit<PaymentMethod, "id"> = {
  type: "bkash",
  label: "",
  account_number: "",
  instructions: "",
  is_active: true,
};

const AdminShop = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [fraudCount, setFraudCount] = useState(0);
  const [supportUnread, setSupportUnread] = useState(0);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | (Omit<PaymentMethod, "id"> & { id?: string }) | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth", { replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!roleLoading && !isAdmin && user) {
      toast.error("Admins only");
      navigate("/shop", { replace: true });
    }
  }, [roleLoading, isAdmin, user, navigate]);

  const refreshMethods = async () => {
    const { data } = await supabase.from("payment_methods").select("*").order("type");
    setMethods((data ?? []) as PaymentMethod[]);
  };

  const refreshPendingCount = async () => {
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    setPendingCount(count ?? 0);
  };

  const refreshFraudCount = async () => {
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("needs_review", true);
    setFraudCount(count ?? 0);
  };

  const refreshSupportUnread = async () => {
    const { data } = await supabase.rpc("admin_support_stats");
    const stats = (data ?? {}) as { unread_admin?: number };
    setSupportUnread(Number(stats.unread_admin ?? 0));
  };

  useEffect(() => {
    if (isAdmin) {
      refreshMethods();
      refreshPendingCount();
      refreshFraudCount();
      refreshSupportUnread();
      const ch = supabase
        .channel("admin-support-badge")
        .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => refreshSupportUnread())
        .subscribe();
      return () => {
        supabase.removeChannel(ch);
      };
    }
  }, [isAdmin]);

  const saveMethod = async () => {
    if (!editingMethod) return;
    if (!editingMethod.label.trim() || !editingMethod.account_number.trim()) {
      toast.error("Label & account dorkar");
      return;
    }
    const payload = {
      type: editingMethod.type,
      label: editingMethod.label,
      account_number: editingMethod.account_number,
      instructions: editingMethod.instructions,
      is_active: editingMethod.is_active,
    };
    const { error } = editingMethod.id
      ? await supabase.from("payment_methods").update(payload).eq("id", editingMethod.id)
      : await supabase.from("payment_methods").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEditingMethod(null);
    refreshMethods();
  };

  const deleteMethod = async (id: string) => {
    if (!confirm("Delete this method?")) return;
    const { error } = await supabase.from("payment_methods").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      refreshMethods();
    }
  };

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-background text-muted-foreground">
        Checking access…
      </div>
    );
  }
  if (!isAdmin) return null;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[420px] -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(60% 60% at 30% 0%, hsl(var(--primary)/0.18), transparent 60%), radial-gradient(50% 50% at 80% 10%, hsl(280 90% 60% / 0.12), transparent 70%)",
        }}
      />

      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-[hsl(0_0%_100%/0.06)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Button variant="ghost" size="icon-sm" onClick={() => navigate("/shop")} aria-label="Back" className="shrink-0">
              <ArrowLeft size={16} />
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/40 grid place-items-center shrink-0">
                <ShieldCheck size={14} className="text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold tracking-tight leading-none truncate text-sm sm:text-base">Shop Admin</div>
                <div className="text-[10px] text-muted-foreground hidden sm:block">Control center</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {pendingCount > 0 && (
              <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse shrink-0 px-1.5 sm:px-2.5 text-[10px] sm:text-xs">
                <span className="sm:hidden">{pendingCount}</span>
                <span className="hidden sm:inline">{pendingCount} pending</span>
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/admin/activity")}
              leftIcon={<Activity size={14} />}
              className="hidden sm:inline-flex"
            >
              Activity
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate("/admin/activity")}
              aria-label="Activity log"
              className="sm:hidden"
            >
              <Activity size={16} />
            </Button>
            <NotificationBell />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <Tabs defaultValue="analytics">
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 pb-1 scrollbar-thin snap-x snap-mandatory">
            <TabsList className="inline-flex w-auto h-auto p-1 bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.06)] gap-0.5">
              <TabsTrigger value="analytics" className="gap-1.5 whitespace-nowrap snap-start text-xs sm:text-sm">
                <BarChart3 size={14} /> Analytics
              </TabsTrigger>
              <TabsTrigger value="orders" className="gap-1.5 whitespace-nowrap relative snap-start text-xs sm:text-sm">
                <ListChecks size={14} /> Orders
                {pendingCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-amber-500 text-amber-950">
                    {pendingCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="fraud" className="gap-1.5 whitespace-nowrap relative snap-start text-xs sm:text-sm">
                <ShieldAlert size={14} /> Fraud
                {fraudCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-red-500 text-white animate-pulse">
                    {fraudCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="support" className="gap-1.5 whitespace-nowrap relative snap-start text-xs sm:text-sm">
                <MessageSquare size={14} /> Support
                {supportUnread > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-red-500 text-white animate-pulse">
                    {supportUnread}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-1.5 whitespace-nowrap snap-start text-xs sm:text-sm">
                <Users size={14} /> Users
              </TabsTrigger>
              <TabsTrigger value="transactions" className="gap-1.5 whitespace-nowrap snap-start text-xs sm:text-sm">
                <Receipt size={14} /> Credits
              </TabsTrigger>
              <TabsTrigger value="promos" className="gap-1.5 whitespace-nowrap snap-start text-xs sm:text-sm">
                <Tag size={14} /> Promos
              </TabsTrigger>
              <TabsTrigger value="packages" className="gap-1.5 whitespace-nowrap snap-start text-xs sm:text-sm">
                <PkgIcon size={14} /> Packages
              </TabsTrigger>
              <TabsTrigger value="methods" className="gap-1.5 whitespace-nowrap snap-start text-xs sm:text-sm">
                <CreditCard size={14} /> Methods
              </TabsTrigger>
              <TabsTrigger value="invoices" className="gap-1.5 whitespace-nowrap snap-start text-xs sm:text-sm">
                <FileText size={14} /> Invoices
              </TabsTrigger>
              <TabsTrigger value="content" className="gap-1.5 whitespace-nowrap snap-start text-xs sm:text-sm">
                <Megaphone size={14} /> Content
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5 whitespace-nowrap snap-start text-xs sm:text-sm">
                <SettingsIcon size={14} /> Settings
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="analytics" className="mt-6">
            <AnalyticsDashboard />
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <UserManagement />
          </TabsContent>

          <TabsContent value="transactions" className="mt-6">
            <CreditTransactionsLog />
          </TabsContent>

          <TabsContent value="promos" className="mt-6">
            <PromoCodesManager />
          </TabsContent>

          <TabsContent value="orders" className="mt-6">
            <OrdersManager />
          </TabsContent>

          <TabsContent value="fraud" className="mt-6">
            <FraudReview />
          </TabsContent>

          <TabsContent value="support" className="mt-6">
            <SupportInbox />
          </TabsContent>

          <TabsContent value="packages" className="mt-6">
            <PackagesManager />
          </TabsContent>

          <TabsContent value="methods" className="mt-6">
            <div className="flex justify-end mb-4">
              <Button onClick={() => setEditingMethod({ ...emptyMethod })} leftIcon={<Plus size={14} />}>
                New method
              </Button>
            </div>
            <div className="space-y-2">
              {methods.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center gap-3 p-4 rounded-lg bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.08)]"
                >
                  <Badge variant="outline">{m.type}</Badge>
                  <div className="flex-1 min-w-[160px]">
                    <div className="font-medium">{m.label}</div>
                    <div className="text-xs font-mono text-muted-foreground break-all">{m.account_number}</div>
                  </div>
                  {!m.is_active && <Badge variant="outline">inactive</Badge>}
                  <Button size="icon-sm" variant="ghost" onClick={() => setEditingMethod(m)}>
                    <Pencil size={14} />
                  </Button>
                  <Button size="icon-sm" variant="ghost" onClick={() => deleteMethod(m.id)}>
                    <Trash2 size={14} className="text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="invoices" className="mt-6">
            <InvoicesManager />
          </TabsContent>

          <TabsContent value="content" className="mt-6">
            <ContentManager />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <SettingsManager />
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit method dialog */}
      <Dialog open={!!editingMethod} onOpenChange={(o) => !o && setEditingMethod(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMethod && "id" in editingMethod && editingMethod.id ? "Edit method" : "New method"}</DialogTitle>
          </DialogHeader>
          {editingMethod && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Type</Label>
                <Select
                  value={editingMethod.type}
                  onValueChange={(v) => setEditingMethod({ ...editingMethod, type: v as PaymentMethod["type"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bkash">bKash</SelectItem>
                    <SelectItem value="nagad">Nagad</SelectItem>
                    <SelectItem value="rocket">Rocket</SelectItem>
                    <SelectItem value="crypto">Crypto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Label</Label>
                <Input
                  value={editingMethod.label}
                  onChange={(e) => setEditingMethod({ ...editingMethod, label: e.target.value })}
                  placeholder="e.g. bKash Personal"
                />
              </div>
              <div>
                <Label className="text-xs">Account number / Wallet</Label>
                <Input
                  value={editingMethod.account_number}
                  onChange={(e) => setEditingMethod({ ...editingMethod, account_number: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Instructions</Label>
                <Textarea
                  rows={2}
                  value={editingMethod.instructions}
                  onChange={(e) => setEditingMethod({ ...editingMethod, instructions: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={editingMethod.is_active}
                  onCheckedChange={(v) => setEditingMethod({ ...editingMethod, is_active: v })}
                />
                Active
              </label>
              <Button className="w-full" onClick={saveMethod}>Save</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminShop;
