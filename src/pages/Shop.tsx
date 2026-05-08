import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { m } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { UserInvoices } from "@/components/UserInvoices";
import { AnnouncementsBar } from "@/components/AnnouncementsBar";
import { FaqSection } from "@/components/FaqSection";
import { OrderConfirmation, type ConfirmationData } from "@/components/shop/OrderConfirmation";
import { type AppliedPromo } from "@/components/shop/PromoInput";
import { ShopHeader } from "./shop/ShopHeader";
import { PackageGrid } from "./shop/PackageGrid";
import { OrderHistory } from "./shop/OrderHistory";
import { BuyDialog } from "./shop/BuyDialog";
import type { Package, PaymentMethod, Order } from "./shop/types";

const Shop = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { balance, totalPurchased } = useCredits();
  const { isAdmin } = useUserRole();

  const [packages, setPackages] = useState<Package[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<Package | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [senderAccount, setSenderAccount] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [cryptoCurrency, setCryptoCurrency] = useState("USDT");
  const [submitting, setSubmitting] = useState(false);
  const [promoApplied, setPromoApplied] = useState<AppliedPromo | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationData | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth", { replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [pkg, pm, ord] = await Promise.all([
        supabase.from("packages").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("payment_methods").select("*").eq("is_active", true).order("type"),
        supabase
          .from("orders")
          .select("id, package_name, amount, credits, payment_method, status, created_at, admin_notes")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      setPackages((pkg.data ?? []) as Package[]);
      setMethods((pm.data ?? []) as PaymentMethod[]);
      setOrders((ord.data ?? []) as Order[]);
      setLoading(false);
    })();
  }, [user]);

  const methodsForSelection = useMemo(() => methods, [methods]);

  const closeDialog = () => {
    setSelected(null);
    setSelectedMethod(null);
    setSenderAccount("");
    setTransactionId("");
    setCryptoCurrency("USDT");
    setPromoApplied(null);
  };

  const handleSubmitOrder = async () => {
    if (!selected || !selectedMethod || !user) return;
    if (!transactionId.trim()) {
      toast.error("Transaction ID din");
      return;
    }
    if (selectedMethod.type !== "crypto" && !senderAccount.trim()) {
      toast.error("Apnar account number din");
      return;
    }
    setSubmitting(true);
    const finalAmount = promoApplied ? promoApplied.final : selected.price;

    let ipAddress: string | null = null;
    try {
      const r = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(2500) });
      if (r.ok) ipAddress = (await r.json())?.ip ?? null;
    } catch {
      /* IP capture optional */
    }

    const { error } = await supabase.from("orders").insert({
      user_id: user.id,
      package_id: selected.id,
      package_name: selected.name,
      amount: finalAmount,
      credits: selected.credits,
      payment_method: selectedMethod.type,
      sender_account: senderAccount.trim(),
      transaction_id: transactionId.trim(),
      crypto_currency: selectedMethod.type === "crypto" ? cryptoCurrency : "",
      status: "pending",
      promo_code: promoApplied?.code ?? null,
      promo_discount: promoApplied?.discount ?? 0,
      promo_bonus_credits: promoApplied?.bonus ?? 0,
      ip_address: ipAddress,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setConfirmation({
      packageName: selected.name,
      amount: finalAmount,
      credits: selected.credits,
      bonusCredits: promoApplied?.bonus ?? 0,
      methodType: selectedMethod.type,
      transactionId: transactionId.trim(),
      promoCode: promoApplied?.code ?? null,
    });
    closeDialog();
    const { data } = await supabase
      .from("orders")
      .select("id, package_name, amount, credits, payment_method, status, created_at, admin_notes")
      .order("created_at", { ascending: false })
      .limit(20);
    setOrders((data ?? []) as Order[]);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-background text-muted-foreground">
        Loading shop…
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <ShopHeader balance={balance} isAdmin={isAdmin} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <m.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
            Power up your <span className="text-primary">builds</span>
          </h1>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Bangladeshi mobile banking ba crypto diye easy payment. Admin approval er por instantly credit add hoye jabe.
          </p>
          <div className="mt-6 inline-flex items-center gap-6 px-6 py-3 rounded-2xl bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.08)]">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{balance}</div>
              <div className="text-xs text-muted-foreground">Available</div>
            </div>
            <div className="h-8 w-px bg-[hsl(0_0%_100%/0.08)]" />
            <div className="text-center">
              <div className="text-2xl font-bold">{totalPurchased}</div>
              <div className="text-xs text-muted-foreground">Lifetime</div>
            </div>
          </div>
        </m.div>

        <AnnouncementsBar />

        <PackageGrid packages={packages} isAdmin={isAdmin} onSelect={setSelected} />

        <UserInvoices />

        <OrderHistory orders={orders} />

        <FaqSection />
      </main>

      <BuyDialog
        selected={selected}
        selectedMethod={selectedMethod}
        methods={methodsForSelection}
        senderAccount={senderAccount}
        setSenderAccount={setSenderAccount}
        transactionId={transactionId}
        setTransactionId={setTransactionId}
        cryptoCurrency={cryptoCurrency}
        setCryptoCurrency={setCryptoCurrency}
        promoApplied={promoApplied}
        setPromoApplied={setPromoApplied}
        submitting={submitting}
        onMethodSelect={setSelectedMethod}
        onClearMethod={() => setSelectedMethod(null)}
        onClose={closeDialog}
        onSubmit={handleSubmitOrder}
      />

      <OrderConfirmation
        open={!!confirmation}
        onClose={() => setConfirmation(null)}
        data={confirmation}
      />
    </div>
  );
};

export default Shop;
