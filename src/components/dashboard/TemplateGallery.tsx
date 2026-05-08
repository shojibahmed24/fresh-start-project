import { useMemo, useState } from "react";
import { m } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { TEMPLATES, type Template } from "@/lib/templates";

type Props = {
  onPick: (tpl: Template) => void;
};

/** Map each template to a high-level category so we can offer filter chips. */
const categoryFor = (id: string): string => {
  if (["ecommerce", "food", "restaurant", "directory"].includes(id)) return "Commerce";
  if (["chat", "social", "social-feed", "ai-chat"].includes(id)) return "Social";
  if (["todo", "fitness", "blog", "booking", "course"].includes(id)) return "Productivity";
  if (["admin-dashboard", "saas-landing", "crm", "job-board", "event"].includes(id)) return "Business";
  if (["portfolio"].includes(id)) return "Creator";
  return "Other";
};

const ALL = "All" as const;

export const TemplateGallery = ({ onPick }: Props) => {
  const [active, setActive] = useState<string>(ALL);
  const [hovered, setHovered] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>([ALL]);
    TEMPLATES.forEach((t) => set.add(categoryFor(t.id)));
    return Array.from(set);
  }, []);

  const filtered = useMemo(
    () => TEMPLATES.filter((t) => active === ALL || categoryFor(t.id) === active),
    [active],
  );

  return (
    <div className="mb-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold">Start from a template</h2>
          <p className="text-xs text-muted-foreground">Pick a category and tap a card to auto-build.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              className={[
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                active === cat
                  ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow"
                  : "bg-card/50 text-muted-foreground border-border/60 hover:border-primary/40 hover:text-foreground",
              ].join(" ")}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map((tpl, i) => {
          const isHover = hovered === tpl.id;
          return (
            <m.button
              key={tpl.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onMouseEnter={() => setHovered(tpl.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onPick(tpl)}
              className="group relative overflow-hidden rounded-2xl text-left bg-card/50 border border-border/60 hover:border-primary/50 hover:scale-[1.02] transition-all min-h-[150px] flex flex-col"
            >
              {/* Gradient wash on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${tpl.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

              {/* Floating emoji preview */}
              <div className="relative p-4 flex-1">
                <m.div
                  animate={isHover ? { scale: 1.15, rotate: -6 } : { scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 220, damping: 14 }}
                  className="text-3xl mb-2"
                >
                  {tpl.emoji}
                </m.div>
                <div className="font-semibold text-sm group-hover:text-white transition-colors">{tpl.name}</div>
                <div className="text-xs text-muted-foreground group-hover:text-white/80 transition-colors line-clamp-2 mt-0.5">
                  {tpl.tagline}
                </div>
              </div>

              {/* Use template CTA — slides up on hover */}
              <div className="relative px-4 pb-3">
                <div className="flex items-center justify-between gap-2 text-xs font-semibold text-foreground group-hover:text-white transition-colors">
                  <span className="opacity-70 group-hover:opacity-100">Use template</span>
                  <m.span
                    animate={isHover ? { x: 4 } : { x: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 18 }}
                  >
                    <ArrowRight size={14} />
                  </m.span>
                </div>
              </div>
            </m.button>
          );
        })}
      </div>
    </div>
  );
};
