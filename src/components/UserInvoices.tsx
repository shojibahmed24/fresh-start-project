import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useAppSettings } from "@/hooks/useAppSettings";
import { downloadInvoicePdf } from "@/lib/invoice";
import { toast } from "sonner";

type Row = {
  id: string;
  invoice_number: string;
  order_id: string;
  subtotal: number;
  vat_percent: number;
  vat_amount: number;
  total: number;
  currency: string;
  issued_at: string;
};

// Self-service invoice list shown to the user on the Shop page.
export const UserInvoices = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { settings } = useAppSettings();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("invoices")
      .select("*")
      .eq("user_id", user.id)
      .order("issued_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setRows((data ?? []) as Row[]));
  }, [user]);

  const download = async (r: Row) => {
    const { data: order } = await supabase.from("orders").select("*").eq("id", r.order_id).maybeSingle();
    if (!order) return toast.error("Order not found");
    downloadInvoicePdf({
      invoice_number: r.invoice_number,
      issued_at: r.issued_at,
      subtotal: r.subtotal,
      vat_percent: r.vat_percent,
      vat_amount: r.vat_amount,
      total: r.total,
      currency: r.currency,
      package_name: order.package_name,
      credits: order.credits,
      payment_method: order.payment_method,
      transaction_id: order.transaction_id,
      order_id: r.order_id,
      customer_name: profile?.display_name ?? user?.email?.split("@")[0] ?? "Customer",
      customer_email: user?.email ?? "",
      site_name: settings.site_name,
      contact_email: settings.contact_email,
      contact_phone: settings.contact_phone,
    });
  };

  if (rows.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold mb-3">Your invoices</h2>
      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.08)]"
          >
            <FileText size={16} className="text-primary shrink-0" />
            <div className="flex-1 min-w-[140px]">
              <div className="font-mono text-sm">{r.invoice_number}</div>
              <div className="text-[11px] text-muted-foreground">
                {new Date(r.issued_at).toLocaleDateString()} · {r.currency} {Number(r.total).toFixed(2)}
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => download(r)} leftIcon={<Download size={14} />}>
              PDF
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
};
