import { m } from "framer-motion";
import { useState } from "react";
import { Check, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tier = {
  name: string;
  tagline: string;
  monthly: number;
  yearly: number; // per month, billed annually
  features: string[];
  cta: string;
  popular?: boolean;
};

const TIERS: Tier[] = [
  {
    name: "Starter",
    tagline: "Try the full workflow free.",
    monthly: 0,
    yearly: 0,
    features: ["50 AI credits / month", "Unlimited projects", "Live preview", "Community support"],
    cta: "Start free",
  },
  {
    name: "Builder",
    tagline: "For makers shipping side-projects weekly.",
    monthly: 19,
    yearly: 15,
    features: [
      "1,500 AI credits / month",
      "Plan + Edit + Chat modes",
      "APK / iOS export",
      "Priority generation",
      "Email support",
    ],
    cta: "Start building",
    popular: true,
  },
  {
    name: "Studio",
    tagline: "Scale apps and teams.",
    monthly: 49,
    yearly: 39,
    features: [
      "5,000 AI credits / month",
      "Team workspace (5 seats)",
      "Custom domain on previews",
      "Build queue priority",
      "Dedicated support channel",
    ],
    cta: "Upgrade to Studio",
  },
];

export const PricingSection = () => {
  const [yearly, setYearly] = useState(true);

  return (
    <section id="pricing" className="py-16 sm:py-24 px-4 sm:px-6 relative">
      <div className="container-page">
        <div className="text-center mb-10 sm:mb-14">
          <m.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3"
          >
            Simple, <span className="text-gradient">credit-based</span> pricing
          </m.h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
            Pay only for what the AI generates. Cancel anytime.
          </p>

          {/* Billing toggle */}
          <div
            role="tablist"
            aria-label="Billing cycle"
            className="inline-flex items-center gap-1 p-1 rounded-full glass border border-border/60 mt-7"
          >
            <button
              role="tab"
              aria-selected={!yearly}
              onClick={() => setYearly(false)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                !yearly ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Monthly
            </button>
            <button
              role="tab"
              aria-selected={yearly}
              onClick={() => setYearly(true)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2",
                yearly ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Yearly
              <span
                className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                  yearly ? "bg-primary-foreground/20" : "bg-primary/15 text-primary"
                )}
              >
                −20%
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
          {TIERS.map((t, i) => {
            const price = yearly ? t.yearly : t.monthly;
            return (
              <m.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className={cn(
                  "relative rounded-3xl p-6 sm:p-7 flex flex-col",
                  t.popular
                    ? "bg-surface-elevated border border-primary/40 shadow-glow-lg"
                    : "glass border border-border/60"
                )}
              >
                {t.popular && (
                  <>
                    <div
                      className="absolute -inset-px rounded-3xl pointer-events-none -z-10"
                      style={{ background: "var(--gradient-border-accent)" }}
                    />
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-primary text-primary-foreground text-[11px] font-bold uppercase tracking-wider shadow-md">
                      <Sparkles size={12} /> Most popular
                    </div>
                  </>
                )}

                <div className="mb-5">
                  <h3 className="text-lg font-bold">{t.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1 min-h-[2.5rem]">{t.tagline}</p>
                </div>

                <div className="mb-6">
                  <div className="flex items-end gap-1">
                    <span className="text-5xl font-bold tracking-tight">${price}</span>
                    <span className="text-muted-foreground text-sm pb-2">/mo</span>
                  </div>
                  {yearly && t.monthly > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Billed ${price * 12}/year — save ${(t.monthly - t.yearly) * 12}
                    </div>
                  )}
                  {t.monthly === 0 && <div className="text-xs text-muted-foreground mt-1">Forever free</div>}
                </div>

                <ul className="space-y-2.5 mb-7 flex-1">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <span
                        className={cn(
                          "shrink-0 mt-0.5 w-4 h-4 rounded-full grid place-items-center",
                          t.popular ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"
                        )}
                      >
                        <Check size={11} strokeWidth={3} />
                      </span>
                      <span className="text-foreground/90">{f}</span>
                    </li>
                  ))}
                </ul>

                <Link to="/dashboard" className="block">
                  <Button
                    size="lg"
                    className={cn(
                      "w-full h-11 group",
                      t.popular
                        ? "bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow"
                        : "bg-surface-muted text-foreground hover:bg-surface-elevated border border-border"
                    )}
                  >
                    {t.cta}
                    <ArrowRight size={16} className="ml-1.5 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </Link>
              </m.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
