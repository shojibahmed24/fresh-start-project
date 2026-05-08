import type { Snippet } from "../types.ts";

export const PODCAST_PLAYER: Snippet = {
  name: "Sticky mini-player with scrub bar",
  why: "The defining UX of any audio app. Persists across navigation; tap expands.",
  uses: ["lucide-react: Play, Pause, SkipForward"],
  code: `function MiniPlayer({ track, playing, progress, onToggle, onNext }) {
  // progress: 0..1
  return (
    <div className="fixed inset-x-2 bottom-16 z-40 mx-auto max-w-md
      rounded-2xl border border-white/10 bg-zinc-900/90 backdrop-blur-xl
      shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)] overflow-hidden">
      <div className="h-1 bg-white/10">
        <div className="h-full bg-gradient-to-r from-fuchsia-500 to-orange-400"
          style={{ width: \`\${progress * 100}%\` }} />
      </div>
      <div className="flex items-center gap-3 p-3">
        <img src={track.cover} alt="" className="h-10 w-10 rounded-lg object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{track.title}</p>
          <p className="truncate text-xs text-white/60">{track.show}</p>
        </div>
        <button onClick={onToggle} className="grid h-9 w-9 place-items-center rounded-full bg-white text-zinc-900">
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
        </button>
        <button onClick={onNext} className="grid h-8 w-8 place-items-center rounded-full text-white/80 hover:text-white">
          <SkipForward className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}`,
};

export const PODCAST_SHOWCARD: Snippet = {
  name: "Show carousel card (square cover + title + host)",
  why: "Horizontal show carousels are the spine of podcast discovery — never plain text lists.",
  code: `function ShowCard({ show }) {
  return (
    <button className="group w-36 shrink-0 text-left">
      <div className="relative aspect-square overflow-hidden rounded-2xl">
        <img src={show.cover} alt="" className="h-full w-full object-cover
          transition-transform duration-500 group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <span className="absolute bottom-2 left-2 rounded-full bg-white/20 backdrop-blur px-2 py-0.5
          text-[10px] font-medium text-white">{show.episodes} EP</span>
      </div>
      <p className="mt-2 truncate text-sm font-semibold">{show.title}</p>
      <p className="truncate text-xs text-muted-foreground">{show.host}</p>
    </button>
  );
}`,
};

export const VIDEO_THUMB: Snippet = {
  name: "Video thumbnail with duration + progress bar",
  why: "Video apps need 16:9 thumbs with duration overlay + watched-progress bar.",
  uses: ["lucide-react: Play"],
  code: `function VideoThumb({ video }) {
  return (
    <article className="group">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
        <img src={video.thumb} alt={video.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-mono text-white">
          {video.duration}
        </span>
        {video.progress > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/30">
            <div className="h-full bg-rose-500" style={{ width: \`\${video.progress * 100}%\` }} />
          </div>
        )}
        <div className="absolute inset-0 grid place-items-center bg-black/0 group-hover:bg-black/30 transition">
          <Play className="h-12 w-12 text-white opacity-0 group-hover:opacity-100 fill-white" />
        </div>
      </div>
      <div className="mt-2 flex gap-3">
        <img src={video.channel.avatar} alt="" className="h-9 w-9 rounded-full" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-snug line-clamp-2">{video.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{video.channel.name} · {video.views} views</p>
        </div>
      </div>
    </article>
  );
}`,
};

