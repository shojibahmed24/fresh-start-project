import type { Template } from "./types";
import { baseRules } from "./baseRules";

export const socialTemplate: Template = {
  id: "social",
  emoji: "📱",
  name: "Social Feed",
  tagline: "Instagram-style posts & profiles",
  gradient: "from-fuchsia-500 to-purple-600",
  defaultName: "My Social",
  defaultDescription: "Instagram-like social feed mobile app with posts, likes and comments.",
  starterPrompt: `${baseRules("Instagram-style social feed app")}
Screens & routes:
1. /feed — stories rail at top (12+ users), scrollable posts (image, like/comment/share/save buttons that toggle, caption, comments preview).
2. /explore — masonry grid of 24+ posts with search.
3. /create — image picker placeholder, caption input, "Post" button (adds to feed state).
4. /notifications — likes/follows/comments list grouped by Today / This week.
5. /profile/:id — avatar, bio, stats (posts/followers/following), 3-tab grid (posts, reels, tagged), follow button.
6. /post/:id — full post + comments thread with reply.
Seed: 12 users, 24+ posts with images and 5+ comments each.`,
};
