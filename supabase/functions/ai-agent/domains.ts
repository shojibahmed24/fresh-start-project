// ═══════════════════════════════════════════════════════════════════════════
// Domain Template Registry — 40+ app archetypes
// ─────────────────────────────────────────────────────────────────────────────
// Each entry encodes:
//   - keywords  : phrases that strongly imply this domain (lowercased match)
//   - dna       : visual direction the agent should adopt
//   - palette   : Tailwind palette suggestion (background + accent)
//   - signature : the HERO interaction pattern this app revolves around
//   - mustHave  : concrete UI elements this build MUST include
//   - components: suggested component file names
//
// matchDomain(prompt) → returns the best entry, or "generic" fallback.
// First pass = pure keyword scoring (fast, free).
// If scores are tied or weak, caller may run an LLM classifier (hybrid).
// ═══════════════════════════════════════════════════════════════════════════

export interface DomainTemplate {
  id: string;
  label: string;
  keywords: string[];
  archetype: string;
  dna: string;
  palette: string;
  signature: string;
  mustHave: string[];
  components: string[];
}

export const DOMAINS: DomainTemplate[] = [
  // ── Media / Audio / Video ─────────────────────────────────────────────
  {
    id: "podcast",
    label: "Podcast / Audio show app",
    keywords: ["podcast", "audio show", "rss feed", "episodes", "listen to shows", "audiobook"],
    archetype: "media-player",
    dna: "Dark moody background, vibrant accent, glassy cards, large cover art, subtle waveform decorations",
    palette: "bg-slate-950 + from-violet-600 via-fuchsia-600 to-orange-500 accent",
    signature: "Persistent mini-player at bottom (cover + title + scrub bar + play/skip) that expands to full Now Playing screen",
    mustHave: ["NowPlaying hero card with cover art + progress", "Sticky animated mini-player", "Horizontal show carousels with cover images", "Episode rows with duration + date + play button", "Category pills"],
    components: ["MiniPlayer", "NowPlayingHero", "ShowCarousel", "EpisodeRow", "CategoryPills", "ProgressScrubber"],
  },
  {
    id: "music",
    label: "Music streaming app (Spotify-like)",
    keywords: ["music", "spotify", "song", "playlist", "album", "artist", "streaming music"],
    archetype: "media-player",
    dna: "Dark with bold neon accent, album-art-driven layouts, gradient overlays on cards",
    palette: "bg-zinc-950 + from-emerald-500 via-teal-500 to-cyan-500 accent",
    signature: "Album-art-led grid + persistent mini-player + Now Playing with lyrics/queue",
    mustHave: ["Featured playlist hero", "Album/playlist grid with cover images", "Recently played row", "Sticky mini-player with cover, title, artist, scrub", "Like/heart toggle"],
    components: ["MiniPlayer", "AlbumGrid", "PlaylistCard", "TrackRow", "NowPlaying", "QueueDrawer"],
  },
  {
    id: "video",
    label: "Video streaming / Netflix-like",
    keywords: ["video streaming", "netflix", "movie app", "tv show", "watch movies", "film library"],
    archetype: "media-browse",
    dna: "Cinematic dark, full-bleed hero poster, horizontal swipeable rails, soft gradients on poster bottoms",
    palette: "bg-black + from-red-600 to-rose-700 accent",
    signature: "Full-bleed featured hero + horizontal genre rails of poster cards + detail sheet with synopsis",
    mustHave: ["Featured hero with backdrop + play/info CTA", "Multiple horizontal poster rails by genre", "Continue Watching row with progress bar overlay", "Top 10 ranked row", "Detail bottom sheet"],
    components: ["FeaturedHero", "PosterRail", "PosterCard", "ContinueWatchingRow", "DetailSheet", "GenrePills"],
  },
  {
    id: "shortvideo",
    label: "Short video / TikTok-like",
    keywords: ["tiktok", "short video", "reels", "vertical video", "shorts"],
    archetype: "fullscreen-feed",
    dna: "Full-bleed black, overlay UI on video, vertical snap-scroll feel",
    palette: "bg-black + white text + from-pink-500 to-rose-500 accent for like",
    signature: "Vertical full-screen video card with side action stack (like, comment, share) + bottom caption",
    mustHave: ["Full-bleed video card", "Side action stack with counts", "Bottom author + caption + sound row", "Top tabs (For You / Following)", "Bottom nav with center create button"],
    components: ["VideoCard", "ActionStack", "AuthorRow", "TopTabs", "CreateButton", "SoundChip"],
  },

  // ── Commerce ──────────────────────────────────────────────────────────
  {
    id: "ecommerce",
    label: "E-commerce / online shop",
    keywords: ["shop", "store", "ecommerce", "products", "buy", "online store", "marketplace"],
    archetype: "product-grid",
    dna: "Clean premium light or warm cream background, product imagery first, refined typography, depth via soft shadows",
    palette: "bg-stone-50 + from-amber-500 to-orange-600 accent (or dark luxe with gold)",
    signature: "Rich product cards in 2-col grid + persistent floating cart bar + product detail with image gallery",
    mustHave: ["Hero promo banner with CTA", "Category chips scroller", "2-col product grid with imagery + price + rating", "Floating cart bar with item count and total", "Wishlist heart toggle"],
    components: ["PromoHero", "CategoryChips", "ProductCard", "CartBar", "WishlistButton", "PriceTag", "RatingStars"],
  },
  {
    id: "marketplace",
    label: "Peer marketplace (Etsy / Depop)",
    keywords: ["marketplace", "second hand", "vintage shop", "etsy", "depop", "resell"],
    archetype: "product-grid",
    dna: "Editorial soft palette, character-rich, seller-forward, masonry feel",
    palette: "bg-rose-50 + from-fuchsia-500 to-pink-500 accent",
    signature: "Masonry product grid + seller mini-card + chat with seller CTA",
    mustHave: ["Search with filter chips", "Masonry product grid", "Product detail with seller card + reviews", "Message seller button", "Saved/Liked tab"],
    components: ["SearchHeader", "FilterChips", "MasonryGrid", "ProductCard", "SellerMiniCard", "MessageButton"],
  },
  {
    id: "food-delivery",
    label: "Food delivery (Uber Eats / DoorDash)",
    keywords: ["food delivery", "order food", "uber eats", "doordash", "restaurants nearby"],
    archetype: "discover-feed",
    dna: "Appetizing warm palette, big food photography, rounded chunky cards",
    palette: "bg-orange-50 + from-orange-500 to-red-500 accent",
    signature: "Address bar + cuisine pills + restaurant cards + persistent cart bar with checkout",
    mustHave: ["Top address bar with switch", "Cuisine category scroller with icons", "Featured restaurant rail", "Restaurant card with image + rating + ETA + delivery fee", "Sticky cart checkout bar"],
    components: ["AddressBar", "CuisineScroller", "RestaurantCard", "FeaturedRail", "CartCheckoutBar", "ETABadge"],
  },
  {
    id: "restaurant-menu",
    label: "Restaurant menu / ordering",
    keywords: ["restaurant menu", "digital menu", "qr menu", "order from menu"],
    archetype: "menu-list",
    dna: "Refined warm cream background, food photography hero, elegant serif accents",
    palette: "bg-amber-50 + from-amber-700 to-orange-800 accent",
    signature: "Sticky category nav + dish cards with image + price + add button → cart bar",
    mustHave: ["Restaurant hero with logo + hours", "Sticky horizontal category nav", "Dish cards with image, description, price, +add", "Floating cart with subtotal + checkout"],
    components: ["RestaurantHero", "CategoryNav", "DishCard", "AddToCartButton", "CartBar", "TagBadge"],
  },
  {
    id: "recipe",
    label: "Recipe app",
    keywords: ["recipe", "cooking", "cook", "kitchen", "ingredients", "meal plan"],
    archetype: "media-browse",
    dna: "Warm appetizing palette, food photography hero, friendly serif headlines",
    palette: "bg-amber-50 + from-rose-500 to-orange-500 accent",
    signature: "Recipe cards with hero image + cook time → detail with ingredients + step-by-step",
    mustHave: ["Search with cuisine pills", "Featured recipe carousel", "Recipe card with image + time + difficulty", "Detail with ingredients checklist + numbered steps", "Save/bookmark"],
    components: ["RecipeCard", "RecipeHero", "IngredientList", "StepCard", "TimerWidget", "BookmarkButton"],
  },

  // ── Health / Fitness ──────────────────────────────────────────────────
  {
    id: "fitness",
    label: "Fitness / workout tracker",
    keywords: ["fitness", "workout", "gym", "exercise", "training", "reps"],
    archetype: "stats-dashboard",
    dna: "Energetic bold gradients, athletic geometry, oversized numbers, dark with neon",
    palette: "bg-zinc-950 + from-lime-400 via-emerald-500 to-cyan-500 accent",
    signature: "Big stat hero + animated progress rings + workout cards with imagery → start session button",
    mustHave: ["Today's stats hero (calories/steps/workouts)", "Animated progress rings or bars", "Workout plan cards with imagery + duration + difficulty", "Start workout floating CTA", "Streak / week strip"],
    components: ["StatsHero", "ProgressRing", "WorkoutCard", "StartCTA", "WeekStrip", "ExerciseRow"],
  },
  {
    id: "running",
    label: "Running / activity tracker",
    keywords: ["running app", "run tracker", "strava", "jogging", "marathon"],
    archetype: "stats-dashboard",
    dna: "Energetic, map-forward, performance metrics big and proud",
    palette: "bg-slate-950 + from-orange-500 to-rose-600 accent",
    signature: "Big numeric stats + map preview of last run + history list + Start Run CTA",
    mustHave: ["Big distance/pace/time stats", "Map snapshot of last route", "History list with mini-charts", "Floating Start Run button", "Achievement badges row"],
    components: ["StatsBlock", "RouteMapPreview", "RunHistoryRow", "StartRunButton", "BadgeRow", "PaceChart"],
  },
  {
    id: "meditation",
    label: "Meditation / mindfulness",
    keywords: ["meditation", "mindfulness", "calm app", "headspace", "breathe"],
    archetype: "media-browse",
    dna: "Calm gradients, soft pastels, breathing animation, generous whitespace",
    palette: "bg-gradient-to-br from-indigo-950 via-purple-900 to-rose-900 + soft white",
    signature: "Daily session hero + session library cards + persistent breathing-circle player",
    mustHave: ["Daily meditation hero card", "Categorized session grid (Sleep/Focus/Calm)", "Animated breathing circle on player", "Streak indicator", "Soothing background gradient"],
    components: ["DailyHero", "SessionCard", "BreathingCircle", "StreakBadge", "CategorySection", "AmbientPlayer"],
  },
  {
    id: "sleep",
    label: "Sleep tracker",
    keywords: ["sleep tracker", "sleep app", "bedtime", "sleep score"],
    archetype: "stats-dashboard",
    dna: "Deep night palette, soft glow accents, dreamy gradients",
    palette: "bg-indigo-950 + from-violet-500 to-blue-500 accent with glow",
    signature: "Last-night sleep score arc + stage chart + sleep history + bedtime reminder",
    mustHave: ["Big circular sleep score with arc", "Sleep stages chart", "7-day history bars", "Bedtime + alarm setter", "Insight cards"],
    components: ["SleepScoreArc", "StagesChart", "WeeklyBars", "BedtimeSetter", "InsightCard"],
  },
  {
    id: "habit",
    label: "Habit tracker",
    keywords: ["habit tracker", "daily habit", "streak", "build habits"],
    archetype: "checklist",
    dna: "Friendly playful, satisfying tap states, color-per-habit",
    palette: "bg-stone-50 + per-habit accents (emerald, amber, sky, rose)",
    signature: "Today's habits checklist with satisfying tick → streak grid (heatmap) per habit",
    mustHave: ["Today's habits with big tap targets", "Streak heatmap grid per habit", "+Add habit floating button", "Stats summary header", "Color-coded categories"],
    components: ["HabitRow", "StreakHeatmap", "AddHabitButton", "StatsHeader", "CompletionAnimation"],
  },

  // ── Productivity ──────────────────────────────────────────────────────
  {
    id: "todo",
    label: "Todo / task manager",
    keywords: ["todo", "task manager", "to-do", "task list", "things to do"],
    archetype: "checklist",
    dna: "Clean confident, generous spacing, satisfying completion micro-interactions",
    palette: "bg-white + from-indigo-500 to-violet-600 accent (or dark Linear-style)",
    signature: "Grouped lists (Today / Upcoming / Done) + quick-add input + swipe to complete",
    mustHave: ["Quick-add task input fixed at top or bottom", "Section groups (Today / Upcoming)", "Task row with checkbox + title + due chip", "Filter / view tabs", "Strike-through animation on complete"],
    components: ["QuickAddInput", "TaskRow", "SectionHeader", "DueChip", "FilterTabs", "EmptyState"],
  },
  {
    id: "notes",
    label: "Note-taking app",
    keywords: ["notes app", "note taking", "scratchpad", "journal app", "memo"],
    archetype: "list-detail",
    dna: "Editorial calm, paper-like, generous typography, soft shadows on note cards",
    palette: "bg-stone-50 + from-amber-600 to-rose-500 accent OR dark with cream text",
    signature: "Masonry/grid of note cards with title + preview + tag → editor view",
    mustHave: ["Search bar + tag chips", "Masonry grid of note cards with color tags", "FAB to create new note", "Note detail with markdown-ish styling", "Pin / archive actions"],
    components: ["NoteCard", "NoteEditor", "TagChips", "SearchBar", "FAB", "PinToggle"],
  },
  {
    id: "kanban",
    label: "Kanban / project board (Trello-like)",
    keywords: ["kanban", "trello", "board", "project board", "drag cards"],
    archetype: "board",
    dna: "Crisp confident, distinct column colors, draggable card affordances",
    palette: "bg-slate-100 + per-column accent (sky/amber/emerald/rose)",
    signature: "Horizontally scrolling columns of cards + add-card per column + card detail sheet",
    mustHave: ["Horizontal scrolling columns (To Do / Doing / Done)", "Card with title + label dots + assignee avatar + due", "Add card button per column", "Card detail bottom sheet", "Filter by label"],
    components: ["BoardColumn", "TaskCard", "AddCardButton", "CardDetailSheet", "LabelDots", "AssigneeAvatar"],
  },
  {
    id: "calendar",
    label: "Calendar / scheduling",
    keywords: ["calendar app", "schedule", "events calendar", "agenda"],
    archetype: "calendar",
    dna: "Clean structured, accent-colored events, today emphasis",
    palette: "bg-white + from-blue-500 to-indigo-600 accent",
    signature: "Month/week view at top + agenda list of upcoming events below + FAB to add",
    mustHave: ["Month or week strip with today highlighted", "Agenda list grouped by day", "Event card with color stripe + time + title", "FAB add event", "Event detail sheet"],
    components: ["MonthGrid", "WeekStrip", "AgendaList", "EventCard", "AddEventFAB", "EventDetailSheet"],
  },

  // ── Social / Communication ────────────────────────────────────────────
  {
    id: "social-feed",
    label: "Social feed (Instagram / Twitter-like)",
    keywords: ["social media", "social feed", "instagram", "twitter", "posts feed"],
    archetype: "vertical-feed",
    dna: "Content-first, edge-to-edge media, refined typography for captions",
    palette: "bg-white + from-pink-500 via-rose-500 to-orange-500 OR dark mode",
    signature: "Vertical scroll of rich post cards + composer entry + stories rail at top",
    mustHave: ["Top header with logo + DM icon", "Stories ring rail", "Post cards (avatar+name, image, action row, caption, comments preview)", "Bottom nav with center +", "Like/comment/share with count animations"],
    components: ["StoriesRail", "PostCard", "ActionRow", "Composer", "BottomNav", "CommentPreview"],
  },
  {
    id: "chat",
    label: "Chat / messaging",
    keywords: ["chat app", "messaging", "messenger", "whatsapp", "dm app"],
    archetype: "list-detail-thread",
    dna: "Friendly clean, contrast-rich bubbles, presence dots, unread emphasis",
    palette: "bg-white + from-blue-500 to-indigo-600 accent OR Telegram-like",
    signature: "Conversation list → thread view with bubbles → composer with send animation",
    mustHave: ["Conversation list with avatar + last msg + unread badge + time", "Thread view with left/right bubbles + timestamps", "Composer with attach + emoji + send", "Online/typing indicator", "Search header"],
    components: ["ConversationRow", "MessageBubble", "Composer", "TypingIndicator", "OnlineDot", "SearchHeader"],
  },
  {
    id: "dating",
    label: "Dating app (Tinder-like)",
    keywords: ["dating", "tinder", "bumble", "match", "swipe profile"],
    archetype: "swipe-deck",
    dna: "Bold playful gradients, large profile photos, expressive action buttons",
    palette: "bg-rose-50 + from-pink-500 via-fuchsia-500 to-rose-500 accent",
    signature: "Stacked swipeable profile cards + like/nope/super-like action row + match modal",
    mustHave: ["Stacked profile card with photo + name/age + bio snippet + interests chips", "Bottom action row (rewind/nope/super/like/boost) with distinct colors", "Match celebration overlay", "Top tabs (Discover / Matches / Chats)", "Profile detail expand"],
    components: ["ProfileCard", "ActionRow", "MatchModal", "InterestChips", "TopTabs", "PhotoCarousel"],
  },
  {
    id: "community",
    label: "Community / forum (Reddit-like)",
    keywords: ["forum", "community app", "reddit", "discussion board"],
    archetype: "vertical-feed",
    dna: "Information-dense but readable, group-color accents, vote-prominent",
    palette: "bg-stone-50 + from-orange-500 to-red-500 accent",
    signature: "Sub-community pills + post feed with vote stack + comment threads",
    mustHave: ["Community pills row", "Post card with vote arrows + thumbnail + title + meta", "Sort tabs (Hot/New/Top)", "Comment thread with nested replies", "Compose post FAB"],
    components: ["CommunityPills", "PostCard", "VoteStack", "SortTabs", "CommentThread", "ComposeFAB"],
  },

  // ── Finance ───────────────────────────────────────────────────────────
  {
    id: "banking",
    label: "Banking / digital bank",
    keywords: ["bank app", "banking", "digital bank", "neobank", "revolut", "monzo"],
    archetype: "stats-dashboard",
    dna: "Confident premium dark or stark light, big balance, gradient account cards, refined numerals",
    palette: "bg-zinc-950 + from-emerald-400 to-teal-500 accent (or premium light)",
    signature: "Big balance hero + horizontal account cards + recent transactions list with category icons",
    mustHave: ["Balance hero with hide/show", "Quick action row (Send / Receive / Top-up / Pay)", "Horizontal account cards with gradient", "Recent transactions list with icon + merchant + amount", "Spending breakdown chart"],
    components: ["BalanceHero", "QuickActions", "AccountCard", "TransactionRow", "SpendingChart", "MerchantIcon"],
  },
  {
    id: "crypto",
    label: "Crypto wallet / tracker",
    keywords: ["crypto", "cryptocurrency", "bitcoin", "wallet app", "ethereum", "web3"],
    archetype: "stats-dashboard",
    dna: "Dark futuristic, neon accents, sparkline charts, live ticker feel",
    palette: "bg-black + from-yellow-400 via-amber-500 to-orange-500 accent (or green/red)",
    signature: "Portfolio value hero with sparkline + token list with price + 24h change + chart drawer",
    mustHave: ["Portfolio total with day-change %", "Sparkline chart", "Token rows with logo, symbol, balance, price, +/-% colored", "Market movers row", "Send/Receive/Swap action row"],
    components: ["PortfolioHero", "Sparkline", "TokenRow", "MarketMovers", "ActionRow", "PriceBadge"],
  },
  {
    id: "expenses",
    label: "Expense tracker / personal finance",
    keywords: ["expense tracker", "budget app", "spending", "personal finance", "ynab", "mint"],
    archetype: "stats-dashboard",
    dna: "Friendly clean, category-color coded, donut charts, encouraging tone",
    palette: "bg-emerald-50 + from-emerald-500 to-teal-600 accent",
    signature: "Monthly spend hero with budget bar + category donut + recent transactions grouped by day",
    mustHave: ["This month spend vs budget hero", "Category donut chart with legend", "Transactions grouped by day", "Add expense FAB", "Budget category cards with progress bars"],
    components: ["SpendHero", "CategoryDonut", "TransactionGroup", "AddExpenseFAB", "BudgetCard", "CategoryIcon"],
  },
  {
    id: "invoice",
    label: "Invoicing / freelancer billing",
    keywords: ["invoice app", "invoicing", "billing", "freelancer", "create invoice"],
    archetype: "list-detail",
    dna: "Crisp professional, document-like detail view, status-color accents",
    palette: "bg-slate-50 + from-blue-600 to-indigo-700 accent",
    signature: "Stats summary + invoice list with status pills → invoice detail like a receipt + Send action",
    mustHave: ["Stats row (Outstanding / Paid / Overdue)", "Invoice list with client + amount + status pill", "Invoice detail with line items + total + Send button", "Create invoice FAB", "Filter tabs by status"],
    components: ["StatsRow", "InvoiceListRow", "InvoiceDetail", "StatusPill", "CreateInvoiceFAB", "LineItemRow"],
  },

  // ── Information / Content ─────────────────────────────────────────────
  {
    id: "news",
    label: "News reader",
    keywords: ["news app", "newsreader", "headlines", "rss reader", "magazine app"],
    archetype: "vertical-feed",
    dna: "Editorial serif headlines, generous photography, refined hierarchy",
    palette: "bg-stone-50 + from-red-700 to-rose-800 accent (or NYT-like ink)",
    signature: "Hero featured story + section tabs + article cards with imagery + bookmark",
    mustHave: ["Featured story hero with big image + serif headline", "Section tabs (World/Tech/Sports)", "Article cards with thumbnail + headline + source + time", "Bookmark toggle", "Reading time estimate"],
    components: ["FeaturedStory", "SectionTabs", "ArticleCard", "BookmarkToggle", "SourceBadge", "ReadTimeChip"],
  },
  {
    id: "blog",
    label: "Blog / personal publishing",
    keywords: ["blog app", "personal blog", "writing app", "medium-like"],
    archetype: "vertical-feed",
    dna: "Editorial elegant, beautiful typography, generous whitespace, author-forward",
    palette: "bg-white + from-emerald-700 to-teal-800 accent (or Medium-like cream)",
    signature: "Author hero + article cards with reading time → article reader with serif body",
    mustHave: ["Featured post hero", "Article card with cover + title + author avatar + read time", "Tag chips", "Article reader view with serif body + share row", "Follow author button"],
    components: ["FeaturedPost", "ArticleCard", "AuthorAvatar", "TagChips", "ArticleReader", "ShareRow"],
  },
  {
    id: "weather",
    label: "Weather app",
    keywords: ["weather app", "forecast", "temperature", "rain forecast"],
    archetype: "stats-dashboard",
    dna: "Atmospheric gradient that matches current weather, glassmorphism cards, large temp",
    palette: "from-sky-400 to-indigo-700 dynamic by condition",
    signature: "Big current temp + condition icon + hourly strip + 7-day forecast list + detail tiles",
    mustHave: ["Hero with city, big temp, condition, hi/lo", "Hourly horizontal strip with icons + temps", "7-day list with icon + hi/lo", "Detail tiles grid (UV, wind, humidity, sunrise)", "Background that reflects condition"],
    components: ["WeatherHero", "HourlyStrip", "DailyRow", "DetailTile", "ConditionBackground", "CitySwitcher"],
  },

  // ── Travel / Local ────────────────────────────────────────────────────
  {
    id: "travel",
    label: "Travel / trip booking",
    keywords: ["travel app", "trip planner", "booking", "vacation", "airbnb"],
    archetype: "discover-feed",
    dna: "Warm wanderlust palette, big destination photography, magazine-like cards",
    palette: "bg-amber-50 + from-teal-500 to-emerald-600 accent",
    signature: "Search bar with destination/dates + curated destination cards + featured trip with imagery",
    mustHave: ["Search hero (Where? When? Guests?)", "Featured destinations carousel", "Stay/Experience cards with imagery + price/night + rating", "Filter chips", "Saved/wishlist heart"],
    components: ["SearchHero", "DestinationCarousel", "StayCard", "FilterChips", "WishlistHeart", "RatingBadge"],
  },
  {
    id: "flights",
    label: "Flight booking",
    keywords: ["flight booking", "flights app", "airline tickets", "skyscanner"],
    archetype: "search-results",
    dna: "Crisp business clean, blue trustworthy palette, route diagrams",
    palette: "bg-white + from-sky-600 to-blue-700 accent",
    signature: "Trip search form (From → To, dates, pax) + flight result cards with route diagram + price",
    mustHave: ["From/To search with swap button", "Date + passenger row", "Flight result card with airline logo + times + duration + stops + price", "Filter sort row", "Price calendar peek"],
    components: ["FlightSearchForm", "FlightResultCard", "RouteDiagram", "FilterSortBar", "PriceBadge", "AirlineLogo"],
  },
  {
    id: "hotel",
    label: "Hotel / stay booking",
    keywords: ["hotel booking", "stays", "accommodation", "booking.com"],
    archetype: "discover-feed",
    dna: "Premium warm, big photography, refined badges",
    palette: "bg-stone-50 + from-rose-500 to-pink-600 accent",
    signature: "Location search + hotel cards with photo + rating + price/night → detail with gallery",
    mustHave: ["Search with location/dates/guests", "Hotel card with hero photo + name + rating + price", "Map view toggle", "Amenity badges", "Detail with photo gallery + reviews"],
    components: ["StaySearchHeader", "HotelCard", "MapToggle", "AmenityBadge", "PhotoGallery", "ReviewRow"],
  },
  {
    id: "rideshare",
    label: "Ride sharing (Uber-like)",
    keywords: ["ride share", "uber app", "lyft", "taxi app", "ride hailing"],
    archetype: "map-bottom-sheet",
    dna: "Map-dominant, dark UI overlays, decisive primary CTAs",
    palette: "bg-zinc-900 map UI + from-emerald-500 accent",
    signature: "Full-screen map + bottom sheet with destination input + ride options",
    mustHave: ["Full-bleed map with pin", "Bottom sheet with Where to? input", "Ride option list (Economy/Premium/XL) with ETA + fare", "Driver detail card after request", "Saved places shortcut row"],
    components: ["MapBackground", "BottomSheet", "RideOptionRow", "DriverCard", "SavedPlacesRow", "RequestButton"],
  },

  // ── Education ─────────────────────────────────────────────────────────
  {
    id: "study-planner",
    label: "Study planner / AI tutor",
    keywords: ["study planner", "ai tutor", "exam date", "study plan", "subjects", "topics", "homework", "student planner", "school planner"],
    archetype: "education-productivity",
    dna: "Android-first, clean Linear/Notion minimalism with warm focus accents, dense but calm cards, tutor chat as a signature surface",
    palette: "bg-slate-50 + white cards + from-blue-600 to-emerald-500 accent, dark mode in slate-950",
    signature: "Today dashboard with progress and upcoming exams + subject planner + per-subject AI tutor chat composer",
    mustHave: ["Onboarding with clear CTA", "Today dashboard tasks with progress", "Subject cards with exam date and weak-topic priority", "Study plan generator with daily/weekly plan", "AI tutor chat with Bangla+English answer bubbles", "Bottom tab navigation", "Profile/settings screen"],
    components: ["AppShell", "BottomNav", "OnboardingScreen", "DashboardScreen", "SubjectListScreen", "SubjectDetailScreen", "StudyPlanGenerator", "TutorChatScreen", "ProfileSettingsScreen", "SubjectCard", "TaskCard", "ExamCountdown", "ChatBubble", "ProgressBar"],
  },
  {
    id: "courses",
    label: "Online courses / e-learning",
    keywords: ["course app", "online course", "udemy", "coursera", "learning platform"],
    archetype: "media-browse",
    dna: "Smart confident, course imagery, progress prominent",
    palette: "bg-white + from-violet-600 to-indigo-700 accent",
    signature: "Continue learning hero + course catalog grid + course detail with curriculum + lesson player",
    mustHave: ["Continue learning card with progress bar", "Category tabs", "Course card with cover + title + instructor + rating + duration", "Curriculum lesson list with checkmarks", "Lesson player with video + transcript"],
    components: ["ContinueLearning", "CourseCard", "CurriculumList", "LessonPlayer", "ProgressBar", "InstructorBadge"],
  },
  {
    id: "language",
    label: "Language learning (Duolingo-like)",
    keywords: ["language learning", "duolingo", "learn spanish", "learn english", "vocabulary"],
    archetype: "checklist",
    dna: "Playful gamified, mascot-friendly, vibrant per-lesson colors",
    palette: "bg-white + from-green-500 to-emerald-600 accent",
    signature: "Path of lesson nodes (skill tree) + streak/XP header + lesson exercise screen",
    mustHave: ["Top header with streak flame + XP + hearts", "Vertical lesson path with circular nodes (locked/active/done)", "Section heading per unit", "Lesson exercise with multiple choice + check button", "Daily goal ring"],
    components: ["LessonPath", "LessonNode", "StreakHeader", "ExerciseCard", "DailyGoalRing", "HeartsBadge"],
  },
  {
    id: "quiz",
    label: "Quiz / trivia game",
    keywords: ["quiz app", "trivia", "questions game", "kahoot"],
    archetype: "game-screen",
    dna: "Bold playful, contrast-heavy, big animated answer buttons",
    palette: "bg-gradient-to-br from-purple-700 via-fuchsia-700 to-pink-700 vibrant",
    signature: "Question card + 4 answer buttons + score/timer header + result celebration",
    mustHave: ["Top bar with score + timer + question N/total", "Big question card", "4 large color-coded answer buttons", "Result screen with confetti + score + restart", "Category select screen"],
    components: ["QuestionCard", "AnswerButton", "QuizHeader", "ResultScreen", "CategoryGrid", "TimerBar"],
  },

  // ── Utility / Niche ───────────────────────────────────────────────────
  {
    id: "ai-chat",
    label: "AI chat assistant",
    keywords: ["ai chat", "chatbot app", "ai assistant", "chatgpt clone", "llm chat"],
    archetype: "list-detail-thread",
    dna: "Refined modern, dark or light, code-friendly, clean bubbles",
    palette: "bg-white + from-violet-600 to-indigo-700 accent (or premium dark)",
    signature: "Conversation list + thread with user/AI bubbles + composer with attach + suggested prompts",
    mustHave: ["Top bar with model picker + new chat", "Suggested prompt cards on empty state", "User vs AI message bubbles with avatars", "Composer with attach + send + voice", "Conversation history drawer"],
    components: ["ChatHeader", "SuggestedPrompts", "MessageBubble", "Composer", "ConversationDrawer", "ModelPicker"],
  },
  {
    id: "password",
    label: "Password manager",
    keywords: ["password manager", "1password", "bitwarden", "vault app"],
    archetype: "list-detail",
    dna: "Trustworthy secure, refined dark or crisp light, lock iconography",
    palette: "bg-slate-950 + from-blue-500 to-indigo-600 accent",
    signature: "Search + category nav + entry list with site favicon → entry detail with copy buttons",
    mustHave: ["Search bar at top", "Category tabs (Logins/Cards/Notes)", "Entry row with favicon + site + username", "Entry detail with masked password + copy buttons", "Add entry FAB", "Strength indicator"],
    components: ["SearchBar", "CategoryTabs", "EntryRow", "EntryDetail", "CopyButton", "StrengthMeter"],
  },
  {
    id: "realestate",
    label: "Real estate listings",
    keywords: ["real estate", "property listings", "zillow", "rent app", "homes for sale"],
    archetype: "discover-feed",
    dna: "Premium clean, large property photography, map+list combo",
    palette: "bg-white + from-teal-600 to-emerald-700 accent",
    signature: "Search + filter chips + property cards with photo + price + beds/baths → detail with gallery + map",
    mustHave: ["Search with location + map toggle", "Filter chips (price/beds/type)", "Property card with photo carousel + price + bed/bath/sqft", "Saved heart toggle", "Detail with gallery + features list + agent contact"],
    components: ["PropertySearchHeader", "FilterChips", "PropertyCard", "PhotoCarousel", "AgentContactCard", "FeaturesList"],
  },
  {
    id: "jobs",
    label: "Job board",
    keywords: ["job board", "job search", "linkedin jobs", "indeed", "career app"],
    archetype: "discover-feed",
    dna: "Professional crisp, company-logo-led, save/apply CTAs prominent",
    palette: "bg-white + from-blue-600 to-indigo-700 accent",
    signature: "Search + filter chips + job cards with company logo → detail with description + Apply",
    mustHave: ["Search with title + location", "Filter chips (remote/level/type)", "Job card with company logo + title + location + salary range + posted time", "Save bookmark", "Detail with description + Apply button"],
    components: ["JobSearchHeader", "FilterChips", "JobCard", "CompanyLogo", "SaveBookmark", "ApplyButton"],
  },
  {
    id: "events",
    label: "Events / ticketing",
    keywords: ["events app", "tickets", "concerts", "eventbrite", "ticketmaster"],
    archetype: "discover-feed",
    dna: "Vibrant energetic, event-poster imagery, urgency cues",
    palette: "bg-zinc-950 + from-fuchsia-500 to-pink-600 accent",
    signature: "Featured event hero + category pills + event cards with poster → ticket detail with QR",
    mustHave: ["Featured event hero with date/venue", "Category pills (Music/Sports/Comedy)", "Event card with poster + date badge + price-from", "Saved/Going toggle", "Ticket detail with QR placeholder"],
    components: ["FeaturedEvent", "CategoryPills", "EventCard", "DateBadge", "TicketQR", "SaveToggle"],
  },

  // ── Misc creative / pro ───────────────────────────────────────────────
  {
    id: "portfolio",
    label: "Portfolio showcase app",
    keywords: ["portfolio app", "showcase", "designer portfolio", "case studies"],
    archetype: "media-browse",
    dna: "Editorial gallery, generous whitespace, big imagery, refined type",
    palette: "bg-stone-50 + minimal black accent + one bold accent",
    signature: "Profile hero + project grid with big imagery → project detail case study",
    mustHave: ["Profile hero with avatar + name + role + social row", "Project grid with cover imagery + title + tags", "Project detail with hero + content sections", "About section card", "Contact CTA"],
    components: ["ProfileHero", "ProjectGrid", "ProjectCard", "ProjectDetail", "AboutCard", "ContactCTA"],
  },
  {
    id: "linkinbio",
    label: "Link-in-bio page",
    keywords: ["link in bio", "linktree", "bio link", "link page"],
    archetype: "single-page",
    dna: "Personality-forward, gradient or illustrated background, big tap targets",
    palette: "bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 vibrant",
    signature: "Avatar + name + bio + stack of large gradient link buttons + social row",
    mustHave: ["Centered avatar + name + bio", "Stack of full-width link buttons with icons", "Social icons row", "Subtle animated background", "Featured/highlighted link"],
    components: ["BioHeader", "LinkButton", "SocialRow", "AnimatedBackground", "FeaturedLink"],
  },
  {
    id: "fundraising",
    label: "Fundraising / crowdfunding",
    keywords: ["fundraising", "crowdfunding", "kickstarter", "gofundme", "donations"],
    archetype: "vertical-feed",
    dna: "Warm hopeful, story-imagery led, progress prominent",
    palette: "bg-rose-50 + from-rose-500 to-orange-500 accent",
    signature: "Featured campaign hero + campaign cards with progress + Donate CTA",
    mustHave: ["Featured campaign with cover + raised/goal + progress bar", "Category pills", "Campaign card with image + title + progress + supporters", "Donate button per card", "Trending row"],
    components: ["CampaignHero", "CampaignCard", "ProgressBar", "DonateButton", "CategoryPills", "SupporterAvatars"],
  },
  {
    id: "photo",
    label: "Photo gallery / camera",
    keywords: ["photo app", "gallery", "camera app", "photo editor"],
    archetype: "grid-detail",
    dna: "Image-first dark, minimal chrome, edge-to-edge thumbnails",
    palette: "bg-black + white text + soft accents",
    signature: "Tight photo grid → fullscreen viewer with swipe + actions",
    mustHave: ["Tight 3-col photo grid", "Album/section headers", "Fullscreen photo viewer with swipe + share/favorite/delete row", "Camera FAB", "Selection mode"],
    components: ["PhotoGrid", "PhotoViewer", "AlbumHeader", "ActionToolbar", "CameraFAB", "SelectionBar"],
  },
];

