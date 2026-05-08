import { m } from "framer-motion";
import { Plus, Pencil, Trash2, Sparkles, FolderPlus, type LucideIcon } from "lucide-react";
import type { Project } from "@/lib/store";

type ActivityKind = "created" | "updated" | "deleted" | "opened";

type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  at: number;
};

const META: Record<ActivityKind, { icon: LucideIcon; tone: string }> = {
  created: { icon: FolderPlus, tone: "text-emerald-400 bg-emerald-500/10" },
  updated: { icon: Pencil,    tone: "text-sky-400 bg-sky-500/10" },
  deleted: { icon: Trash2,    tone: "text-rose-400 bg-rose-500/10" },
  opened:  { icon: Sparkles,  tone: "text-primary bg-primary/10" },
};

const timeAgo = (ts: number) => {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
};

type Props = {
  projects: Project[];
  onCreate: () => void;
};

/**
 * Right-rail recent-activity timeline. Derives a synthetic activity feed
 * directly from the project list (created / updated timestamps) so it works
 * out of the box without any new tables.
 */
export const RecentActivityTimeline = ({ projects, onCreate }: Props) => {
  const activity: ActivityItem[] = projects
    .flatMap<ActivityItem>((p) => {
      const events: ActivityItem[] = [
        { id: `${p.id}-c`, kind: "created", title: `Created "${p.name}"`, at: p.createdAt },
      ];
      if (p.updatedAt && p.updatedAt > p.createdAt + 60_000) {
        events.push({ id: `${p.id}-u`, kind: "updated", title: `Updated "${p.name}"`, at: p.updatedAt });
      }
      return events;
    })
    .sort((a, b) => b.at - a.at)
    .slice(0, 8);

  return (
    <aside className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur p-4 lg:sticky lg:top-24">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold">Recent activity</h3>
          <p className="text-[11px] text-muted-foreground">Last actions in your workspace</p>
        </div>
        <button
          onClick={onCreate}
          className="size-7 rounded-md bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow hover:opacity-90 transition"
          aria-label="New project"
        >
          <Plus size={14} />
        </button>
      </div>

      {activity.length === 0 ? (
        <div className="text-center py-8 text-xs text-muted-foreground">
          No activity yet.
        </div>
      ) : (
        <ol className="relative space-y-3">
          {/* Vertical line behind the dots */}
          <span className="absolute left-[15px] top-1 bottom-1 w-px bg-gradient-to-b from-primary/40 via-border to-transparent" aria-hidden />
          {activity.map((a, i) => {
            const { icon: Icon, tone } = META[a.kind];
            return (
              <m.li
                key={a.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="relative flex items-start gap-3"
              >
                <div className={`relative z-10 size-8 shrink-0 rounded-full flex items-center justify-center ring-2 ring-background ${tone}`}>
                  <Icon size={14} />
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <div className="text-xs font-medium leading-snug truncate">{a.title}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(a.at)}</div>
                </div>
              </m.li>
            );
          })}
        </ol>
      )}
    </aside>
  );
};
