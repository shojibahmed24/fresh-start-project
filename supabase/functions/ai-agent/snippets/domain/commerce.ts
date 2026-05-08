import type { Snippet } from "../types.ts";

export const ECOM_PRODUCT_CARD: Snippet = {
  name: "Product card with wishlist + price",
  why: "Product cards must show image, name, price, AND a heart/wishlist micro-action.",
  uses: ["lucide-react: Heart"],
  code: `function ProductCard({ product, onWishlist, wished }) {
  return (
    <article className="group rounded-2xl bg-card overflow-hidden border border-border/50
      hover:shadow-lg hover:-translate-y-0.5 transition-all">
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        <img src={product.image} alt={product.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <button onClick={() => onWishlist(product.id)}
          className="absolute top-2 right-2 grid h-9 w-9 place-items-center rounded-full
            bg-background/85 backdrop-blur shadow-sm">
          <Heart className={\`h-4 w-4 \${wished ? "fill-rose-500 text-rose-500" : "text-foreground"}\`} />
        </button>
        {product.badge && (
          <span className="absolute top-2 left-2 rounded-full bg-foreground text-background
            px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">{product.badge}</span>
        )}
      </div>
      <div className="p-3">
        <p className="text-xs text-muted-foreground">{product.brand}</p>
        <h3 className="mt-0.5 text-sm font-semibold line-clamp-1">{product.name}</h3>
        <p className="mt-1 text-base font-bold">\${product.price}</p>
      </div>
    </article>
  );
}`,
};

export const FOOD_DISH_CARD: Snippet = {
  name: "Dish card with rating + delivery time",
  why: "Food apps live or die on appetizing imagery + clear rating + ETA.",
  uses: ["lucide-react: Star, Clock"],
  code: `function DishCard({ dish }) {
  return (
    <article className="group flex gap-3 rounded-2xl bg-card p-2.5 border border-border/40
      hover:shadow-md transition">
      <img src={dish.image} alt={dish.name}
        className="h-20 w-20 rounded-xl object-cover" />
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="truncate text-sm font-semibold">{dish.name}</h3>
        <p className="line-clamp-1 text-xs text-muted-foreground">{dish.desc}</p>
        <div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 text-amber-500 font-medium">
            <Star className="h-3 w-3 fill-amber-500" /> {dish.rating}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {dish.eta} min
          </span>
        </div>
      </div>
      <p className="self-start text-sm font-bold">\${dish.price}</p>
    </article>
  );
}`,
};

export const TRAVEL_DESTINATION: Snippet = {
  name: "Destination card with overlay + price",
  why: "Travel/hotel apps demand cinematic full-bleed imagery with price overlaid.",
  uses: ["lucide-react: MapPin, Star"],
  code: `function DestinationCard({ place }) {
  return (
    <article className="group relative aspect-[3/4] overflow-hidden rounded-3xl">
      <img src={place.image} alt={place.name}
        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full
        bg-black/40 backdrop-blur px-2 py-1 text-[11px] text-white">
        <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {place.rating}
      </div>
      <div className="absolute inset-x-3 bottom-3 text-white">
        <p className="inline-flex items-center gap-1 text-[11px] opacity-80">
          <MapPin className="h-3 w-3" /> {place.country}
        </p>
        <h3 className="text-lg font-bold">{place.name}</h3>
        <p className="mt-0.5 text-sm">
          <span className="text-base font-bold">\${place.price}</span>
          <span className="opacity-70"> / night</span>
        </p>
      </div>
    </article>
  );
}`,
};

