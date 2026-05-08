import type { Snippet } from "../types.ts";

export const CHAT_BUBBLE: Snippet = {
  name: "Asymmetric chat bubble (sent/received)",
  why: "Chat apps need a clear bubble shape difference + tail + timestamp on hover.",
  code: `function Bubble({ msg, mine }) {
  return (
    <div className={\`flex \${mine ? "justify-end" : "justify-start"}\`}>
      <div className={\`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-snug
        \${mine
          ? "bg-primary text-primary-foreground rounded-br-md"
          : "bg-muted text-foreground rounded-bl-md"}\`}>
        <p>{msg.text}</p>
        <p className={\`mt-1 text-[10px] \${mine ? "text-primary-foreground/70" : "text-muted-foreground"} text-right\`}>
          {msg.time}
        </p>
      </div>
    </div>
  );
}`,
};

export const SOCIAL_FEED_POST: Snippet = {
  name: "Feed post with double-tap heart + actions",
  why: "Social posts need avatar header, full-bleed media, and a like/comment/share row.",
  uses: ["lucide-react: Heart, MessageCircle, Send, Bookmark"],
  code: `function FeedPost({ post, liked, onLike }) {
  return (
    <article className="rounded-2xl bg-card border border-border/40 overflow-hidden">
      <header className="flex items-center gap-3 p-3">
        <img src={post.user.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{post.user.name}</p>
          <p className="text-[11px] text-muted-foreground">{post.location}</p>
        </div>
      </header>
      <img src={post.image} alt="" className="aspect-square w-full object-cover" />
      <div className="flex items-center gap-4 px-3 py-2.5">
        <button onClick={onLike}>
          <Heart className={\`h-6 w-6 \${liked ? "fill-rose-500 text-rose-500" : ""}\`} />
        </button>
        <MessageCircle className="h-6 w-6" />
        <Send className="h-6 w-6" />
        <Bookmark className="ml-auto h-6 w-6" />
      </div>
      <p className="px-3 pb-1 text-sm font-semibold">{post.likes.toLocaleString()} likes</p>
      <p className="px-3 pb-3 text-sm">
        <span className="font-semibold">{post.user.name}</span> {post.caption}
      </p>
    </article>
  );
}`,
};

export const DATING_SWIPE: Snippet = {
  name: "Swipeable profile card with overlay",
  why: "Dating apps need full-bleed photo cards with name+age overlay and stack effect.",
  uses: ["lucide-react: Heart, X, MapPin"],
  code: `function ProfileCard({ profile }) {
  return (
    <div className="relative aspect-[3/4] w-full max-w-sm overflow-hidden rounded-3xl
      shadow-[0_30px_60px_-20px_rgba(0,0,0,0.4)] mx-auto">
      <img src={profile.photo} alt={profile.name}
        className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
      <div className="absolute inset-x-5 bottom-20 text-white">
        <h2 className="text-2xl font-bold">{profile.name}, <span className="font-light">{profile.age}</span></h2>
        <p className="mt-1 inline-flex items-center gap-1 text-sm opacity-90">
          <MapPin className="h-3.5 w-3.5" /> {profile.distance} km away
        </p>
        <p className="mt-2 text-sm line-clamp-2 opacity-90">{profile.bio}</p>
      </div>
      <div className="absolute inset-x-0 bottom-5 flex justify-center gap-6">
        <button className="grid h-14 w-14 place-items-center rounded-full bg-white shadow-lg">
          <X className="h-6 w-6 text-rose-500" strokeWidth={3} />
        </button>
        <button className="grid h-14 w-14 place-items-center rounded-full bg-rose-500 shadow-lg">
          <Heart className="h-6 w-6 text-white fill-white" />
        </button>
      </div>
    </div>
  );
}`,
};

export const AICHAT_MESSAGE: Snippet = {
  name: "AI chat message with streaming cursor + actions",
  why: "AI apps need clear user/assistant differentiation + copy/regenerate hover actions.",
  uses: ["lucide-react: Copy, RotateCw, ThumbsUp"],
  code: `function AiMessage({ msg, streaming }) {
  const isUser = msg.role === "user";
  return (
    <div className={\`group flex gap-3 \${isUser ? "flex-row-reverse" : ""}\`}>
      <div className={\`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold
        \${isUser ? "bg-primary text-primary-foreground" : "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white"}\`}>
        {isUser ? "U" : "AI"}
      </div>
      <div className={\`max-w-[80%] \${isUser ? "text-right" : ""}\`}>
        <div className={\`inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed
          \${isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted rounded-bl-md"}\`}>
          {msg.content}
          {streaming && <span className="ml-0.5 inline-block h-3 w-1.5 align-middle bg-current animate-pulse" />}
        </div>
        {!isUser && !streaming && (
          <div className="mt-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
            <button className="rounded p-1 hover:bg-muted"><Copy className="h-3.5 w-3.5" /></button>
            <button className="rounded p-1 hover:bg-muted"><RotateCw className="h-3.5 w-3.5" /></button>
            <button className="rounded p-1 hover:bg-muted"><ThumbsUp className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>
    </div>
  );
}`,
};