const GENERIC: DomainTemplate = {
  id: "generic",
  label: "Generic app",
  keywords: [],
  archetype: "general",
  dna: "Pick a bold cohesive direction that fits the request — never default to white-on-grey",
  palette: "Choose a primary + accent + at least one gradient that fits the mood",
  signature: "Identify the user's core 5-second intent and design the home screen around it",
  mustHave: ["Branded header", "Real seed content (no Lorem)", "Imagery on every card", "Animated entrance + tap feedback", "Persistent bottom element (tab bar / FAB / mini-widget)", "Active/empty/loading states"],
  components: ["Header", "BottomNav", "FeatureCard", "PrimaryAction", "EmptyState"],
};

// ─── Matcher ────────────────────────────────────────────────────────────
export interface DomainMatch {
  domain: DomainTemplate;
  confidence: number; // 0..1
  ambiguous: boolean; // true → caller may want to invoke an LLM tiebreaker
}

/**
 * Pure-keyword scoring. Returns the best match plus confidence + ambiguity hint.
 * - confidence is the top score normalised by keyword count of that domain.
 * - ambiguous = top score is weak, OR runner-up is within 1 point.
 */
export function matchDomainByKeyword(prompt: string): DomainMatch {
  const text = " " + prompt.toLowerCase() + " ";
  const scores: { d: DomainTemplate; score: number }[] = [];

  for (const d of DOMAINS) {
    let score = 0;
    for (const kw of d.keywords) {
      // Word-ish boundary match — avoids "shop" matching "workshop".
      // Text is padded with leading/trailing spaces, so we require BOTH sides
      // to be a word boundary (space or punctuation we already stripped).
      const needle = kw.toLowerCase();
      // Multi-word phrases: substring is fine since they already contain spaces.
      // Single words: must be surrounded by non-word chars.
      const matched = needle.includes(" ")
        ? text.includes(needle)
        : new RegExp(`[^a-z0-9]${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^a-z0-9]`).test(text);
      if (matched) {
        score += needle.includes(" ") ? 2 : 1;
      }
    }
    if (score > 0) scores.push({ d, score });
  }

  if (scores.length === 0) {
    return { domain: GENERIC, confidence: 0, ambiguous: true };
  }

  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];
  const second = scores[1];
  const topConf = Math.min(1, top.score / Math.max(2, top.d.keywords.length));
  const ambiguous =
    top.score < 2 || (second !== undefined && top.score - second.score <= 1);

  return { domain: top.d, confidence: topConf, ambiguous };
}

