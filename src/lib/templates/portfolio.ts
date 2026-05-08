import type { Template } from "./types";

export const portfolioTemplate: Template = {
  id: "portfolio",
  emoji: "🎨",
  name: "Portfolio",
  tagline: "Personal showcase site",
  gradient: "from-zinc-700 to-zinc-900",
  defaultName: "My Portfolio",
  defaultDescription: "Personal portfolio site showcasing projects, work history, skills and contact form.",
  starterPrompt: `Build a COMPLETE, fully working DESKTOP-FIRST personal portfolio website. Bold editorial design — should feel like a designer/dev's personal brand, not a template. Requirements:
- react-router-dom routes: /, /projects, /project/:id, /about, /writing, /writing/:slug, /contact.
- Custom design system in index.css + tailwind.config.ts (HSL tokens, opinionated personality — pick a strong direction: brutalist editorial OR dark premium OR warm earthy serif). Theme toggle.
- framer-motion for hero text reveal, project hover lifts, page transitions, scroll-triggered reveals, magnetic cursor on CTAs.
- shadcn/ui + lucide-react + tailwind only.
- Every nav link, project card, filter, contact form (with validation + toast on submit), theme toggle MUST work.

📁 **MODULAR FILE RULE (STRICT):**
- No file > 300 lines.
- \`src/components/portfolio/\`: SiteNav, HeroIntro, MarqueeRoles, FeaturedProjects, ProjectCard, SkillsCloud, ExperienceTimeline, TestimonialsRow, ContactForm, SiteFooter.
- \`src/pages/Home.tsx\` < 100 lines, just composes.
- \`src/data/{projects,experience,skills,writing,testimonials}.ts\`.

Pages:
1. **/** — SiteNav (logo monogram, links: Work, About, Writing, Contact, theme toggle); HeroIntro (huge name, role line with rotating words via framer-motion, short bio, "View work" + "Get in touch" CTAs, scroll cue); MarqueeRoles (infinite scroll: "Designer • Developer • Writer • Speaker"); FeaturedProjects (3-4 large project cards with cover image, title, year, role, tech stack chips, hover reveal CTA); SkillsCloud (categorized chips); ExperienceTimeline (vertical timeline with company logo, role, dates, 1-line summary); TestimonialsRow (3 quotes); ContactForm + SiteFooter.
2. **/projects** — filter chips by category (All, Web, Mobile, Branding, Writing), masonry/asymmetric grid of 12+ projects.
3. **/project/:id** — hero (cover + title + meta), problem/process/outcome sections, full image gallery (lightbox on click), tech stack list, "Next project" link at bottom.
4. **/about** — large portrait, long-form bio, values/principles list, downloadable resume button, current focus card, photos of workspace.
5. **/writing** — list of articles (cover thumb + title + excerpt + read time + tags). /writing/:slug — typeset article with prose, code blocks, pull quotes.
6. **/contact** — form (name, email, subject, message) with react-hook-form + zod validation, social links column (GitHub, LinkedIn, Twitter, Email), availability badge.

Seed: 12 projects (mix categories, each with 4-6 gallery images via picsum), 5 experience entries, 6 testimonials, 6 articles, 30+ skills.`,
};
