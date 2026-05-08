import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Pencil, Trash2, Percent, CheckSquare, Square, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";

type Package = {
  id: string;
  name: string;
  description: string;
  price: number;
  credits: number;
  is_popular: boolean;
  is_active: boolean;
  sort_order: number;
};

const emptyPackage: Omit<Package, "id"> = {
  name: "",
  description: "",
  price: 0,
  credits: 0,
  is_popular: false,
  is_active: true,
  sort_order: 0,
};

export const PackagesManager = () => {
  const [packages, setPackages] = useState<Package[]>([]);
  const [editing, setEditing] = useState<Package | (Omit<Package, "id"> & { id?: string }) | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);
  const [bulkScope, setBulkScope] = useState<"selected" | "all">("selected");
  const [bulkPercent, setBulkPercent] = useState<number>(0);
  const [bulkFlat, setBulkFlat] = useState<number>(0);
  const [bulkRound, setBulkRound] = useState<number>(1);

  const refresh = async () => {
    const { data } = await supabase.from("packages").select("*").order("sort_order");
    setPackages((data ?? []) as Package[]);
  };
  useEffect(() => {
    refresh();
  }, []);

  const allSelected = packages.length > 0 && packages.every((p) => selected.has(p.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(packages.map((p) => p.id)));
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) return toast.error("Name dorkar");
    const payload = {
      name: editing.name,
      description: editing.description,
      price: Number(editing.price),
      credits: Number(editing.credits),
      is_popular: editing.is_popular,
      is_active: editing.is_active,
      sort_order: Number(editing.sort_order),
    };
    const { error } = editing.id
      ? await supabase.from("packages").update(payload).eq("id", editing.id)
      : await supabase.from("packages").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEditing(null);
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this package?")) return;
    const { error } = await supabase.from("packages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    refresh();
  };

  const bulkActivate = async (active: boolean) => {
    if (selected.size === 0) return;
    const { data, error } = await supabase.rpc("admin_bulk_set_package_active", {
      _package_ids: Array.from(selected),
      _active: active,
    });
    if (error) return toast.error(error.message);
    toast.success(`${active ? "Activated" : "Deactivated"} ${data ?? selected.size} packages`);
    setSelected(new Set());
    refresh();
  };

  const bulkAdjustPrice = async () => {
    const ids = bulkScope === "all" ? null : Array.from(selected);
    if (bulkScope === "selected" && (!ids || ids.length === 0)) {
      return toast.error("Select packages first");
    }
    if (bulkPercent === 0 && bulkFlat === 0) {
      return toast.error("Enter a percent or flat amount");
    }
    const { data, error } = await supabase.rpc("admin_bulk_adjust_prices", {
      _package_ids: ids,
      _percent: bulkPercent || null,
      _flat_delta: bulkFlat || null,
      _round_to: bulkRound || 1,
    });
    if (error) return toast.error(error.message);
    toast.success(`Updated ${data ?? 0} packages`);
    setBulkPriceOpen(false);
    setBulkPercent(0);
    setBulkFlat(0);
    setSelected(new Set());
    refresh();
  };

  const previewPrices = useMemo(() => {
    const ids = bulkScope === "all" ? new Set(packages.map((p) => p.id)) : selected;
    return packages
      .filter((p) => ids.has(p.id))
      .slice(0, 4)
      .map((p) => {
        const newPrice = Math.max(
          Math.round(((p.price + bulkFlat) * (1 + bulkPercent / 100)) / bulkRound) * bulkRound,
          0,
        );
        return { name: p.name, old: p.price, next: newPrice };
      });
  }, [packages, selected, bulkScope, bulkPercent, bulkFlat, bulkRound]);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <Button size="sm" variant="ghost" onClick={toggleAll} leftIcon={allSelected ? <CheckSquare size={14} /> : <Square size={14} />}>
          {allSelected ? "Unselect all" : "Select all"}
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {selected.size > 0 && (
            <>
              <Badge variant="outline">{selected.size} selected</Badge>
              <Button size="sm" variant="secondary" onClick={() => bulkActivate(true)} leftIcon={<Power size={14} />}>
                Activate
              </Button>
              <Button size="sm" variant="secondary" onClick={() => bulkActivate(false)} leftIcon={<PowerOff size={14} />}>
                Deactivate
              </Button>
            </>
          )}
          <Button size="sm" variant="secondary" onClick={() => setBulkPriceOpen(true)} leftIcon={<Percent size={14} />}>
            Bulk price
          </Button>
          <Button size="sm" onClick={() => setEditing({ ...emptyPackage })} leftIcon={<Plus size={14} />}>
            New
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {packages.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.08)]"
          >
            <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleOne(p.id)} />
            <div className="flex-1 min-w-0">
              <div className="font-medium flex items-center gap-1.5 flex-wrap text-sm sm:text-base">
                <span className="truncate">{p.name}</span>
                {p.is_popular && <Badge variant="outline" className="text-[10px]">popular</Badge>}
                {!p.is_active && <Badge variant="outline" className="text-[10px]">inactive</Badge>}
              </div>
              <div className="text-xs text-muted-foreground line-clamp-2">{p.description}</div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 ml-auto">
              <div className="text-sm whitespace-nowrap">৳{p.price}</div>
              <div className="text-sm text-primary whitespace-nowrap">{p.credits}c</div>
              <Button size="icon-sm" variant="ghost" onClick={() => setEditing(p)}>
                <Pencil size={14} />
              </Button>
              <Button size="icon-sm" variant="ghost" onClick={() => remove(p.id)}>
                <Trash2 size={14} className="text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing && "id" in editing && editing.id ? "Edit package" : "New package"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Name</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Textarea rows={2} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Price</Label>
                  <Input type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Credits</Label>
                  <Input type="number" value={editing.credits} onChange={(e) => setEditing({ ...editing, credits: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Sort</Label>
                  <Input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={editing.is_popular} onCheckedChange={(v) => setEditing({ ...editing, is_popular: v })} />
                  Popular
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                  Active
                </label>
              </div>
              <Button className="w-full" onClick={save}>Save</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk price dialog */}
      <Dialog open={bulkPriceOpen} onOpenChange={setBulkPriceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk price update</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <Label className="text-xs">Apply to</Label>
              <Select value={bulkScope} onValueChange={(v) => setBulkScope(v as typeof bulkScope)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="selected">Selected ({selected.size})</SelectItem>
                  <SelectItem value="all">All packages ({packages.length})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Percent change</Label>
                <Input
                  type="number"
                  value={bulkPercent}
                  onChange={(e) => setBulkPercent(Number(e.target.value))}
                  placeholder="-10 = 10% off"
                />
              </div>
              <div>
                <Label className="text-xs">Flat delta (৳)</Label>
                <Input
                  type="number"
                  value={bulkFlat}
                  onChange={(e) => setBulkFlat(Number(e.target.value))}
                  placeholder="-50 = ৳50 off"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Round to nearest</Label>
              <Input
                type="number"
                value={bulkRound}
                onChange={(e) => setBulkRound(Math.max(1, Number(e.target.value)))}
              />
            </div>
            {previewPrices.length > 0 && (bulkPercent !== 0 || bulkFlat !== 0) && (
              <div className="rounded-lg p-3 bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.08)] space-y-1">
                <div className="text-xs text-muted-foreground mb-1">Preview:</div>
                {previewPrices.map((p) => (
                  <div key={p.name} className="flex justify-between text-xs">
                    <span className="truncate">{p.name}</span>
                    <span><span className="line-through text-muted-foreground">৳{p.old}</span> → <span className="text-primary font-medium">৳{p.next}</span></span>
                  </div>
                ))}
              </div>
            )}
            <Button className="w-full" onClick={bulkAdjustPrice}>Apply update</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
