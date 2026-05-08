import type { Template } from "./types";
import { baseRules } from "./baseRules";

export const bookingTemplate: Template = {
  id: "booking",
  emoji: "📅",
  name: "Booking",
  tagline: "Appointment & reservation",
  gradient: "from-violet-500 to-indigo-600",
  defaultName: "My Booking App",
  defaultDescription: "Mobile booking / appointment app with providers and date/time selection.",
  starterPrompt: `${baseRules("booking / appointment app")}
Screens & routes:
1. /home — search, service categories (6+), "Top rated providers" carousel, nearby providers list.
2. /providers — filter sheet (rating, distance, price), sortable list with rating + price + distance.
3. /provider/:id — header (cover + avatar), about, services list (name + duration + price), reviews, "Book" CTA.
4. /book/:providerId — service selector, horizontal date strip (next 14 days), time slots grid (booked slots disabled), notes input, confirm → success screen.
5. /bookings — tabs (Upcoming / Past), cards with cancel/reschedule actions.
6. /profile — saved providers, payment methods, notification settings.
Seed: 6 categories, 12+ providers each with 4 services and 5+ reviews.`,
};
