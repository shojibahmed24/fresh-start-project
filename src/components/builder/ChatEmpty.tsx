import { useMemo } from "react";
import { m } from "framer-motion";
import {
  Sparkles,
  CheckSquare,
  MessageCircle,
  ShoppingCart,
  Music,
  Camera,
  BookOpen,
  Calendar,
  Dumbbell,
  Wallet,
  Utensils,
  Map,
  Cloud,
  Gamepad2,
  Heart,
  Plane,
  Newspaper,
  Briefcase,
  Film,
  Mic,
} from "lucide-react";
import { cn } from "@/lib/utils";
import logoMark from "@/assets/oneclick-mark.webp";

type Suggestion = {
  label: string;
  prompt: string;
  icon: typeof Sparkles;
};

// Pool of "build a new app" style quick-start ideas. We pick 3 randomly per mount.
const QUICK_POOL: Suggestion[] = [
  { label: "Todo app", prompt: "Build a beautiful todo app with categories, due dates, and dark mode.", icon: CheckSquare },
  { label: "Chat app", prompt: "Build a real-time chat app UI with conversations list, message thread, and input.", icon: MessageCircle },
  { label: "E-commerce", prompt: "Build an e-commerce product page with image gallery, variants, reviews, and add-to-cart.", icon: ShoppingCart },
  { label: "Music player", prompt: "Build a music player app with library, playlists, now-playing screen, and controls.", icon: Music },
  { label: "Photo gallery", prompt: "Build a photo gallery app with albums, grid view, and a fullscreen lightbox.", icon: Camera },
  { label: "Recipe app", prompt: "Build a recipe app with categories, recipe details, ingredients, and steps.", icon: Utensils },
  { label: "Notes app", prompt: "Build a notes app with folders, search, and a clean writing experience.", icon: BookOpen },
  { label: "Calendar app", prompt: "Build a calendar app with month view, event creation, and reminders.", icon: Calendar },
  { label: "Fitness tracker", prompt: "Build a fitness tracker with workouts, progress charts, and a streak system.", icon: Dumbbell },
  { label: "Expense tracker", prompt: "Build an expense tracker with categories, monthly summary, and a balance card.", icon: Wallet },
  { label: "Travel planner", prompt: "Build a travel planner with destinations, itineraries, and a packing checklist.", icon: Plane },
  { label: "Weather app", prompt: "Build a weather app with current conditions, hourly forecast, and a 7-day outlook.", icon: Cloud },
  { label: "News reader", prompt: "Build a news reader app with categories, article view, and bookmarks.", icon: Newspaper },
  { label: "Dating app", prompt: "Build a dating app with swipe cards, matches list, and chat.", icon: Heart },
  { label: "Game hub", prompt: "Build a casual game hub with multiple mini-games and a leaderboard.", icon: Gamepad2 },
  { label: "Maps explorer", prompt: "Build a map-based explorer app with categories, place details, and saved spots.", icon: Map },
  { label: "Job board", prompt: "Build a job board app with listings, filters, and saved jobs.", icon: Briefcase },
  { label: "Movie tracker", prompt: "Build a movie tracker app with watchlist, ratings, and recommendations.", icon: Film },
  { label: "Podcast app", prompt: "Build a podcast app with shows, episodes, and a mini-player.", icon: Mic },
];

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

type Props = {
  onSelect: (prompt: string) => void;
};

export const ChatEmpty = ({ onSelect }: Props) => {
  // Pick 3 fresh quick-start ideas each time the empty state mounts (i.e. project reload / new chat).
  const quickActions = useMemo(() => pickRandom(QUICK_POOL, 3), []);

  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col items-center text-center px-5 pt-10 md:pt-12 pb-6"
    >
      {/* Hero icon — OneClick brand mark with glow */}
      <div className="relative mb-5">
        <div className="absolute inset-0 bg-primary/40 blur-2xl rounded-full animate-pulse" />
        <img
          src={logoMark}
          alt="OneClick Studio"
          className="relative size-16 rounded-full object-contain drop-shadow-[0_4px_20px_hsl(var(--primary)/0.5)]"
        />
      </div>

      {/* Headline */}
      <h2 className="text-[22px] font-semibold tracking-[-0.015em] text-foreground mb-1.5">
        What should we build?
      </h2>
      <p className="text-[13.5px] text-[hsl(var(--foreground-muted))] max-w-[300px] leading-relaxed">
        Tap a starter, type your idea, or use{" "}
        <span className="text-primary font-medium">🎤 voice input</span>.
      </p>

      {/* ─── Quick start: 3 randomized "build a new app" ideas ─── */}
      <div className="mt-7 w-full max-w-[460px]">
        <div className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-[hsl(var(--foreground-subtle))] mb-2.5 text-left">
          ⚡ Quick start
        </div>
        <div className="grid grid-cols-3 gap-2">
          {quickActions.map((s, i) => {
            const Icon = s.icon;
            return (
              <m.button
                key={s.label}
                initial={{ opacity: 0, scale: 0.92, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{
                  duration: 0.28,
                  delay: 0.12 + i * 0.04,
                  ease: [0.4, 0, 0.2, 1],
                }}
                whileTap={{ scale: 0.94 }}
                onClick={() => onSelect(s.prompt)}
                className={cn(
                  "group flex flex-col items-center justify-center gap-1.5",
                  "px-2 py-3 min-h-[72px] rounded-xl",
                  "bg-[hsl(var(--bg-muted))] border border-[hsl(0_0%_100%/0.08)]",
                  "text-[11.5px] font-medium text-foreground",
                  "transition-colors duration-200",
                  "hover:bg-primary/10 hover:border-primary/40",
                  "active:bg-primary/15",
                )}
                aria-label={`Quick start: ${s.label}`}
              >
                <div className="size-8 rounded-lg bg-gradient-primary-soft border border-primary/20 flex items-center justify-center group-hover:border-primary/40 group-active:scale-95 transition-transform">
                  <Icon size={15} className="text-primary" />
                </div>
                <span className="leading-tight">{s.label}</span>
              </m.button>
            );
          })}
        </div>
      </div>
    </m.div>
  );
};
