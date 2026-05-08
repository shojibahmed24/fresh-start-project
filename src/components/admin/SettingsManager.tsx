import { useEffect, useState } from "react";
import { Save, Wrench, Receipt, Globe, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useAppSettings, type AppSettings } from "@/hooks/useAppSettings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const SettingsManager = () => {
  const { settings, loading, refresh, update } = useAppSettings();
  const [form, setForm] = useState<AppSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [purging, setPurging] = useState(false);

  useEffect(() => setForm(settings), [settings]);

  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await update(form);
      toast.success("Settings saved");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const runAutoReject = async () => {
    setPurging(true);
    const { data, error } = await supabase.rpc("auto_reject_stale_orders");
    setPurging(false);
    if (error) toast.error(error.message);
    else toast.success(`${data ?? 0} stale order(s) rejected`);
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-20 text-muted-foreground">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Site */}
      <section className="rounded-xl border border-[hsl(0_0%_100%/0.08)] bg-[hsl(var(--bg-elevated))] p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Globe size={16} className="text-primary" /> Site information
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Site name</Label>
            <Input value={form.site_name} onChange={(e) => set("site_name", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Logo URL</Label>
            <Input value={form.site_logo_url} onChange={(e) => set("site_logo_url", e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <Label className="text-xs">Contact email</Label>
            <Input type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Contact phone</Label>
            <Input value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
          </div>
        </div>
      </section>

      {/* Invoice / VAT */}
      <section className="rounded-xl border border-[hsl(0_0%_100%/0.08)] bg-[hsl(var(--bg-elevated))] p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Receipt size={16} className="text-primary" /> Invoicing & VAT
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">VAT percent</Label>
            <Input
              type="number"
              step="0.01"
              value={form.vat_percent}
              onChange={(e) => set("vat_percent", Number(e.target.value) || 0)}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Order amount is treated as VAT-inclusive; subtotal is back-calculated on invoice.
            </p>
          </div>
          <div>
            <Label className="text-xs">Invoice number prefix</Label>
            <Input value={form.invoice_prefix} onChange={(e) => set("invoice_prefix", e.target.value)} />
          </div>
        </div>
      </section>

      {/* Orders */}
      <section className="rounded-xl border border-[hsl(0_0%_100%/0.08)] bg-[hsl(var(--bg-elevated))] p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Clock size={16} className="text-primary" /> Order policy
        </div>
        <div>
          <Label className="text-xs">Auto-reject pending orders after (days)</Label>
          <Input
            type="number"
            min={0}
            value={form.order_auto_reject_days}
            onChange={(e) => set("order_auto_reject_days", Number(e.target.value) || 0)}
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Set to 0 to disable. Run “Purge stale orders” below to apply on demand.
          </p>
        </div>
        <Button variant="secondary" onClick={runAutoReject} loading={purging} leftIcon={<Clock size={14} />}>
          Purge stale orders now
        </Button>
      </section>

      {/* Maintenance */}
      <section className="rounded-xl border border-[hsl(0_0%_100%/0.08)] bg-[hsl(var(--bg-elevated))] p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Wrench size={16} className="text-primary" /> Maintenance mode
        </div>
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={form.maintenance_mode} onCheckedChange={(v) => set("maintenance_mode", v)} />
          <span>Enable maintenance mode (non-admins see a banner)</span>
        </label>
        <div>
          <Label className="text-xs">Message</Label>
          <Textarea
            rows={3}
            value={form.maintenance_message}
            onChange={(e) => set("maintenance_message", e.target.value)}
          />
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={refresh}>Reset</Button>
        <Button onClick={save} loading={saving} leftIcon={<Save size={14} />}>Save settings</Button>
      </div>
    </div>
  );
};
