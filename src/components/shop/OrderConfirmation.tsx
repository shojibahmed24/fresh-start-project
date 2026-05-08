import { useEffect } from "react";
import { m } from "framer-motion";
// canvas-confetti is dynamically imported on first burst — keeps
// ~30KB out of the main shop bundle until checkout actually completes.
type ConfettiFn = (opts: Record<string, unknown>) => void;
let _confettiPromise: Promise<ConfettiFn> | null = null;
const loadConfetti = (): Promise<ConfettiFn> => {
  if (!_confettiPromise) {
    _confettiPromise = import("canvas-confetti").then((m) => m.default as unknown as ConfettiFn);
  }
  return _confettiPromise;
};
import { CheckCircle2, Coins, Clock, Receipt, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PaymentLogo } from "./PaymentLogo";

type MethodType = "bkash" | "nagad" | "rocket" | "crypto";

export type ConfirmationData = {
  packageName: string;
  amount: number;
  credits: number;
  bonusCredits?: number;
  methodType: MethodType;
  transactionId: string;
  promoCode?: string | null;
};

const TYPE_LABEL: Record<MethodType, string> = {
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
  crypto: "Crypto",
};

const fireConfetti = async () => {
  const confetti = await loadConfetti();
  const end = Date.now() + 1200;
  const colors = ["#a855f7", "#22d3ee", "#10b981", "#f59e0b"];
  const frame = () => {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 65,
      origin: { x: 0, y: 0.7 },
      colors,
      startVelocity: 55,
      scalar: 0.9,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 65,
      origin: { x: 1, y: 0.7 },
      colors,
      startVelocity: 55,
      scalar: 0.9,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  // initial burst
  confetti({
    particleCount: 90,
    spread: 90,
    origin: { y: 0.55 },
    colors,
    startVelocity: 45,
  });
  frame();
};

export const OrderConfirmation = ({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: ConfirmationData | null;
}) => {
  useEffect(() => {
    if (open && data) {
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (!reduced) fireConfetti();
    }
  }, [open, data]);

  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogTitle className="sr-only">Order submitted</DialogTitle>

        {/* Success header */}
        <div className="relative bg-gradient-to-br from-emerald-500/20 via-primary/10 to-cyan-500/20 px-6 pt-8 pb-6 text-center">
          <m.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500 shadow-[0_0_32px_hsl(150_80%_50%/0.5)]"
          >
            <CheckCircle2 size={36} className="text-white" strokeWidth={2.5} />
          </m.div>
          <m.h2
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-4 text-xl font-bold tracking-tight"
          >
            Order submitted!
          </m.h2>
          <m.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="mt-1 text-sm text-muted-foreground"
          >
            Admin approval er por credits add hobe.
          </m.p>
        </div>

        {/* Receipt body */}
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="px-6 py-5"
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Receipt size={12} /> Receipt
          </div>

          <div className="mt-3 rounded-xl border border-[hsl(0_0%_100%/0.08)] bg-[hsl(var(--bg-elevated))] divide-y divide-[hsl(0_0%_100%/0.06)]">
            <Row label="Package" value={data.packageName} />
            <Row
              label="Credits"
              value={
                <span className="inline-flex items-center gap-1.5 text-primary font-semibold">
                  <Coins size={13} /> {data.credits.toLocaleString()}
                  {data.bonusCredits && data.bonusCredits > 0 ? (
                    <span className="text-pink-300 text-xs">+{data.bonusCredits} bonus</span>
                  ) : null}
                </span>
              }
            />
            <Row
              label="Method"
              value={
                <span className="inline-flex items-center gap-2">
                  <PaymentLogo type={data.methodType} size={20} />
                  {TYPE_LABEL[data.methodType]}
                </span>
              }
            />
            <Row label="Transaction" value={<span className="font-mono text-xs break-all">{data.transactionId}</span>} />
            {data.promoCode && (
              <Row label="Promo" value={<span className="font-mono text-emerald-300">{data.promoCode}</span>} />
            )}
            <div className="flex items-center justify-between p-3">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-lg font-bold">৳{data.amount}</span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Clock size={12} /> Usually approved within minutes
          </div>

          <Button className="mt-5 w-full" onClick={onClose} rightIcon={<ArrowRight size={16} />}>
            Continue
          </Button>
        </m.div>
      </DialogContent>
    </Dialog>
  );
};

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 p-3 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right">{value}</span>
  </div>
);
