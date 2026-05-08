import type { Template } from "./types";
import { baseRules } from "./baseRules";

export const ecommerceTemplate: Template = {
  id: "ecommerce",
  emoji: "🛒",
  name: "E-commerce",
  tagline: "Online store with cart & checkout",
  gradient: "from-pink-500 to-rose-500",
  defaultName: "My Shop",
  defaultDescription: "Mobile e-commerce app with product catalog, cart and checkout.",
  starterPrompt: `${baseRules("e-commerce shopping app")}
Screens & routes:
1. /home — search bar, category chips (6+), "Featured" carousel, trending products grid.
2. /category/:id — products grid with sort & filter sheet (price, rating).
3. /product/:id — image gallery, variant selector (size/color), quantity, "Add to cart" + "Buy now".
4. /cart — line items with qty controls, swipe-to-delete, subtotal, promo code input, checkout button.
5. /checkout — address form, payment method radio, order summary, "Place order" → success screen with order id.
6. /orders — list of past orders with status badges, tap → order details.
7. /profile — avatar, stats (orders, wishlist, addresses), settings list, logout.
Seed: 6 categories, 24+ products with images/price/rating, 3 sample past orders.`,
};
