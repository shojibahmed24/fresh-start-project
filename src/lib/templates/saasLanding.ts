import type { Template } from "./types";

export const saasLandingTemplate: Template = {
  id: "saas-landing",
  emoji: "🚀",
  name: "SaaS Landing",
  tagline: "High-converting marketing site",
  gradient: "from-violet-600 to-fuchsia-600",
  defaultName: "My SaaS",
  defaultDescription: "Modern SaaS marketing landing page with hero, features, pricing, testimonials.",
  starterPrompt: `Build a COMPLETE, fully working DESKTOP-FIRST SaaS marketing landing page. This is a marketing site, NOT an app — optimize for laptop/desktop with smooth scrolling sections. Requirements:
- Use react-router-dom with routes: /, /pricing, /blog, /blog/:slug, /docs, /login, /signup. Smooth scroll for in-page anchors.
- Custom design system in index.css and tailwind.config.ts using HSL semantic tokens (a single bold brand gradient + neutral surfaces). Support light AND dark theme toggle (next-themes) in the navbar.
- Use framer-motion for: hero entrance (staggered), section reveals on scroll (whileInView), animated stats counter, marquee logos.
- Use lucide-react icons, shadcn/ui (Button, Card, Tabs, Accordion, Badge), tailwind only.
- Every CTA, nav link, anchor link, pricing toggle, FAQ accordion, theme toggle MUST work.

📁 **MODULAR FILE RULE (STRICT):**
- NO file > 300 lines (target 150-220).
- Each landing section is its own component in \`src/components/landing/\`: Navbar, HeroSection, LogoMarquee, FeatureGrid, FeatureSpotlight, HowItWorks, PricingSection, TestimonialsSection, FaqSection, CtaBanner, Footer.
- The home page (\`src/pages/Home.tsx\`) just composes these — under 80 lines.
- Reusable: \`components/ui/GradientText.tsx\`, \`AnimatedCounter.tsx\`, \`SectionHeading.tsx\`.
- Mock data in \`src/data/{features,pricing,testimonials,faqs,logos}.ts\`.

Sections (top → bottom on /):
1. **Navbar** — sticky, glass blur on scroll, logo, nav links (Features, Pricing, Docs, Blog), theme toggle, "Sign in" + gradient "Start free" CTA.
2. **Hero** — eyebrow chip ("New: AI assistant ✨"), huge gradient headline (2 lines), supporting paragraph, dual CTAs ("Start free trial" + "Watch demo" with play icon), trust row ("No credit card • 14-day trial • SOC 2"), product screenshot mockup with subtle tilt + glow.
3. **Logo marquee** — "Trusted by teams at" + infinite-scroll logo strip (8+ greyscale brand-name SVGs/divs).
4. **Feature grid** — section heading + 6 feature cards (icon + title + 2-line desc), bento-style asymmetric layout.
5. **Feature spotlight** — alternating image-left / image-right rows (3 rows), each with eyebrow, headline, bullets with check icons, mock UI screenshot.
6. **How it works** — 3 steps with numbered badges, connecting line, screenshot per step.
7. **Stats strip** — animated counters (e.g., "10M+ requests", "99.99% uptime", "4.9/5 rating", "120 countries").
8. **Testimonials** — 3-column grid of quote cards with avatar, name, role, company logo. One "featured" testimonial larger.
9. **Pricing** — monthly/annual toggle (annual shows "Save 20%" badge), 3 tiers (Starter / Pro highlighted with "Most popular" ring / Enterprise), feature checklist per tier, CTA per tier.
10. **FAQ** — Accordion with 6+ questions.
11. **Final CTA banner** — gradient background, big headline, email input + "Get started" button.
12. **Footer** — 4 link columns + social icons + small print.

Other pages (lighter, share Navbar/Footer):
- /pricing — same pricing section + comparison table (10+ feature rows × 3 plans with check/dash).
- /blog — grid of 9+ article cards (cover + category badge + title + author + date + read time). /blog/:slug — typeset article with prose body + author card + related posts.
- /docs — 2-column layout (sidebar nav + content), 4-5 sample docs pages.
- /login, /signup — centered card forms with social auth buttons (Google, GitHub).

Seed: 6 features, 3 pricing tiers with 8+ items each, 6 testimonials, 8 FAQs, 9 blog posts, 8 brand logos.`,
};
