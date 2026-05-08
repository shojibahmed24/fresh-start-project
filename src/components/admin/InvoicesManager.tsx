import { useEffect, useState } from "react";
import { Download, FileText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings } from "@/hooks/useAppSettings";
import { downloadInvoicePdf } from "@/lib/invoice";
import { toast } from "sonner";

type Row = {
  id: string;
  invoice_number: string;
  user_id: string;
  order_id: string;
  subtotal: number;
  vat_percent: number;
  vat_amount: number;
  total: number;
  currency: string;
  issued_at: string;
};

export const InvoicesManager = () => {
  const { settings } = useAppSettings();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("invoices")
      .select("*")
      .order("issued_at", { ascending: false })
      .limit(200);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = rows.filter((r) => r.invoice_number.toLowerCase().includes(q.toLowerCase()));

  const download = async (r: Row) => {
    const [{ data: order }, { data: profile }] = await Promise.all([
      supabase.from("orders").select("*").eq("id", r.order_id).maybeSingle(),
      supabase.from("profiles").select("display_name").eq("user_id", r.user_id).maybeSingle(),
    ]);
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
      customer_name: profile?.display_name ?? "Customer",
      customer_email: "",
      site_name: settings.site_name,
      contact_email: settings.contact_email,
      contact_phone: settings.contact_phone,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          leftIcon={<Search size={14} />}
          placeholder="Search invoice #"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">No invoices yet.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.08)]"
            >
              <FileText size={16} className="text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium font-mono text-xs sm:text-sm truncate">{r.invoice_number}</div>
                <div className="text-[11px] sm:text-xs text-muted-foreground truncate">
                  {new Date(r.issued_at).toLocaleString()} · {r.order_id.slice(0, 8)}…
                </div>
              </div>
              <div className="flex items-center gap-1.5 ml-auto flex-wrap justify-end">
                <Badge variant="outline" className="text-[10px] sm:text-xs whitespace-nowrap">
                  {r.currency} {Number(r.total).toFixed(2)}
                </Badge>
                {r.vat_percent > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    VAT {r.vat_percent}%
                  </Badge>
                )}
                <Button size="sm" variant="ghost" onClick={() => download(r)} leftIcon={<Download size={14} />}>
                  PDF
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
