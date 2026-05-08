import { m } from "framer-motion";
import { Check, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TiltCard } from "@/components/shop/TiltCard";
import { AnimatedCounter } from "@/components/shop/AnimatedCounter";
import type { Package } from "./types";

type Props = {
  packages: Package[];
  isAdmin: boolean;
  onSelect: (p: Package) => void;
};

export const PackageGrid = ({ packages, isAdmin, onSelect }: Props) => {
  if (packages.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Kono package nei. {isAdmin && "Admin panel theke add korun."}
      </div>
    );
  }
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {packages.map((p, i) => (
        <m.div
          key={p.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <TiltCard glow={p.is_popular} className="h-full">
            <div
              className={`relative h-full rounded-2xl p-5 border ${
                p.is_popular
                  ? "bg-gradient-to-b from-primary/10 via-[hsl(var(--bg-elevated))] to-[hsl(var(--bg-elevated))] border-primary/40"
                  : "bg-[hsl(var(--bg-elevated))] border-[hsl(0_0%_100%/0.08)]"
              }`}
            >
              {p.is_popular && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground border-0 shadow-[0_4px_16px_hsl(var(--primary)/0.5)]">
                    ✨ Most Popular
                  </Badge>
                </div>
              )}
              <div className="text-sm font-medium text-muted-foreground">{p.name}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold tabular-nums">৳{p.price}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-primary">
                <Coins size={14} />
                <span className="font-semibold tabular-nums">
                  <AnimatedCounter value={p.credits} /> credits
                </span>
              </div>
              {p.description && (
                <p className="mt-3 text-sm text-muted-foreground min-h-[40px]">{p.description}</p>
              )}
              <ul className="mt-4 space-y-1.5 text-sm">
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-primary" /> Instant after approval
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-primary" /> No expiry
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-primary" /> Use across all projects
                </li>
              </ul>
              <Button
                className="mt-5 w-full"
                variant={p.is_popular ? "primary" : "secondary"}
                onClick={() => onSelect(p)}
              >
                Buy now
              </Button>
            </div>
          </TiltCard>
        </m.div>
      ))}
    </div>
  );
};
