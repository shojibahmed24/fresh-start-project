import type { Template } from "./types";
import { baseRules } from "./baseRules";

export const blogTemplate: Template = {
  id: "blog",
  emoji: "📚",
  name: "Blog / News",
  tagline: "Medium-style article reader",
  gradient: "from-cyan-500 to-blue-600",
  defaultName: "My Blog",
  defaultDescription: "Medium-style mobile blog / news reader app with articles and categories.",
  starterPrompt: `${baseRules("Medium-style blog / news reader app")}
Screens & routes:
1. /home — featured hero article, category chips (6+), "For you" article list (cover, title, author, read time, claps).
2. /category/:id — articles list filtered by category.
3. /article/:id — hero image, title, author row (avatar + follow), reading-time, beautifully typeset body (h2, p, blockquote, code), clap button (animates count), bookmark, share.
4. /bookmarks — saved articles list, swipe to remove.
5. /search — search input, recent searches, results list.
6. /profile — avatar, bio, stats (articles read, bookmarks), reading history, settings.
Seed: 6 categories, 18+ articles each with 4–6 paragraphs of realistic body text.`,
};
