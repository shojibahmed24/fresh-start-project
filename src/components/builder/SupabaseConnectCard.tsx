import { useState } from "react";
import { m } from "framer-motion";
import { Database, Sparkles, ShieldCheck, Loader2, ExternalLink, Check } from "lucide-react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  useSupabaseIntegration,
  type SupabaseProjectInfo,
} from "@/hooks/useSupabaseIntegration";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * Inline "Connect Supabase" card rendered inside chat replies whenever the
 * agent emits the `[[supabase-connect]]` marker. It lets the user kick off
 * the OAuth + project-link flow without leaving the conversation, and
 * explains in plain language WHY backend connection is needed.
 *
 * If the project is already linked, the card collapses to a compact
 * "Already connected" pill so the marker stays harmless on re-renders.
 */
export const SupabaseConnectCard = () => {
  const { id: projectId } = useParams();
  const {
    connection,
    link,
    loading,
    startConnect,
    listSupabaseProjects,
    linkProject,
  } = useSupabaseIntegration(projectId);

  const [connecting, setConnecting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [projects, setProjects] = useState<SupabaseProjectInfo[]>([]);
  const [linking, setLinking] = useState<string | null>(null);

  // Already linked? → tiny success pill.
  if (link?.supabase_project_ref) {
    return (
      <m.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="my-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400"
      >
        <Check size={14} />
        Connected to {link.supabase_project_name || link.supabase_project_ref}
      </m.div>
    );
  }

  const openPicker = async () => {
    if (!projectId) return;
    setPickerLoading(true);
    try {
      const data = await listSupabaseProjects();
      setProjects(data.projects ?? []);
      setPickerOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't load your Supabase projects");
    } finally {
      setPickerLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!projectId) {
      toast.error("Open a project first");
      return;
    }
    setConnecting(true);
    try {
      if (!connection || connection.revoked) {
        await startConnect(`/dashboard/${projectId}`);
        toast.success("Supabase account connected");
      }
      await openPicker();
    } catch (e: any) {
      toast.error(e?.message || "Connect failed");
    } finally {
      setConnecting(false);
    }
  };

  const handleLink = async (p: SupabaseProjectInfo) => {
    setLinking(p.id);
    try {
      await linkProject({
        supabase_project_ref: p.id,
        supabase_project_name: p.name,
        supabase_org_id: p.organization_id,
        supabase_region: p.region,
      });
      toast.success(`${p.name} linked — your app now uses YOUR Supabase`);
      setPickerOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Link failed");
    } finally {
      setLinking(null);
    }
  };

  return (
    <>
      <m.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="my-3 overflow-hidden rounded-2xl border border-primary/30 bg-[linear-gradient(135deg,hsl(var(--primary)/0.10),hsl(var(--accent-cyan)/0.06))] shadow-[0_8px_28px_-12px_hsl(var(--primary)/0.45)]"
      >
        <div className="flex items-start gap-3 p-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/20 text-primary ring-1 ring-primary/30">
            <Database size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-foreground">
                Connect your Supabase to power this app
              </h4>
              <Badge variant="outline" className="h-5 border-primary/40 px-1.5 text-[10px] font-medium text-primary">
                Required
              </Badge>
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[hsl(var(--foreground-muted))]">
              Login, signup, saved data, and admin roles need a real database.
              Connect once — your generated app will use <b>your own</b> Supabase
              project, not a shared one.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 px-4 sm:grid-cols-3">
          <Step n={1} icon={<Sparkles size={13} />} title="Sign in" desc="Authorize Supabase via OAuth (one click)." />
          <Step n={2} icon={<Database size={13} />} title="Pick a project" desc="Choose any project from your account." />
          <Step n={3} icon={<ShieldCheck size={13} />} title="Done" desc="I'll wire login + tables in the next turn." />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-primary/15 bg-background/40 px-4 py-3">
          <Button
            size="sm"
            onClick={handleConnect}
            disabled={connecting || loading || pickerLoading}
            className="gap-2"
          >
            {connecting || pickerLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Connecting…
              </>
            ) : connection && !connection.revoked ? (
              <>
                <Database size={14} />
                Pick a project
              </>
            ) : (
              <>
                <Database size={14} />
                Connect Supabase
              </>
            )}
          </Button>
          <a
            href="https://supabase.com/dashboard/projects"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[hsl(var(--foreground-muted))] hover:text-primary"
          >
            No account? Create one <ExternalLink size={11} />
          </a>
        </div>
      </m.div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pick a Supabase project</DialogTitle>
            <DialogDescription>
              Your generated app will read &amp; write to this project.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-2">
            <div className="space-y-1.5">
              {projects.length === 0 && (
                <p className="py-6 text-center text-xs text-[hsl(var(--foreground-muted))]">
                  No projects found. Create one in the Supabase dashboard, then refresh.
                </p>
              )}
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleLink(p)}
                  disabled={linking !== null}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card/60 p-2.5 text-left transition hover:border-primary/40 hover:bg-card disabled:opacity-50"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{p.name}</div>
                    <div className="truncate text-[11px] text-[hsl(var(--foreground-muted))]">
                      {p.region} · {p.id}
                    </div>
                  </div>
                  {linking === p.id ? (
                    <Loader2 size={14} className="animate-spin text-primary" />
                  ) : (
                    <span className="text-[11px] font-medium text-primary">Link →</span>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

const Step = ({
  n,
  icon,
  title,
  desc,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) => (
  <div className="rounded-lg border border-border/60 bg-background/40 p-2.5">
    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-primary">
      <span className="grid size-4 place-items-center rounded-full bg-primary/20">{n}</span>
      {icon}
      {title}
    </div>
    <p className="text-[11px] leading-snug text-[hsl(var(--foreground-muted))]">{desc}</p>
  </div>
);
