import { m } from "framer-motion";
import { Star, Users, Rocket, Code2 } from "lucide-react";

const STATS = [
  { icon: Users, value: "1,200+", label: "Active builders" },
  { icon: Rocket, value: "8,400+", label: "Apps generated" },
  { icon: Code2, value: "2.1M+", label: "Lines of code" },
  { icon: Star, value: "4.9/5", label: "Maker rating" },
];

const TESTIMONIALS = [
  {
    name: "Arif Hossain",
    role: "Indie founder · Dhaka",
    initials: "AH",
    quote:
      "Shipped my MVP in a weekend. The AI plan mode caught features I would've forgotten myself.",
    accent: "from-violet-500 to-fuchsia-500",
  },
  {
    name: "Priya Sen",
    role: "Product designer",
    initials: "PS",
    quote:
      "The visual edit + chat combo is wild. I describe a tweak in one line, it lands cleanly every time.",
    accent: "from-cyan-400 to-blue-500",
  },
  {
    name: "Daniyal Khan",
    role: "Full-stack dev",
    initials: "DK",
    quote:
      "Diff-based edits are a game changer — no more whole-file rewrites breaking unrelated screens.",
    accent: "from-pink-500 to-rose-500",
  },
];

export const SocialProof = () => {
  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6 relative">
      <div className="container-page">
        {/* Stats bar */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl glass border border-border/60 p-5 sm:p-7 mb-10 sm:mb-14"
        >
          <div className="text-center text-xs sm:text-sm text-muted-foreground uppercase tracking-widest mb-5">
            Trusted by 1,000+ builders worldwide
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {STATS.map((s, i) => (
              <m.div
                key={s.label}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary mb-2">
                  <s.icon size={18} />
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-gradient">{s.value}</div>
                <div className="text-xs sm:text-sm text-muted-foreground mt-1">{s.label}</div>
              </m.div>
            ))}
          </div>
        </m.div>

        {/* Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {TESTIMONIALS.map((t, i) => (
            <m.figure
              key={t.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="rounded-2xl glass border border-border/60 p-5 sm:p-6 hover:border-primary/30 hover:-translate-y-0.5 transition-all"
            >
              <div className="flex gap-0.5 mb-3 text-primary">
                {[0, 1, 2, 3, 4].map((n) => (
                  <Star key={n} size={14} className="fill-current" />
                ))}
              </div>
              <blockquote className="text-sm sm:text-[15px] text-foreground/90 leading-relaxed mb-5">
                "{t.quote}"
              </blockquote>
              <figcaption className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.accent} flex items-center justify-center text-sm font-bold text-white shadow-md`}
                >
                  {t.initials}
                </div>
                <div>
                  <div className="text-sm font-semibold">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </figcaption>
            </m.figure>
          ))}
        </div>
      </div>
    </section>
  );
};
