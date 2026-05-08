import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PaymentMethodPicker } from "@/components/shop/PaymentMethodPicker";
import { PromoInput, type AppliedPromo } from "@/components/shop/PromoInput";
import { PaymentLogo } from "@/components/shop/PaymentLogo";
import { METHOD_META, type Package, type PaymentMethod } from "./types";

type Props = {
  selected: Package | null;
  selectedMethod: PaymentMethod | null;
  methods: PaymentMethod[];
  senderAccount: string;
  setSenderAccount: (v: string) => void;
  transactionId: string;
  setTransactionId: (v: string) => void;
  cryptoCurrency: string;
  setCryptoCurrency: (v: string) => void;
  promoApplied: AppliedPromo | null;
  setPromoApplied: (v: AppliedPromo | null) => void;
  submitting: boolean;
  onMethodSelect: (m: PaymentMethod) => void;
  onClearMethod: () => void;
  onClose: () => void;
  onSubmit: () => void;
};

export const BuyDialog = ({
  selected,
  selectedMethod,
  methods,
  senderAccount,
  setSenderAccount,
  transactionId,
  setTransactionId,
  cryptoCurrency,
  setCryptoCurrency,
  promoApplied,
  setPromoApplied,
  submitting,
  onMethodSelect,
  onClearMethod,
  onClose,
  onSubmit,
}: Props) => (
  <Dialog open={!!selected} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Buy {selected?.name}</DialogTitle>
        <DialogDescription>
          ৳{selected?.price} = <span className="text-primary">{selected?.credits} credits</span>
        </DialogDescription>
      </DialogHeader>

      {!selectedMethod ? (
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground">Choose payment method</Label>
          <PaymentMethodPicker methods={methods} onSelect={onMethodSelect} />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl p-3 bg-[hsl(var(--bg-elevated))] border border-primary/20">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-semibold">
                <PaymentLogo type={selectedMethod.type} size={22} />
                {METHOD_META[selectedMethod.type].label}
              </span>
              <button onClick={onClearMethod} className="text-xs text-primary hover:underline">
                Change
              </button>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">{selectedMethod.label}</div>
            <div className="mt-2 p-2 rounded bg-background/40 font-mono text-sm break-all select-all">
              {selectedMethod.account_number}
            </div>
            {selectedMethod.instructions && (
              <p className="mt-2 text-xs text-muted-foreground">{selectedMethod.instructions}</p>
            )}
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>৳{selected?.price}</span>
              </div>
              {promoApplied && (
                <>
                  <div className="flex items-center justify-between text-emerald-300">
                    <span>{promoApplied.code}</span>
                    <span>-৳{promoApplied.discount}</span>
                  </div>
                  {promoApplied.bonus > 0 && (
                    <div className="flex items-center justify-between text-pink-300 text-xs">
                      <span>Bonus credits</span>
                      <span>+{promoApplied.bonus}</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex items-center justify-between font-semibold pt-1 border-t border-[hsl(0_0%_100%/0.08)]">
                <span>Total to pay</span>
                <span className="text-base">৳{promoApplied ? promoApplied.final : selected?.price}</span>
              </div>
            </div>
          </div>

          {selected && (
            <PromoInput
              packageId={selected.id}
              amount={selected.price}
              applied={promoApplied}
              onApply={setPromoApplied}
              onClear={() => setPromoApplied(null)}
            />
          )}

          {selectedMethod.type === "crypto" ? (
            <div>
              <Label htmlFor="crypto" className="text-xs">Currency</Label>
              <Input
                id="crypto"
                value={cryptoCurrency}
                onChange={(e) => setCryptoCurrency(e.target.value)}
                placeholder="USDT, BTC, etc."
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="sender" className="text-xs">
                Apnar {METHOD_META[selectedMethod.type].label} number
              </Label>
              <Input
                id="sender"
                value={senderAccount}
                onChange={(e) => setSenderAccount(e.target.value)}
                placeholder="01XXXXXXXXX"
              />
            </div>
          )}

          <div>
            <Label htmlFor="txid" className="text-xs">
              Transaction ID {selectedMethod.type === "crypto" && "(TX hash)"}
            </Label>
            <Textarea
              id="txid"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder={
                selectedMethod.type === "crypto" ? "0x... ba TRC20 hash" : "TXID e.g. AB12CD34"
              }
              rows={2}
            />
          </div>

          <Button className="w-full" onClick={onSubmit} loading={submitting}>
            Submit order for review
          </Button>
        </div>
      )}
    </DialogContent>
  </Dialog>
);
