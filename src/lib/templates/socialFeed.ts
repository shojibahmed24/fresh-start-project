import type { Template } from "./types";
import { baseRules } from "./baseRules";

// Lightweight social-feed template emphasising posts, likes, comments, and
// profile — distinct from the existing Instagram-style "social" template by
// being more Twitter/Threads-flavoured (text-first feed).
export const socialFeedTemplate: Template = {
  id: "social-feed",
  emoji: "🐦",
  name: "Social Feed (Twitter)",
  tagline: "Posts, likes, comments & profile",
  gradient: "from-sky-500 to-blue-600",
  defaultName: "My Feed",
  defaultDescription: "Twitter/Threads-style social feed app with posts, likes, comments and profiles.",
  starterPrompt: `${baseRules("Twitter/Threads-style social feed app")}
Screens & routes:
1. /feed — composer card at top (avatar + auto-grow textarea "What's happening?" + photo/poll/emoji icons + character counter + "Post" button disabled when empty). Below: timeline of PostCards (avatar, name, @handle, verified badge, time ago, body with @mention + #hashtag highlighting + optional image grid 1/2/3/4 layout, action row: Reply count, Repost toggle, Like heart toggle with animated count, Bookmark, Share). Toggle tabs at top: "For you" / "Following".
2. /post/:id — full post hero (larger), reply composer ("Tweet your reply"), threaded replies list (nested 1 level, "Show more replies").
3. /explore — search input, trending topics list (rank, topic, category, post count) + "Who to follow" right rail with Follow toggles + suggested topic chips.
4. /notifications — tabs (All / Mentions / Likes / Reposts / Follows), grouped notification rows ("X and 12 others liked your post").
5. /profile/:handle — banner cover image + avatar overlap, name + handle + verified, bio with link/location/joined date, follow/following counts (tappable), Follow/Following toggle button + Message button. Tabs: Posts / Replies / Media / Likes — each shows filtered PostCards.
6. /messages — left conversation list + right thread (mobile: drawer), bubble UI with read receipts, composer at bottom.
7. /settings — profile edit form (avatar/banner upload preview, name, bio, location, link), theme toggle, notification preferences switches, blocked accounts list.
Bottom nav: Home / Explore / Notifications / Messages / Profile.

State (zustand + persist to localStorage):
- posts[], likedIds, repostedIds, bookmarkedIds, followedHandles, notifications[]
- toggleLike, toggleRepost, toggleBookmark, toggleFollow, addPost, addReply

Seed: 12 users with realistic bios, 30+ posts across feed (mix of text-only, single image, image grid, with replies/likes/reposts counts), 8 trending topics, 6 message threads with 10+ messages each.

📁 Use small files: \`components/social/\` for PostCard, PostComposer, PostActions, PostMediaGrid, ReplyThread, NotificationRow, TrendingItem, FollowButton, ProfileHeader, ProfileTabs, MessageBubble, ConversationListItem, BottomNav. Each ≤220 lines.`,
};
