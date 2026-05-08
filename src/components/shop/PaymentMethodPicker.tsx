import { m } from "framer-motion";
import { Check } from "lucide-react";
import { PaymentLogo } from "./PaymentLogo";
import { cn } from "@/lib/utils";

type MethodType = "bkash" | "nagad" | "rocket" | "crypto";

export type PickerMethod = {
  id: string;
  type: MethodType;
  label: string;
  account_number: string;
  instructions: string;
};

const TYPE_LABEL: Record<MethodType, string> = {
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
  crypto: "Crypto",
};

export const PaymentMethodPicker = ({
  methods,
  selectedId,
  onSelect,
}: {
  methods: PickerMethod[];
  selectedId?: string;
  onSelect: (m: PickerMethod) => void;
}) => {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {methods.map((method) => {
        const active = selectedId === method.id;
        return (
          <m.button
            key={method.id}
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => onSelect(method)}
            className={cn(
              "relative flex items-center gap-3 rounded-xl p-3 text-left",
              "border bg-[hsl(var(--bg-elevated))] transition-all",
              active
                ? "border-primary/60 shadow-[0_0_0_1px_hsl(var(--primary)/0.4),0_8px_24px_-12px_hsl(var(--primary)/0.6)]"
                : "border-[hsl(0_0%_100%/0.08)] hover:border-[hsl(0_0%_100%/0.18)] hover:-translate-y-0.5",
            )}
          >
            <PaymentLogo type={method.type} size={36} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold leading-tight">{TYPE_LABEL[method.type]}</div>
              <div className="text-[11px] text-muted-foreground truncate">{method.label}</div>
            </div>
            {active && (
              <m.div
                layoutId="pm-check"
                className="grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground"
              >
                <Check size={12} strokeWidth={3} />
              </m.div>
            )}
          </m.button>
        );
      })}
    </div>
  );
};
