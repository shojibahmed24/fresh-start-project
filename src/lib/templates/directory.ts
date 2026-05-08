import type { Template } from "./types";

export const directoryTemplate: Template = {
  id: "directory",
  emoji: "🗂️",
  name: "Directory / Marketplace",
  tagline: "Listings, filters, detail & submit",
  gradient: "from-teal-500 to-emerald-600",
  defaultName: "My Directory",
  defaultDescription: "Directory / marketplace site with listings, filters, detail page and submit form.",
  starterPrompt: `Build a COMPLETE, fully working DESKTOP-FIRST directory / marketplace site (think Product Hunt × Yelp × G2). Requirements:
- react-router-dom routes: /, /browse, /listing/:id, /submit, /category/:slug, /collections.
- Custom design system in index.css + tailwind.config.ts (HSL tokens, friendly modern — bold accent + clean neutrals, light mode primary with dark toggle). framer-motion for card hovers, filter sidebar slide, upvote burst animation. shadcn/ui + lucide-react + tailwind only.
- Every search input, filter checkbox, sort dropdown, upvote button (animated count + persisted in localStorage), bookmark, pagination, submit form (react-hook-form + zod validation, multi-step), theme toggle MUST work.

📁 **MODULAR FILE RULE (STRICT):**
- No file > 300 lines (target 150-220).
- \`src/components/directory/\`: SiteNav, HeroSearch, CategoryGrid, FeaturedCollection, TrendingRail, ListingCard, ListingGrid, FiltersSidebar, FilterGroup, SortBar, ListingHero, ListingGallery, ListingMeta, ListingTabs, ReviewCard, RelatedListings, SubmitStepNav, SubmitStepBasics, SubmitStepDetails, SubmitStepMedia, SubmitStepReview, SiteFooter.
- \`src/pages/Browse.tsx\` < 130 lines (sidebar + grid layout).
- \`src/store/directoryStore.ts\` (zustand + persist) — upvotes, bookmarks, mySubmissions, toggleUpvote, toggleBookmark, addSubmission.
- \`src/data/{listings,categories,collections,reviews}.ts\`.

Pages:
1. **/** — SiteNav (logo, Browse / Collections / Submit links, search bar with category select prefix, theme toggle, "Submit listing" gradient CTA); HeroSearch (huge headline "Discover the best [things]", big search with autosuggest dropdown, popular tag chips); CategoryGrid (12 cards with icon + listing count + accent color); FeaturedCollection (curated row "Editor's picks"); TrendingRail ("Trending this week" — horizontal scroll of 8 ListingCards with rank badge); recent additions grid; newsletter CTA; footer.
2. **/browse** — left FiltersSidebar (sticky, collapsible on mobile): FilterGroup sections (Category checklist, Price tier chips, Rating slider 1-5, Tags multi-select chips, Location select, "Verified only" switch). Top SortBar (results count + sort: Trending / Newest / Top rated / Price asc / Price desc + view toggle Grid/List). ListingGrid of 24+ ListingCards (logo/cover, title, tagline, category badge, rating + review count, price/Free, upvote button with count, bookmark icon, tag chips). Pagination at bottom.
3. **/listing/:id** — ListingHero (large cover + logo + title + tagline + meta row: rating, upvotes, category, location, verified badge); right sticky action card (price, "Visit website" CTA, upvote big, bookmark, share, claim listing); ListingGallery (4-6 screenshots with lightbox); ListingTabs (Overview / Features / Pricing / Reviews / Q&A). Reviews tab: rating distribution chart + filter (5★ → 1★) + ReviewCards (avatar, rating, date, title, body, helpful toggle) + "Write review" form. RelatedListings row at bottom.
4. **/submit** — 4-step wizard with SubmitStepNav (Basics / Details / Media / Review): Step 1 name, tagline, category select, website url; Step 2 description rich textarea, pricing model radio, tags chips input; Step 3 logo upload preview, screenshots upload (3-6, drag-and-drop), video URL; Step 4 read-only summary + terms checkbox + Submit (saves to localStorage as pending submission, success screen with submission id).
5. **/category/:slug** — same as /browse but pre-filtered, with category hero banner.
6. **/collections** — list of curated collections (cover image, title, count, "View all" → filtered browse).

Seed: 12 categories, 60 listings (varied: cover image, logo via dicebear, 4-6 screenshots via picsum, tags, prices, ratings 3.5-5.0, review counts), 8 collections, 5-15 reviews per listing.`,
};
