import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { Check, Loader2, Tag, X as XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type AppliedPromo = {
  code: string;
  discount: number;
  bonus: number;
  final: number;
};

/**
 * Promo input with debounced live validation against `validate_promo` RPC.
 * Shows spinner while checking, animated check on valid, animated X on invalid.
 */
export const PromoInput = ({
  packageId,
  amount,
  applied,
  onApply,
  onClear,
}: {
  packageId: string;
  amount: number;
  applied: AppliedPromo | null;
  onApply: (p: AppliedPromo) => void;
  onClear: () => void;
}) => {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "invalid">("idle");
  const [error, setError] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  // Debounced validation
  useEffect(() => {
    if (applied) return;
    const code = value.trim().toUpperCase();
    if (code.length < 3) {
      setStatus("idle");
      setError(null);
      return;
    }
    const myReq = ++reqIdRef.current;
    setStatus("checking");
    setError(null);
    const id = setTimeout(async () => {
      const { data, error: err } = await supabase.rpc("validate_promo", {
        _code: code,
        _package_id: packageId,
        _amount: amount,
      });
      if (myReq !== reqIdRef.current) return; // superseded
      if (err) {
        setStatus("invalid");
        setError(err.message);
        return;
      }
      const row = (data ?? [])[0] as
        | { promo_id: string | null; discount_amount: number; bonus_credits: number; final_amount: number; message: string }
        | undefined;
      if (!row || !row.promo_id) {
        setStatus("invalid");
        setError(row?.message ?? "Invalid code");
        return;
      }
      setStatus("idle");
      setError(null);
      onApply({
        code,
        discount: Number(row.discount_amount),
        bonus: Number(row.bonus_credits),
        final: Number(row.final_amount),
      });
    }, 450);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, packageId, amount, applied]);

  return (
    <div>
      <Label className="text-xs flex items-center gap-1">
        <Tag size={12} /> Promo code (optional)
      </Label>

      <AnimatePresence mode="wait" initial={false}>
        {applied ? (
          <m.div
            key="applied"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-1.5 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2"
          >
            <m.div
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 18 }}
              className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-white"
            >
              <Check size={14} strokeWidth={3} />
            </m.div>
            <span className="font-mono text-sm font-semibold text-emerald-300">{applied.code}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              -৳{applied.discount}
              {applied.bonus > 0 && ` · +${applied.bonus}c`}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                onClear();
                setValue("");
              }}
              aria-label="Remove promo"
            >
              <XIcon size={14} />
            </Button>
          </m.div>
        ) : (
          <m.div key="input" className="mt-1.5">
            <div className="relative">
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value.toUpperCase())}
                placeholder="SAVE10"
                className={cn(
                  "font-mono uppercase pr-10 transition-colors",
                  status === "invalid" && "border-destructive/60 focus-visible:ring-destructive/40",
                )}
                aria-invalid={status === "invalid"}
              />
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                <AnimatePresence mode="wait" initial={false}>
                  {status === "checking" && (
                    <m.div
                      key="loading"
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                    >
                      <Loader2 size={16} className="animate-spin text-muted-foreground" />
                    </m.div>
                  )}
                  {status === "invalid" && (
                    <m.div
                      key="invalid"
                      initial={{ opacity: 0, scale: 0.4, rotate: -90 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.4 }}
                      transition={{ type: "spring", stiffness: 400, damping: 16 }}
                      className="grid h-5 w-5 place-items-center rounded-full bg-destructive text-destructive-foreground"
                    >
                      <XIcon size={12} strokeWidth={3} />
                    </m.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <AnimatePresence>
              {error && (
                <m.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-1 text-xs text-destructive"
                >
                  {error}
                </m.p>
              )}
            </AnimatePresence>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
};
