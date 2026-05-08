import { useEffect, useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { MoreVertical, Trash2, Copy, ExternalLink, X, Pencil, Sparkles } from "lucide-react";
import { useLongPress } from "@/hooks/useLongPress";
import { haptic } from "@/lib/haptics";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import type { Project } from "@/lib/store";

type Props = {
  project: Project;
  index: number;
  onOpen: () => void;
  onDelete: () => void;
  onEdit?: () => void;
  onCopyLink?: () => void;
};

type BuildSummary = {
  status: "queued" | "preparing" | "building" | "uploading" | "ready" | "failed" | "cancelled";
  finished_at: string | null;
} | null;

/** Map build status → user-facing label + colored dot. */
const STATUS_META: Record<NonNullable<BuildSummary>["status"], { label: string; dot: string; text: string }> = {
  queued:    { label: "Queued",    dot: "bg-muted-foreground/40",       text: "text-muted-foreground" },
  preparing: { label: "Preparing", dot: "bg-amber-400 animate-pulse",   text: "text-amber-300" },
  building:  { label: "Building",  dot: "bg-amber-400 animate-pulse",   text: "text-amber-300" },
  uploading: { label: "Uploading", dot: "bg-sky-400 animate-pulse",     text: "text-sky-300" },
  ready:     { label: "Ready",     dot: "bg-emerald-400 shadow-[0_0_8px_hsl(150_80%_55%/0.7)]", text: "text-emerald-300" },
  failed:    { label: "Failed",    dot: "bg-rose-500",                  text: "text-rose-300" },
  cancelled: { label: "Cancelled", dot: "bg-muted-foreground/50",       text: "text-muted-foreground" },
};

/** Deterministic gradient pair derived from the project id — gives every card
 *  a unique-feeling thumbnail without storing any image. */
const gradientFor = (id: string) => {
  const hues: [number, number][] = [
    [262, 190], [322, 262], [220, 190], [340, 20], [150, 200],
    [280, 330], [200, 280], [30, 320],
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return hues[h % hues.length];
};

/**
 * Mobile-first project card.
 * - Tap → open project
 * - Long-press (mobile) → bottom-sheet action menu
 * - Kebab/Desktop → popover anchored to the card
 * - Live build status badge + gradient thumbnail header
 */
export const ProjectCard = ({ project, index, onOpen, onDelete, onEdit, onCopyLink }: Props) => {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [build, setBuild] = useState<BuildSummary>(null);

  // Fetch the most recent build for this project (cheap — `.limit(1)`).
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("app_builds")
      .select("status, finished_at")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setBuild(data as BuildSummary);
      });
    return () => { cancelled = true; };
  }, [project.id]);

  const longPress = useLongPress(() => {
    if (window.matchMedia("(max-width: 639px)").matches) {
      setSheetOpen(true);
    } else {
      setPopoverOpen(true);
    }
  }, { delay: 450 });

  const handleClick = () => {
    if (longPress.didFireRef.current) {
      longPress.didFireRef.current = false;
      return;
    }
    haptic("light");
    onOpen();
  };

  const [hueA, hueB] = gradientFor(project.id);
  // Show a readable short title on the gradient thumbnail instead of cryptic
  // 2-letter initials. Strip filler words, then take the first ~3 words capped
  // at 22 chars so the user can recognise the project at a glance.
  const FILLERS = new Set(["a", "an", "the", "and", "with", "for", "to", "of", "app", "ai"]);
  const words = project.name.trim().split(/\s+/);
  const meaningful = words.filter((w) => !FILLERS.has(w.toLowerCase()));
  const source = meaningful.length > 0 ? meaningful : words;
  let shortTitle = source.slice(0, 3).join(" ");
  if (shortTitle.length > 22) shortTitle = shortTitle.slice(0, 21).trimEnd() + "…";
  if (!shortTitle) shortTitle = project.name.slice(0, 22);
  const statusMeta = build ? STATUS_META[build.status] : null;

  return (
    <>
      <m.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        whileTap={{ scale: 0.98 }}
        whileHover={{ y: -2 }}
        className="relative overflow-hidden rounded-2xl bg-card/50 border border-border/60 hover:border-primary/50 hover:shadow-card-hover transition-all cursor-pointer group select-none touch-manipulation flex flex-col"
        onClick={handleClick}
        onPointerDown={longPress.onPointerDown}
        onPointerMove={longPress.onPointerMove}
        onPointerUp={longPress.onPointerUp}
        onPointerCancel={longPress.onPointerCancel}
        onPointerLeave={longPress.onPointerLeave}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Thumbnail header — deterministic gradient + initials, with status badge overlay */}
        <div
          className="relative h-24 overflow-hidden"
          style={{
            background: `linear-gradient(135deg, hsl(${hueA} 80% 55% / 0.85), hsl(${hueB} 75% 50% / 0.85))`,
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(0_0%_100%/0.25),transparent_60%)]" />
          {/* Soft brand grid */}
          <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(hsl(0_0%_100%/0.18)_1px,transparent_1px),linear-gradient(90deg,hsl(0_0%_100%/0.18)_1px,transparent_1px)] [background-size:22px_22px]" />
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <span className="text-center text-[18px] sm:text-[20px] font-extrabold leading-tight text-white tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] line-clamp-2 break-words">
              {shortTitle}
            </span>
          </div>
          {statusMeta && (
            <div className="absolute top-2 left-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-background/70 backdrop-blur border border-border/60">
              <span className={`size-1.5 rounded-full ${statusMeta.dot}`} />
              <span className={`text-[10px] font-semibold ${statusMeta.text}`}>{statusMeta.label}</span>
            </div>
          )}

          {/* Hover quick actions — desktop only */}
          <div
            className="absolute top-2 right-2 hidden md:flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            {onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); haptic("light"); onEdit(); }}
                className="size-7 rounded-md bg-background/80 backdrop-blur border border-border/60 flex items-center justify-center text-foreground hover:bg-background transition"
                aria-label="Rename"
                title="Rename"
              >
                <Pencil size={13} />
              </button>
            )}
            {onCopyLink && (
              <button
                onClick={(e) => { e.stopPropagation(); haptic("light"); onCopyLink(); }}
                className="size-7 rounded-md bg-background/80 backdrop-blur border border-border/60 flex items-center justify-center text-foreground hover:bg-background transition"
                aria-label="Copy link"
                title="Copy link"
              >
                <Copy size={13} />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); haptic("warning"); onDelete(); }}
              className="size-7 rounded-md bg-background/80 backdrop-blur border border-border/60 flex items-center justify-center text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition"
              aria-label="Delete"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        <div className="p-4 flex-1 flex flex-col">
          <div className="flex items-start justify-between mb-2 gap-2">
            <h3 className="font-semibold text-base leading-tight line-clamp-2 flex-1">{project.name}</h3>
            <div className="flex items-center gap-1 shrink-0 md:hidden" onClick={(e) => e.stopPropagation()}>
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      haptic("light");
                      if (window.matchMedia("(max-width: 639px)").matches) {
                        setSheetOpen(true);
                      } else {
                        setPopoverOpen(true);
                      }
                    }}
                    className="text-muted-foreground hover:text-foreground p-2 -m-2 rounded-md transition"
                    aria-label="Open menu"
                  >
                    <MoreVertical size={18} />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  sideOffset={6}
                  className="glass-strong w-56 rounded-xl border border-border p-1.5 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MenuItem icon={<ExternalLink size={16} />} label="Open"
                    onClick={() => { setPopoverOpen(false); haptic("light"); onOpen(); }} />
                  {onEdit && (
                    <MenuItem icon={<Pencil size={16} />} label="Rename / Edit"
                      onClick={() => { setPopoverOpen(false); haptic("light"); onEdit(); }} />
                  )}
                  {onCopyLink && (
                    <MenuItem icon={<Copy size={16} />} label="Copy link"
                      onClick={() => { setPopoverOpen(false); haptic("light"); onCopyLink(); }} />
                  )}
                  <div className="my-1 h-px bg-border" />
                  <MenuItem icon={<Trash2 size={16} />} label="Delete project" destructive
                    onClick={() => { setPopoverOpen(false); haptic("warning"); onDelete(); }} />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3 min-h-[2rem]">
            {project.description || "No description"}
          </p>
          <div className="mt-auto flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
            <span className="inline-flex items-center gap-1 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              <Sparkles size={11} /> Open
            </span>
          </div>
        </div>
      </m.div>

      {/* Mobile bottom sheet (long-press / kebab on small screens) */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm sm:hidden"
              onClick={() => setSheetOpen(false)}
            />
            <m.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className="fixed left-0 right-0 bottom-0 z-50 sm:hidden"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <div className="glass-strong rounded-t-3xl border-t border-border overflow-hidden">
                <div className="flex justify-center pt-3 pb-1">
                  <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
                </div>
                <div className="px-5 pt-3 pb-2 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Project</div>
                    <div className="font-semibold truncate">{project.name}</div>
                  </div>
                  <button
                    onClick={() => setSheetOpen(false)}
                    className="p-2 -m-2 text-muted-foreground hover:text-foreground"
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="p-2">
                  <ActionRow icon={<ExternalLink size={18} />} label="Open" onClick={() => { setSheetOpen(false); haptic("light"); onOpen(); }} />
                  {onEdit && <ActionRow icon={<Pencil size={18} />} label="Rename / Edit" onClick={() => { setSheetOpen(false); haptic("light"); onEdit(); }} />}
                  {onCopyLink && <ActionRow icon={<Copy size={18} />} label="Copy link" onClick={() => { setSheetOpen(false); haptic("light"); onCopyLink(); }} />}
                  <ActionRow icon={<Trash2 size={18} />} label="Delete project" destructive onClick={() => { setSheetOpen(false); haptic("warning"); onDelete(); }} />
                </div>
              </div>
            </m.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

const MenuItem = ({
  icon, label, onClick, destructive,
}: { icon: React.ReactNode; label: string; onClick: () => void; destructive?: boolean }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm font-medium transition-colors ${
      destructive ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-muted"
    }`}
  >
    <span className={destructive ? "text-destructive" : "text-muted-foreground"}>{icon}</span>
    {label}
  </button>
);

const ActionRow = ({
  icon, label, onClick, destructive,
}: { icon: React.ReactNode; label: string; onClick: () => void; destructive?: boolean }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left text-[15px] font-medium transition-colors active:scale-[0.98] ${
      destructive ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-muted"
    }`}
  >
    <span className={destructive ? "text-destructive" : "text-muted-foreground"}>{icon}</span>
    {label}
  </button>
);