/**
 * Optional LLM tiebreaker. Caller passes a fetcher that hits Lovable AI Gateway
 * with a tiny prompt and a constrained tool call. Cheap (~$0.0001 with flash-lite).
 *
 * The fetcher receives the candidate IDs and the user prompt, and must return
 * the chosen ID (one of the candidates, or "generic").
 */
export async function classifyDomainWithLLM(
  prompt: string,
  candidates: DomainTemplate[],
  fetcher: (sysPrompt: string, userPrompt: string, ids: string[]) => Promise<string>,
): Promise<DomainTemplate> {
  if (candidates.length === 0) return GENERIC;
  if (candidates.length === 1) return candidates[0];

  const ids = candidates.map((c) => c.id).concat("generic");
  const sys =
    "You classify app-build requests into one of the provided domain IDs. " +
    "Reply with EXACTLY one ID from the list — no other text.";
  const user =
    `Request: ${prompt}\n\n` +
    `Candidates:\n` +
    candidates.map((c) => `- ${c.id}: ${c.label}`).join("\n") +
    `\n- generic: none of the above fits well\n\n` +
    `Best match ID:`;

  try {
    const chosen = await fetcher(sys, user, ids);
    const norm = chosen.trim().toLowerCase().replace(/[^a-z-]/g, "");
    const found = candidates.find((c) => c.id === norm);
    return found ?? GENERIC;
  } catch (e) {
    console.warn("[domains] LLM tiebreaker failed:", e);
    return candidates[0];
  }
}

