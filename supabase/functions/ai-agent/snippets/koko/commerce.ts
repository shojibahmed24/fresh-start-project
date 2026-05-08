import type { Snippet } from "../types.ts";

export const KOKO_PRICING_CARD: Snippet = {
  name: "Premium pricing card with glow + featured badge",
  why: "SaaS/subscription/upgrade screens need a 3-tier pricing block with one tier glowing.",
  uses: ["lucide-react: Check, Sparkles"],
  code: `function PricingCard({ plan, featured }) {
  return (
    <article className={\`relative rounded-3xl p-6 border transition
      \${featured
        ? "bg-gradient-to-br from-primary/15 via-card to-card border-primary/40 shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.5)]"
        : "bg-card border-border hover:border-primary/30"}\`}>
      {featured && (
        <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full
          bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-primary-foreground">
          <Sparkles className="h-3 w-3" /> Popular
        </span>
      )}
      <p className="text-sm font-semibold text-muted-foreground">{plan.name}</p>
      <p className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-bold tabular-nums">\${plan.price}</span>
        <span className="text-sm text-muted-foreground">/ {plan.period}</span>
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{plan.tagline}</p>
      <ul className="mt-5 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className="h-4 w-4 mt-0.5 text-primary shrink-0" strokeWidth={3} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button className={\`mt-6 w-full rounded-full py-2.5 text-sm font-semibold transition
        \${featured
          ? "bg-primary text-primary-foreground hover:scale-[1.02]"
          : "bg-muted hover:bg-muted/70"}\`}>
        {plan.cta || "Choose plan"}
      </button>
    </article>
  );
}`,
};

export const KOKO_INVOICE_LINE: Snippet = {
  name: "Invoice line item editor row",
  why: "Invoicing/billing apps need editable line rows: description, qty, rate, total, delete.",
  uses: ["lucide-react: Trash2"],
  code: `function InvoiceLine({ line, onChange, onDelete }) {
  const total = (line.qty * line.rate).toFixed(2);
  return (
    <div className="grid grid-cols-[1fr_60px_70px_80px_32px] items-center gap-2 rounded-xl
      bg-card border border-border/60 p-2">
      <input value={line.desc} onChange={(e) => onChange({ ...line, desc: e.target.value })}
        placeholder="Description"
        className="bg-transparent text-sm outline-none px-2 py-1.5 rounded" />
      <input type="number" value={line.qty} onChange={(e) => onChange({ ...line, qty: +e.target.value })}
        className="bg-muted/40 text-sm tabular-nums outline-none px-2 py-1.5 rounded text-right" />
      <input type="number" value={line.rate} onChange={(e) => onChange({ ...line, rate: +e.target.value })}
        className="bg-muted/40 text-sm tabular-nums outline-none px-2 py-1.5 rounded text-right" />
      <p className="text-sm font-bold tabular-nums text-right">\${total}</p>
      <button onClick={onDelete} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}`,
};

export const KOKO_CART_ROW: Snippet = {
  name: "Cart line item with quantity stepper",
  why: "E-commerce carts need image + name + size/variant + qty +/- + price + remove.",
  uses: ["lucide-react: Minus, Plus, X"],
  code: `function CartRow({ item, onQty, onRemove }) {
  return (
    <li className="flex gap-3 rounded-2xl bg-card border border-border/50 p-3">
      <img src={item.image} alt={item.name} className="h-20 w-20 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-snug line-clamp-2">{item.name}</h3>
          <button onClick={() => onRemove(item.id)} className="text-muted-foreground hover:text-rose-500">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{item.variant}</p>
        <div className="mt-2 flex items-center justify-between">
          <div className="inline-flex items-center rounded-full border border-border">
            <button onClick={() => onQty(item.id, Math.max(1, item.qty - 1))}
              className="grid h-7 w-7 place-items-center hover:bg-muted rounded-l-full">
              <Minus className="h-3 w-3" />
            </button>
            <span className="px-3 text-sm font-bold tabular-nums">{item.qty}</span>
            <button onClick={() => onQty(item.id, item.qty + 1)}
              className="grid h-7 w-7 place-items-center hover:bg-muted rounded-r-full">
              <Plus className="h-3 w-3" />
            </button>
          </div>
          <p className="text-base font-bold tabular-nums">\${(item.price * item.qty).toFixed(2)}</p>
        </div>
      </div>
    </li>
  );
}`,
};

export const KOKO_CHECKOUT_BAR: Snippet = {
  name: "Sticky checkout / cart summary bar",
  why: "Cart screens need a sticky bottom bar with total + 'Checkout' CTA — never scroll-only.",
  uses: ["lucide-react: ArrowRight"],
  code: `function CheckoutBar({ count, total, onCheckout }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md
      border-t border-border bg-background/90 backdrop-blur-lg p-3">
      <button onClick={onCheckout}
        className="flex w-full items-center justify-between rounded-2xl bg-primary text-primary-foreground
          px-4 py-3.5 hover:scale-[1.01] transition">
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-white/20 text-xs">{count}</span>
          Checkout
        </span>
        <span className="inline-flex items-center gap-2 text-base font-bold tabular-nums">
          \${total.toFixed(2)} <ArrowRight className="h-4 w-4" />
        </span>
      </button>
    </div>
  );
}`,
};

export const KOKO_REVIEW_CARD: Snippet = {
  name: "Customer review card with rating + verified badge",
  why: "Product/service apps need review cards with stars, body, and verified-purchase pill.",
  uses: ["lucide-react: Star, BadgeCheck"],
  code: `function ReviewCard({ review }) {
  return (
    <article className="rounded-2xl bg-card border border-border/60 p-4">
      <header className="flex items-center gap-3">
        <img src={review.user.avatar} alt="" className="h-9 w-9 rounded-full" />
        <div className="min-w-0">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            {review.user.name}
            {review.verified && <BadgeCheck className="h-3.5 w-3.5 text-sky-500" />}
          </p>
          <p className="text-xs text-muted-foreground">{review.date}</p>
        </div>
        <div className="ml-auto flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={\`h-3.5 w-3.5 \${i < review.rating ? "fill-amber-400 text-amber-400" : "text-muted"}\`} />
          ))}
        </div>
      </header>
      <h4 className="mt-3 text-sm font-bold">{review.title}</h4>
      <p className="mt-1 text-sm leading-relaxed text-foreground/80">{review.body}</p>
    </article>
  );
}`,
};

