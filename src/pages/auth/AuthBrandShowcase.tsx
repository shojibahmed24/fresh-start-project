import { useEffect, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { Quote, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { FEATURES, TESTIMONIALS } from "./constants";

export const AuthBrandShowcase = () => {
  const [tIdx, setTIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTIdx((i) => (i + 1) % TESTIMONIALS.length), 5500);
    return () => clearInterval(t);
  }, []);

  return (
    <aside className="hidden lg:flex relative flex-col justify-between p-12 xl:p-16 overflow-hidden">
      <div className="absolute inset-0 bg-[var(--gradient-mesh)] opacity-90" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-accent/10" aria-hidden />

      <div className="relative">
        <Logo size="lg" />
      </div>

      <div className="relative space-y-12 max-w-md">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 border border-primary/25 text-primary text-[11px] font-semibold uppercase tracking-wider px-3 py-1.5 mb-5">
            <Sparkles size={12} /> Build apps by describing them
          </div>
          <h2 className="text-4xl xl:text-5xl font-bold leading-[1.1] tracking-tight">
            Ship a real app{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-glow">
              before lunch.
            </span>
          </h2>
          <p className="mt-4 text-[15px] text-[hsl(var(--foreground-muted))] leading-relaxed">
            One prompt away from a working product. Your stack, your data — fully yours.
          </p>
        </div>

        <ul className="space-y-4">
          {FEATURES.map(({ Icon, title, body }, i) => (
            <m.li
              key={title}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.08, duration: 0.4 }}
              className="flex items-start gap-3"
            >
              <span className="shrink-0 size-9 rounded-lg bg-primary/15 border border-primary/20 grid place-items-center text-primary">
                <Icon size={16} />
              </span>
              <div>
                <div className="text-sm font-semibold">{title}</div>
                <div className="text-[12.5px] text-[hsl(var(--foreground-muted))] leading-relaxed">{body}</div>
              </div>
            </m.li>
          ))}
        </ul>
      </div>

      {/* Rotating testimonial */}
      <div className="relative">
        <div className="rounded-2xl border border-border bg-[hsl(var(--bg-elevated))]/60 backdrop-blur-md p-5 max-w-md shadow-[0_10px_40px_-10px_hsl(var(--primary)/0.25)]">
          <Quote className="text-primary mb-2" size={18} />
          <div className="relative h-[88px]">
            <AnimatePresence mode="wait">
              <m.div
                key={tIdx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0"
              >
                <p className="text-[13.5px] leading-relaxed text-foreground/90">
                  "{TESTIMONIALS[tIdx].quote}"
                </p>
                <div className="mt-3 text-[12px] text-[hsl(var(--foreground-muted))]">
                  <span className="font-semibold text-foreground">{TESTIMONIALS[tIdx].name}</span>
                  <span className="mx-1.5">·</span>
                  {TESTIMONIALS[tIdx].role}
                </div>
              </m.div>
            </AnimatePresence>
          </div>
          <div className="flex gap-1.5 mt-2">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Testimonial ${i + 1}`}
                onClick={() => setTIdx(i)}
                className={cn(
                  "h-1 rounded-full transition-all",
                  i === tIdx ? "w-6 bg-primary" : "w-1.5 bg-border hover:bg-[hsl(var(--foreground-subtle))]",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
