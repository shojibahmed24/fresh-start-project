import { Plus, Pencil, Trash2, Megaphone, Eye, EyeOff, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { type Announcement, VARIANT_BADGE } from "./types";

type Props = {
  anns: Announcement[];
  onNew: () => void;
  onEdit: (a: Announcement) => void;
  onToggle: (a: Announcement) => void;
  onRemove: (id: string) => void;
};

export const AnnouncementList = ({ anns, onNew, onEdit, onToggle, onRemove }: Props) => (
  <TabsContent value="announcements" className="mt-6 space-y-4">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <p className="text-xs sm:text-sm text-muted-foreground">
        Shop page e top e dekhabe — schedule, expiry, variant set kora jay.
      </p>
      <Button onClick={onNew} leftIcon={<Plus size={14} />} className="shrink-0 w-full sm:w-auto">
        <span className="sm:inline">New<span className="hidden sm:inline"> announcement</span></span>
      </Button>
    </div>

    {anns.length === 0 ? (
      <div className="rounded-xl border border-dashed border-[hsl(0_0%_100%/0.1)] p-10 text-center text-sm text-muted-foreground">
        <Megaphone size={28} className="mx-auto mb-3 opacity-50" />
        Kono announcement nei. "EID offer 50% off" ei rokom kichu post korun.
      </div>
    ) : (
      <div className="space-y-2">
        {anns.map((a) => {
          const now = new Date();
          const live =
            a.is_active &&
            new Date(a.starts_at) <= now &&
            (!a.expires_at || new Date(a.expires_at) > now);
          const expired = a.expires_at && new Date(a.expires_at) <= now;
          const scheduled = new Date(a.starts_at) > now;
          return (
            <div
              key={a.id}
              className="flex flex-col sm:flex-row sm:items-start gap-3 p-4 rounded-lg bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.08)]"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Badge className={VARIANT_BADGE[a.variant] ?? VARIANT_BADGE.info}>
                    {a.variant}
                  </Badge>
                  {live && (
                    <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                      ● Live
                    </Badge>
                  )}
                  {!a.is_active && <Badge variant="outline">Disabled</Badge>}
                  {expired && <Badge variant="outline" className="text-red-300 border-red-500/30">Expired</Badge>}
                  {scheduled && a.is_active && (
                    <Badge variant="outline" className="text-sky-300 border-sky-500/30">Scheduled</Badge>
                  )}
                </div>
                <div className="font-semibold">{a.title}</div>
                {a.body && (
                  <div className="text-sm text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">{a.body}</div>
                )}
                <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={11} />
                    From {new Date(a.starts_at).toLocaleString()}
                  </span>
                  {a.expires_at && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={11} />
                      Until {new Date(a.expires_at).toLocaleString()}
                    </span>
                  )}
                  {a.link_url && <span className="truncate max-w-[200px]">→ {a.link_url}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon-sm" variant="ghost" onClick={() => onToggle(a)} aria-label="Toggle active">
                  {a.is_active ? <Eye size={14} /> : <EyeOff size={14} className="text-muted-foreground" />}
                </Button>
                <Button size="icon-sm" variant="ghost" onClick={() => onEdit(a)} aria-label="Edit">
                  <Pencil size={14} />
                </Button>
                <Button size="icon-sm" variant="ghost" onClick={() => onRemove(a.id)} aria-label="Delete">
                  <Trash2 size={14} className="text-destructive" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </TabsContent>
);
