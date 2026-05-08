import { History, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { METHOD_META, STATUS_META, type Order, type PaymentMethod } from "./types";

export const OrderHistory = ({ orders }: { orders: Order[] }) => (
  <section className="mt-14">
    <div className="flex items-center gap-2 mb-4">
      <History size={16} className="text-muted-foreground" />
      <h2 className="text-lg font-semibold">Order history</h2>
    </div>
    {orders.length === 0 ? (
      <div className="text-sm text-muted-foreground bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.08)] rounded-xl p-6 text-center">
        Akhono kono order nei.
      </div>
    ) : (
      <div className="rounded-xl border border-[hsl(0_0%_100%/0.08)] overflow-hidden">
        {orders.map((o, i) => (
          <div
            key={o.id}
            className={`flex flex-wrap items-center gap-3 p-4 text-sm ${
              i !== orders.length - 1 ? "border-b border-[hsl(0_0%_100%/0.06)]" : ""
            } bg-[hsl(var(--bg-elevated))]`}
          >
            <div className="flex-1 min-w-[160px]">
              <div className="font-medium">{o.package_name}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock size={11} /> {new Date(o.created_at).toLocaleString()}
              </div>
            </div>
            <Badge
              variant="outline"
              className={METHOD_META[o.payment_method as PaymentMethod["type"]]?.color}
            >
              {METHOD_META[o.payment_method as PaymentMethod["type"]]?.label ?? o.payment_method}
            </Badge>
            <div className="text-right">
              <div>৳{o.amount}</div>
              <div className="text-xs text-primary">+{o.credits} credits</div>
            </div>
            <Badge variant="outline" className={STATUS_META[o.status].cls}>
              {STATUS_META[o.status].label}
            </Badge>
            {o.status === "rejected" && o.admin_notes && (
              <div className="basis-full text-xs text-red-300/80 pl-1">
                Note: {o.admin_notes}
              </div>
            )}
          </div>
        ))}
      </div>
    )}
  </section>
);
