import type { Snippet } from "../types.ts";

export const TODO_TASK: Snippet = {
  name: "Animated checkbox task row",
  why: "Productivity apps need delightful micro-interactions on completion (strike-through + fade).",
  uses: ["framer-motion", "lucide-react: Check"],
  code: `function TaskRow({ task, onToggle }) {
  return (
    <motion.li layout
      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/40">
      <button onClick={() => onToggle(task.id)}
        className={\`grid h-5 w-5 place-items-center rounded-md border-2 transition
          \${task.done
            ? "bg-primary border-primary text-primary-foreground"
            : "border-border hover:border-primary"}\`}>
        {task.done && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>
      <span className={\`flex-1 text-sm transition
        \${task.done ? "text-muted-foreground line-through" : ""}\`}>
        {task.title}
      </span>
      {task.priority && (
        <span className="rounded-full bg-amber-500/15 text-amber-600 text-[10px] font-semibold px-2 py-0.5">
          {task.priority}
        </span>
      )}
    </motion.li>
  );
}`,
};

export const KANBAN_COLUMN: Snippet = {
  name: "Kanban column with task cards + WIP count",
  why: "Kanban apps need column headers with count + draggable-feeling card stacks.",
  code: `function KanbanColumn({ title, tasks, accent = "primary" }) {
  return (
    <section className="w-72 shrink-0 rounded-2xl bg-muted/40 p-3">
      <header className="mb-3 flex items-center gap-2">
        <span className={\`h-2 w-2 rounded-full bg-\${accent}\`} />
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {tasks.length}
        </span>
      </header>
      <ul className="space-y-2">
        {tasks.map((t) => (
          <li key={t.id} className="rounded-xl bg-background border border-border/50 p-3
            shadow-sm hover:shadow-md hover:-translate-y-0.5 transition cursor-grab active:cursor-grabbing">
            <p className="text-sm font-medium leading-snug">{t.title}</p>
            <div className="mt-2 flex items-center gap-2">
              {t.tags?.map((tag) => (
                <span key={tag} className="rounded bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 font-medium">{tag}</span>
              ))}
              {t.assignee && (
                <img src={t.assignee.avatar} alt="" className="ml-auto h-5 w-5 rounded-full" />
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}`,
};

export const EVENTS_TICKET: Snippet = {
  name: "Event ticket card with date block + venue",
  why: "Events apps need calendar-style date blocks + venue line, never plain rows.",
  uses: ["lucide-react: MapPin, Users"],
  code: `function EventTicket({ event }) {
  const [m, d] = event.date.split(" ");
  return (
    <article className="flex gap-4 rounded-2xl bg-card p-3 border border-border/50
      hover:shadow-lg transition">
      <div className="grid place-items-center w-16 shrink-0 rounded-xl bg-primary/10 text-primary py-2">
        <p className="text-[10px] uppercase font-bold tracking-wider">{m}</p>
        <p className="text-2xl font-bold leading-none">{d}</p>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold line-clamp-1">{event.title}</h3>
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" /> {event.venue}
        </p>
        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3 w-3" /> {event.attendees} going
        </p>
      </div>
      <span className="self-start rounded-full bg-foreground text-background text-[10px] font-bold uppercase px-2 py-1">
        {event.price === 0 ? "Free" : \`$\${event.price}\`}
      </span>
    </article>
  );
}`,
};

export const NOTES_CARD: Snippet = {
  name: "Sticky-note card (masonry-friendly)",
  why: "Notes apps need colorful sticky-note feel with varied heights for a masonry grid.",
  code: `function NoteCard({ note }) {
  // note: { id, title, body, color: 'amber'|'rose'|'sky'|'violet'|'emerald', updated }
  const tones = {
    amber:   "bg-amber-100 text-amber-900",
    rose:    "bg-rose-100 text-rose-900",
    sky:     "bg-sky-100 text-sky-900",
    violet:  "bg-violet-100 text-violet-900",
    emerald: "bg-emerald-100 text-emerald-900",
  };
  return (
    <article className={\`break-inside-avoid rounded-2xl p-4 \${tones[note.color]}
      shadow-[0_4px_20px_-8px_rgba(0,0,0,0.15)] hover:-rotate-1 hover:shadow-lg transition\`}>
      <h3 className="text-sm font-bold">{note.title}</h3>
      <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{note.body}</p>
      <p className="mt-3 text-[10px] opacity-60">{note.updated}</p>
    </article>
  );
}`,
};

