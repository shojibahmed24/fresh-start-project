import { useEffect, useMemo, useState } from "react";
import { m } from "framer-motion";
import { HelpCircle, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Faq = {
  id: string;
  question: string;
  answer: string;
  category: string;
};

export const FaqSection = () => {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");

  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase as any)
        .from("faqs")
        .select("id,question,answer,category")
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("sort_order", { ascending: true });
      setFaqs((data ?? []) as Faq[]);
      setLoading(false);
    };
    load();

    const channel = (supabase as any)
      .channel(`faqs-public-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "faqs" }, load)
      .subscribe();
    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, []);

  const categories = useMemo(() => {
    const set = new Set(faqs.map((f) => f.category || "general"));
    return ["all", ...Array.from(set)];
  }, [faqs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return faqs.filter((f) => {
      if (activeCat !== "all" && (f.category || "general") !== activeCat) return false;
      if (!q) return true;
      return f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q);
    });
  }, [faqs, search, activeCat]);

  if (loading) return null;
  if (faqs.length === 0) return null;

  return (
    <section className="mt-16">
      <m.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-8"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.08)] text-xs text-muted-foreground mb-3">
          <HelpCircle size={12} />
          Frequently asked
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Got questions?</h2>
        <p className="mt-2 text-muted-foreground text-sm">Common queries about credits, payments and more.</p>
      </m.div>

      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search FAQs…"
              className="pl-9"
            />
          </div>
          {categories.length > 2 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setActiveCat(c)}
                  className={`px-3 h-9 rounded-md text-xs font-medium whitespace-nowrap border transition ${
                    activeCat === c
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-[hsl(var(--bg-elevated))] text-muted-foreground border-[hsl(0_0%_100%/0.08)] hover:text-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            Kichu khuje paoa gelo na.
          </div>
        ) : (
          <Accordion type="single" collapsible className="rounded-xl bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.08)] px-4 divide-y divide-[hsl(0_0%_100%/0.06)]">
            {filtered.map((f) => (
              <AccordionItem key={f.id} value={f.id} className="border-b-0">
                <AccordionTrigger className="text-left hover:no-underline">
                  <div className="flex items-start gap-3 pr-3">
                    <span className="text-foreground">{f.question}</span>
                    {f.category && f.category !== "general" && (
                      <Badge variant="outline" className="text-[10px] uppercase shrink-0">{f.category}</Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {f.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </section>
  );
};
