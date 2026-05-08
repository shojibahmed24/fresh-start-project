import type { Snippet } from "../types.ts";

export const NEWS_HEADLINE: Snippet = {
  name: "Editorial news card (image + meta + title)",
  why: "News apps need editorial typography hierarchy + category tag + read-time.",
  uses: ["lucide-react: Clock"],
  code: `function NewsCard({ article }) {
  return (
    <article className="group grid grid-cols-[1fr_88px] gap-3 py-3 border-b border-border/50">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-primary">{article.category}</p>
        <h3 className="mt-1 text-base font-bold leading-snug line-clamp-3 group-hover:underline">
          {article.title}
        </h3>
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" /> {article.readMin} min · {article.source}
        </p>
      </div>
      <img src={article.image} alt="" className="h-22 w-22 rounded-xl object-cover" />
    </article>
  );
}`,
};

export const WEATHER_HERO: Snippet = {
  name: "Weather hero with temperature + condition",
  why: "Weather apps need a giant temperature, location, and an evocative gradient matching the condition.",
  uses: ["lucide-react: Sun, Cloud, MapPin"],
  code: `function WeatherHero({ city, temp, condition, high, low }) {
  return (
    <section className="relative overflow-hidden rounded-3xl p-6 text-white
      bg-gradient-to-br from-sky-400 via-sky-500 to-indigo-600
      shadow-[0_20px_60px_-20px_rgba(56,189,248,0.5)]">
      <div className="flex items-center gap-1 text-sm opacity-90">
        <MapPin className="h-3.5 w-3.5" /> {city}
      </div>
      <div className="mt-3 flex items-end gap-3">
        <p className="text-7xl font-thin leading-none tabular-nums">{temp}°</p>
        <Sun className="mb-2 h-10 w-10 opacity-90" />
      </div>
      <p className="mt-1 text-base font-medium">{condition}</p>
      <p className="mt-1 text-sm opacity-80">H:{high}°  L:{low}°</p>
    </section>
  );
}`,
};

export const PORTFOLIO_PROJECT: Snippet = {
  name: "Portfolio project tile with hover reveal",
  why: "Portfolio sites need editorial project tiles — image + title slides up on hover.",
  uses: ["lucide-react: ArrowUpRight"],
  code: `function ProjectTile({ project }) {
  return (
    <a href={project.url} className="group relative block aspect-[4/3] overflow-hidden rounded-2xl">
      <img src={project.image} alt={project.title}
        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent
        opacity-90 group-hover:opacity-100" />
      <div className="absolute inset-x-5 bottom-5 text-white">
        <p className="text-[11px] uppercase tracking-[0.2em] opacity-80">{project.category}</p>
        <h3 className="mt-1 text-xl font-bold">{project.title}</h3>
        <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium opacity-0
          translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition">
          View case study <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
    </a>
  );
}`,
};

