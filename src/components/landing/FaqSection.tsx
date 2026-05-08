import { m } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "What can I actually build with OneClick Studio?",
    a: "Production-grade mobile apps, web apps and dashboards. Examples: e-commerce, social feeds, fitness trackers, finance tools, internal tools, AI chatbots — anything you can describe in words.",
  },
  {
    q: "Do I need to know how to code?",
    a: "No. The chat handles everything in plain English (or Bangla). If you do code, you can drop into the file editor and tweak anything by hand — your changes are preserved.",
  },
  {
    q: "How are credits used?",
    a: "Each AI generation, edit or chat reply consumes a small number of credits depending on size. The Builder plan includes 1,500 credits/month — enough for ~30 medium-sized features.",
  },
  {
    q: "Can I export my code?",
    a: "Yes. Every project gives you the full source code — React + TypeScript. You can also export native APK/iOS builds directly from the builder.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes. Starter is free forever with 50 monthly credits — enough to build and ship your first small app and feel the workflow end-to-end.",
  },
  {
    q: "What about my data and privacy?",
    a: "Your projects, code and prompts are private by default. We never train models on your data, and you can delete projects permanently at any time.",
  },
];

export const FaqSection = () => {
  return (
    <section id="faq" className="py-16 sm:py-24 px-4 sm:px-6 relative">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10 sm:mb-14">
          <m.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3"
          >
            Frequently asked <span className="text-gradient">questions</span>
          </m.h2>
          <p className="text-muted-foreground text-base sm:text-lg">
            Everything you need to know before getting started.
          </p>
        </div>

        <m.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl glass border border-border/60 p-2 sm:p-3"
        >
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((f, i) => (
              <AccordionItem
                key={f.q}
                value={`item-${i}`}
                className="border-b border-border/40 last:border-0 px-3 sm:px-4"
              >
                <AccordionTrigger className="text-left text-base sm:text-[15px] font-semibold py-5 hover:text-primary [&[data-state=open]]:text-primary transition-colors">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm sm:text-[15px] leading-relaxed pb-5">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </m.div>
      </div>
    </section>
  );
};
