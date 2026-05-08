import type { Template } from "./types";

export const eventTemplate: Template = {
  id: "event",
  emoji: "🎤",
  name: "Event / Conference",
  tagline: "Schedule, speakers & tickets",
  gradient: "from-sky-500 to-indigo-600",
  defaultName: "My Conference",
  defaultDescription: "Conference / event website with schedule, speakers, tickets and venue info.",
  starterPrompt: `Build a COMPLETE, fully working DESKTOP-FIRST conference / event landing site. Bold editorial energy — should feel like a flagship tech conference, not a generic event page. Requirements:
- react-router-dom routes: /, /schedule, /speakers, /speaker/:id, /tickets, /venue, /sponsors.
- Custom design system in index.css + tailwind.config.ts (HSL tokens — bold gradient brand, dark mode default, sharp typography). framer-motion for hero countdown, scroll reveals, ticket card hover lifts. shadcn/ui + lucide-react + tailwind only.
- Every nav link, schedule day tab, ticket tier CTA, speaker card, ticket quantity stepper, theme toggle MUST work.

📁 **MODULAR FILE RULE (STRICT):**
- No file > 300 lines (target 150-220).
- \`src/components/event/\`: SiteNav, HeroCountdown, EventHighlights, FeaturedSpeakers, ScheduleDayTabs, ScheduleTrackColumn, SessionCard, TicketTier, VenueCard, SponsorGrid, FaqAccordion, SiteFooter.
- \`src/pages/Home.tsx\` < 100 lines, just composes.
- \`src/data/{schedule,speakers,tickets,sponsors,venue,faqs}.ts\`.

Pages:
1. **/** — SiteNav (sticky, logo + Schedule/Speakers/Tickets/Venue links + theme toggle + "Get tickets" gradient CTA); HeroCountdown (huge event title with gradient, date + city, live countdown DDD:HH:MM:SS to event start, dual CTAs, trust row "1500+ attendees · 80+ talks · 3 days"); EventHighlights (4 stat cards: speakers, sessions, workshops, networking); FeaturedSpeakers (6 large speaker cards with photo + name + role + company); schedule preview (1 day teaser + "View full schedule"); SponsorGrid (tiered: Diamond 2 / Gold 4 / Silver 6 / Community 8); testimonials from past attendees; FaqAccordion; SiteFooter with newsletter signup.
2. **/schedule** — day tabs (Day 1 / 2 / 3), each day shows 3-track grid (Main Stage / Workshop / Lightning) with time-blocked SessionCards (time, title, speaker avatar+name, room, tags, bookmark heart toggle persisted in localStorage). "My Agenda" filter chip shows only bookmarked sessions.
3. **/speakers** — search input + filter chips (track), grid of 24+ speaker cards with photo, name, company logo, talk title.
4. **/speaker/:id** — hero (large portrait + name + role + bio), social links, sessions list with date/time/room.
5. **/tickets** — 4 tier cards (Early Bird sold-out badge, Standard, VIP highlighted with ring, Student) — each with price, perks checklist (icons), quantity stepper, "Add to cart" → cart drawer with running total + checkout flow (form + payment radio + confirm → success with QR code mock).
6. **/venue** — map placeholder, address card, getting-there sections (Plane / Train / Car) with icons, nearby hotels grid (3 partner hotels with discount codes).
7. **/sponsors** — tiered grid by sponsorship level + "Become a sponsor" CTA.

Seed: 3 days × 3 tracks × 6-8 sessions each, 24 speakers, 4 ticket tiers, 20 sponsors across 4 tiers, 3 hotels, 8 FAQs.`,
};
