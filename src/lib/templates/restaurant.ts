import type { Template } from "./types";
import { baseRules } from "./baseRules";

export const restaurantTemplate: Template = {
  id: "restaurant",
  emoji: "🍽️",
  name: "Restaurant",
  tagline: "Menu, reservations & location",
  gradient: "from-amber-600 to-red-600",
  defaultName: "My Restaurant",
  defaultDescription: "Restaurant website with menu, reservation booking, gallery and location.",
  starterPrompt: `${baseRules("restaurant website with menu + reservation + location")}
Screens & routes:
1. /home — full-bleed hero (signature dish image), restaurant name in display serif, tagline, "Book a table" CTA + "View menu" CTA, hours/address strip, today's specials carousel, philosophy/about teaser, gallery preview grid, footer with map embed.
2. /menu — sticky category tabs (Starters, Mains, Desserts, Drinks, Wine), each section with dish cards (photo, name, description, dietary badges veg/vegan/gluten-free, price, "Add to favorites" heart toggle), search input.
3. /reserve — multi-step form: party size (stepper 1-12), date (calendar picker, next 60 days), time (slot grid with booked slots disabled), guest details (name, phone, email, occasion select, special requests textarea), review summary, confirm → success screen with reservation id + add-to-calendar button.
4. /gallery — masonry image grid (16+ photos: food, interior, chef, events) with lightbox on click + category filter chips.
5. /about — chef story with portrait, philosophy, awards/press logos row, team grid.
6. /contact — large map (placeholder), address card, phone, email, hours table, social links, contact form.
Seed: 5 menu categories with 5-8 dishes each (real food names + descriptions + prices), 16 gallery images via picsum, 4 team members.
Reservations persist in localStorage so /my-reservations shows them.`,
};
