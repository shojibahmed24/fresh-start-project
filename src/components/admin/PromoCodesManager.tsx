import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Copy, Tag, Calendar, Users as UsersIcon, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Promo = {
  id: string;
  code: string;
  description: string;
  discount_type: "percent" | "flat";
  discount_value: number;
  min_amount: number;
  max_discount: number | null;
  usage_limit: number | null;
  per_user_limit: number;
  used_count: number;
  applicable_package_ids: string[];
  bonus_credits: number;
  expires_at: string | null;
  starts_at: string;
  is_active: boolean;
};

type Pkg = { id: string; name: string };

type Editing = Partial<Promo> & { _new?: boolean };

const empty: Editing = {
  code: "",
  description: "",
  discount_type: "percent",
  discount_value: 10,
  min_amount: 0,
  max_discount: null,
  usage_limit: null,
  per_user_limit: 1,
  applicable_package_ids: [],
  bonus_credits: 0,
  expires_at: null,
  is_active: true,
  _new: true,
};

const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export const PromoCodesManager = () => {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Editing | null>(null);

  const refresh = async () => {
    setLoading(true);
    const [p, pk] = await Promise.all([
      supabase.from("promo_codes").select("*").order("created_at", { ascending: false }),
      supabase.from("packages").select("id, name").order("sort_order"),
    ]);
    setPromos((p.data ?? []) as Promo[]);
    setPackages((pk.data ?? []) as Pkg[]);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const save = async () => {
    if (!editing) return;
    const code = (editing.code ?? "").trim().toUpperCase();
    if (!code) return toast.error("Code dorkar");
    if (!editing.discount_value || editing.discount_value <= 0)
      return toast.error("Discount value > 0 hote hobe");
    if (editing.discount_type === "percent" && editing.discount_value > 100)
      return toast.error("Percent 100 er beshi hobe na");

    const payload = {
      code,
      description: editing.description ?? "",
      discount_type: editing.discount_type!,
      discount_value: Number(editing.discount_value),
      min_amount: Number(editing.min_amount ?? 0),
      max_discount: editing.max_discount ? Number(editing.max_discount) : null,
      usage_limit: editing.usage_limit ? Number(editing.usage_limit) : null,
      per_user_limit: Number(editing.per_user_limit ?? 1),
      applicable_package_ids: editing.applicable_package_ids ?? [],
      bonus_credits: Number(editing.bonus_credits ?? 0),
      expires_at: editing.expires_at ? new Date(editing.expires_at).toISOString() : null,
      is_active: editing.is_active ?? true,
    };

    const { error } = editing._new
      ? await supabase.from("promo_codes").insert(payload)
      : await supabase.from("promo_codes").update(payload).eq("id", editing.id!);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEditing(null);
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this promo code?")) return;
    const { error } = await supabase.from("promo_codes").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      refresh();
    }
  };

  const togglePackage = (id: string) => {
    if (!editing) return;
    const list = editing.applicable_package_ids ?? [];
    setEditing({
      ...editing,
      applicable_package_ids: list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
    });
  };

  const stats = useMemo(() => {
    const active = promos.filter((p) => p.is_active).length;
    const totalUses = promos.reduce((s, p) => s + p.used_count, 0);
    return { total: promos.length, active, totalUses };
  }, [promos]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl p-3 sm:p-4 bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.08)]">
          <div className="text-[10px] sm:text-xs text-muted-foreground">Total codes</div>
          <div className="text-xl sm:text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="rounded-xl p-3 sm:p-4 bg-[hsl(var(--bg-elevated))] border border-emerald-500/20">
          <div className="text-[10px] sm:text-xs text-muted-foreground">Active</div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-300">{stats.active}</div>
        </div>
        <div className="rounded-xl p-3 sm:p-4 bg-[hsl(var(--bg-elevated))] border border-primary/20">
          <div className="text-[10px] sm:text-xs text-muted-foreground">Redemptions</div>
          <div className="text-xl sm:text-2xl font-bold text-primary">{stats.totalUses}</div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setEditing({ ...empty })} leftIcon={<Plus size={14} />} className="w-full sm:w-auto">
          New promo code
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Loading…</div>
      ) : promos.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground rounded-xl border border-dashed border-[hsl(0_0%_100%/0.1)]">
          Kono promo code nei. New banao ↑
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {promos.map((p) => {
            const expired = p.expires_at && new Date(p.expires_at) < new Date();
            const exhausted = p.usage_limit != null && p.used_count >= p.usage_limit;
            return (
              <div
                key={p.id}
                className="relative rounded-2xl p-4 bg-gradient-to-br from-[hsl(var(--bg-elevated))] to-background border border-[hsl(0_0%_100%/0.08)] hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Tag size={14} className="text-primary shrink-0" />
                      <span className="font-mono font-bold text-base truncate">{p.code}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(p.code);
                          toast.success("Copied");
                        }}
                        className="text-muted-foreground hover:text-foreground"
                        title="Copy"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                    {p.description && (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">{p.description}</div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon-sm" variant="ghost" onClick={() => setEditing(p)}>
                      <Pencil size={13} />
                    </Button>
                    <Button size="icon-sm" variant="ghost" onClick={() => remove(p.id)}>
                      <Trash2 size={13} className="text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-primary">
                    {p.discount_type === "percent" ? `${p.discount_value}%` : `৳${p.discount_value}`}
                  </span>
                  <span className="text-xs text-muted-foreground">off</span>
                  {p.bonus_credits > 0 && (
                    <Badge variant="outline" className="ml-auto bg-pink-500/15 text-pink-300 border-pink-500/30">
                      +{p.bonus_credits}c bonus
                    </Badge>
                  )}
                </div>

                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {p.min_amount > 0 && <div>Min order: ৳{p.min_amount}</div>}
                  {p.max_discount && <div>Max discount: ৳{p.max_discount}</div>}
                  <div className="flex items-center gap-1.5">
                    <UsersIcon size={11} />
                    {p.used_count}{p.usage_limit ? ` / ${p.usage_limit}` : ""} used · {p.per_user_limit}/user
                  </div>
                  {p.expires_at && (
                    <div className="flex items-center gap-1.5">
                      <Calendar size={11} />
                      Expires {new Date(p.expires_at).toLocaleDateString()}
                    </div>
                  )}
                  {p.applicable_package_ids.length > 0 && (
                    <div>Limited to {p.applicable_package_ids.length} pkg(s)</div>
                  )}
                </div>

                <div className="mt-3 flex gap-1.5 flex-wrap">
                  {!p.is_active && <Badge variant="outline">Disabled</Badge>}
                  {expired && (
                    <Badge variant="outline" className="bg-red-500/15 text-red-300 border-red-500/30">
                      Expired
                    </Badge>
                  )}
                  {exhausted && (
                    <Badge variant="outline" className="bg-amber-500/15 text-amber-300 border-amber-500/30">
                      Exhausted
                    </Badge>
                  )}
                  {p.is_active && !expired && !exhausted && (
                    <Badge variant="outline" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                      Live
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles size={16} className="text-primary" />
              {editing?._new ? "New promo code" : "Edit promo code"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Code</Label>
                  <Input
                    value={editing.code ?? ""}
                    onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                    placeholder="SAVE10"
                    className="font-mono uppercase"
                  />
                </div>
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={editing.discount_type}
                    onValueChange={(v) =>
                      setEditing({ ...editing, discount_type: v as "percent" | "flat" })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percent (%)</SelectItem>
                      <SelectItem value="flat">Flat (৳)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs">Description</Label>
                <Textarea
                  rows={2}
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="Eid offer 10% off"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">
                    Discount value {editing.discount_type === "percent" ? "(%)" : "(৳)"}
                  </Label>
                  <Input
                    type="number"
                    value={editing.discount_value ?? 0}
                    onChange={(e) => setEditing({ ...editing, discount_value: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Bonus credits</Label>
                  <Input
                    type="number"
                    value={editing.bonus_credits ?? 0}
                    onChange={(e) => setEditing({ ...editing, bonus_credits: Number(e.target.value) })}
                    placeholder="Extra free credits"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Min order amount (৳)</Label>
                  <Input
                    type="number"
                    value={editing.min_amount ?? 0}
                    onChange={(e) => setEditing({ ...editing, min_amount: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Max discount cap (৳)</Label>
                  <Input
                    type="number"
                    value={editing.max_discount ?? ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        max_discount: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Total usage limit</Label>
                  <Input
                    type="number"
                    value={editing.usage_limit ?? ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        usage_limit: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="Unlimited"
                  />
                </div>
                <div>
                  <Label className="text-xs">Per-user limit</Label>
                  <Input
                    type="number"
                    value={editing.per_user_limit ?? 1}
                    onChange={(e) => setEditing({ ...editing, per_user_limit: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Expires at</Label>
                <Input
                  type="date"
                  value={toDateInput(editing.expires_at ?? null)}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      expires_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                    })
                  }
                />
              </div>

              <div>
                <Label className="text-xs">Applicable packages (empty = all)</Label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {packages.map((pk) => {
                    const on = (editing.applicable_package_ids ?? []).includes(pk.id);
                    return (
                      <button
                        key={pk.id}
                        type="button"
                        onClick={() => togglePackage(pk.id)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          on
                            ? "bg-primary/20 border-primary/50 text-primary"
                            : "bg-[hsl(var(--bg-elevated))] border-[hsl(0_0%_100%/0.08)] text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        {pk.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={editing.is_active ?? true}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                />
                Active
              </label>

              <Button className="w-full" onClick={save}>
                Save promo code
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
