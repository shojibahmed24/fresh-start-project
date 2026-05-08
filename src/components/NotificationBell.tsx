import { Bell, Check, Trash2, CheckCheck, Inbox } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const typeColor: Record<string, string> = {
  success: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  error: "bg-red-500/15 text-red-300 border-red-500/30",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  order: "bg-primary/15 text-primary border-primary/30",
  credit: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  info: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  system: "bg-muted text-muted-foreground border-border",
};

/** Group notifications into Today / Yesterday / Earlier buckets. */
const groupNotifications = (items: Notification[]) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86_400_000;

  const groups: { label: string; items: Notification[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Earlier", items: [] },
  ];

  for (const n of items) {
    const t = new Date(n.created_at).getTime();
    if (t >= todayStart) groups[0].items.push(n);
    else if (t >= yesterdayStart) groups[1].items.push(n);
    else groups[2].items.push(n);
  }
  return groups.filter((g) => g.items.length > 0);
};

export const NotificationBell = () => {
  const navigate = useNavigate();
  const { items, unreadCount, markAllRead, markRead, remove } = useNotifications();
  const grouped = useMemo(() => groupNotifications(items), [items]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label="Notifications">
          <Bell size={16} />
          {unreadCount > 0 && (
            <>
              {/* Pulsing halo behind badge */}
              <span className="absolute -top-1 -right-1 inline-flex h-4 w-4 rounded-full bg-primary/60 animate-ping opacity-75" />
              <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[9px] font-bold rounded-full bg-gradient-primary text-primary-foreground shadow-[0_0_8px_hsl(var(--primary)/0.6)]">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[360px] p-0 bg-[hsl(var(--bg-elevated))] border-[hsl(0_0%_100%/0.08)] overflow-hidden"
      >
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[hsl(0_0%_100%/0.06)] bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold">Notifications</div>
            {unreadCount > 0 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} leftIcon={<CheckCheck size={12} />}>
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[440px]">
          {items.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <Inbox className="mx-auto mb-2 text-muted-foreground/40" size={32} />
              <div className="text-xs text-muted-foreground">No notifications yet</div>
              <div className="text-[10px] text-muted-foreground/70 mt-1">We'll let you know when something happens</div>
            </div>
          ) : (
            <div>
              {grouped.map((group) => (
                <div key={group.label}>
                  <div className="sticky top-0 z-10 bg-[hsl(var(--bg-elevated))]/95 backdrop-blur px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-[hsl(0_0%_100%/0.04)]">
                    {group.label}
                  </div>
                  <ul className="divide-y divide-[hsl(0_0%_100%/0.05)]">
                    {group.items.map((n) => (
                      <li
                        key={n.id}
                        className={cn(
                          "group px-3 py-2.5 hover:bg-[hsl(0_0%_100%/0.03)] cursor-pointer transition-colors relative",
                          !n.read && "bg-primary/[0.04]",
                        )}
                        onClick={() => {
                          if (!n.read) markRead(n.id);
                          if (n.link) navigate(n.link);
                        }}
                      >
                        {!n.read && (
                          <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-primary" />
                        )}
                        <div className="flex items-start gap-2">
                          <span
                            className={cn(
                              "mt-0.5 inline-block px-1.5 py-0.5 rounded border text-[9px] uppercase tracking-wide shrink-0",
                              typeColor[n.type] ?? typeColor.info,
                            )}
                          >
                            {n.type}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium leading-snug truncate">{n.title}</div>
                            {n.body && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>}
                            <div className="text-[10px] text-muted-foreground mt-1">
                              {new Date(n.created_at).toLocaleString()}
                            </div>
                          </div>
                          <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!n.read && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markRead(n.id);
                                }}
                                className="p-1 hover:text-emerald-400"
                                aria-label="Mark read"
                              >
                                <Check size={12} />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                remove(n.id);
                              }}
                              className="p-1 hover:text-destructive"
                              aria-label="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
