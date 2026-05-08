import type { Template } from "./types";
import { baseRules } from "./baseRules";

export const foodTemplate: Template = {
  id: "food",
  emoji: "🍔",
  name: "Food Delivery",
  tagline: "Foodpanda-style ordering",
  gradient: "from-amber-500 to-orange-600",
  defaultName: "My Food App",
  defaultDescription: "Foodpanda-style mobile food delivery app with restaurants and menus.",
  starterPrompt: `${baseRules("Foodpanda-style food delivery app")}
Screens & routes:
1. /home — location bar, search, cuisine chips (8+), "Top rated" carousel, restaurants list with rating/eta/delivery fee.
2. /restaurant/:id — banner, info, menu grouped by section (Starters, Mains, Drinks, Desserts), each item has add-to-cart with qty.
3. /cart — items grouped by restaurant, quantity controls, delivery fee, subtotal, "Checkout".
4. /checkout — address selector, payment method, delivery instructions, place order.
5. /track/:orderId — animated stepper (Confirmed → Preparing → Out for delivery → Delivered), live ETA, courier card.
6. /orders — past orders list, reorder button.
7. /profile — addresses, payment methods, favorites, settings.
Seed: 12 restaurants each with 10+ menu items across 3 sections.`,
};