/**
 * Render a domain template as compact prompt text the agent receives.
 * ~150-250 tokens per call — only injected on first iteration of scratch
 * builds. Memoized per worker since the output is deterministic.
 */
const _renderHintCache = new Map<string, string>();
export function renderDomainHint(d: DomainTemplate): string {
  const cached = _renderHintCache.get(d.id);
  if (cached !== undefined) return cached;
  let out: string;
  if (d.id === "generic") {
    out = [
      `## Domain hint: GENERIC`,
      `No specific archetype matched the request — apply the universal quality bar.`,
      `Decide a bold visual direction yourself: ${d.dna}`,
      `Palette: ${d.palette}`,
      `Signature interaction to design around: ${d.signature}`,
      `Must-have elements: ${d.mustHave.join(" · ")}`,
    ].join("\n");
  } else {
    out = [
      `## Domain hint: ${d.label.toUpperCase()}`,
      `This build IS a ${d.label}. Execute the patterns below — they're what makes the app feel real, not a prototype.`,
      ``,
      `**Visual DNA:** ${d.dna}`,
      `**Palette suggestion:** ${d.palette}`,
      `**Signature interaction (the spine of the app):** ${d.signature}`,
      ``,
      `**Must-have elements (every one of these):**`,
      ...d.mustHave.map((m) => `- ${m}`),
      ``,
      `**Suggested component files to create:** ${d.components.join(", ")}`,
      ``,
      `Don't copy these literally — interpret the spirit. But if any must-have is missing from your final build, the result is incomplete.`,
    ].join("\n");
  }
  _renderHintCache.set(d.id, out);
  return out;
}

export { GENERIC };
