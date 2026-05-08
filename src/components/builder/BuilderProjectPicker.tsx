import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { m } from "framer-motion";
import { ArrowLeft, FolderOpen, Plus, Sparkles, Loader2, Clock, Pin, PinOff } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/UserMenu";
import { listProjects, setProjectPinned, type Project } from "@/lib/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Shown at /dashboard when no project id is in the URL — lets the user pick
// one of their existing projects to open in the workspace, or jump to the
// projects list to create / manage them.
export const BuilderProjectPicker = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[] | null>(null);

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch((e) => {
        toast.error(e.message);
        setProjects([]);
      });
  }, []);

  const togglePin = async (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    e.preventDefault();
    const next = !p.pinned;
    // Optimistic: update + resort (pinned first, then by updatedAt desc).
    setProjects((prev) =>
      (prev ?? [])
        .map((x) => (x.id === p.id ? { ...x, pinned: next } : x))
        .sort((a, b) => {
          if (!!b.pinned !== !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
          return b.updatedAt - a.updatedAt;
        }),
    );
    try {
      await setProjectPinned(p.id, next);
      toast.success(next ? "Pinned to top" : "Unpinned");
    } catch (err: any) {
      toast.error(err?.message || "Could not update pin");
      // Roll back.
      setProjects((prev) =>
        (prev ?? []).map((x) => (x.id === p.id ? { ...x, pinned: !next } : x)),
      );
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* Header */}
      <header className="glass-strong border-b border-border pt-safe">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              to="/projects"
              className="p-1.5 rounded-md text-[hsl(var(--foreground-muted))] hover:text-foreground hover:bg-[hsl(0_0%_100%/0.06)] transition-colors"
              aria-label="Back to projects"
            >
              <ArrowLeft size={18} />
            </Link>
            <Logo size="sm" />
            <span className="hidden sm:inline-block h-4 w-px bg-[hsl(0_0%_100%/0.08)] mx-1" />
            <span className="hidden sm:inline text-sm font-medium text-[hsl(var(--foreground-muted))]">
              Open a project
            </span>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Hero */}
        <m.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-center mb-8"
        >
          <div className="relative inline-flex mb-4">
            <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full" />
            <div className="relative size-14 rounded-2xl flex items-center justify-center bg-gradient-primary border border-primary/40 shadow-[0_0_32px_-4px_hsl(var(--primary)/0.5)]">
              <Sparkles size={22} className="text-background" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1.5">
            Pick a project to continue
          </h1>
          <p className="text-sm text-[hsl(var(--foreground-muted))]">
            Or open the projects list to start a new one.
          </p>
        </m.div>

        {/* Quick actions */}
        <div className="flex flex-col sm:flex-row gap-2 mb-6">
          <Link to="/projects" className="flex-1">
            <Button variant="primary" className="w-full h-11">
              <Plus size={15} className="mr-2" />
              New project
            </Button>
          </Link>
          <Link to="/projects" className="flex-1">
            <Button variant="secondary" className="w-full h-11">
              <ArrowLeft size={15} className="mr-2" />
              All projects
            </Button>
          </Link>
        </div>

        {/* Projects list */}
        <div className="rounded-2xl border border-[hsl(0_0%_100%/0.08)] bg-[hsl(var(--bg-muted))] overflow-hidden">
          <div className="px-4 py-3 border-b border-[hsl(0_0%_100%/0.06)] flex items-center gap-2">
            <FolderOpen size={14} className="text-primary" />
            <span className="text-[12.5px] font-semibold tracking-wide uppercase text-[hsl(var(--foreground-muted))]">
              Your projects
            </span>
            {projects && (
              <span className="ml-auto text-[11px] font-mono text-[hsl(var(--foreground-subtle))]">
                {projects.length}
              </span>
            )}
          </div>

          {projects === null ? (
            <div className="px-4 py-10 flex items-center justify-center gap-2 text-sm text-[hsl(var(--foreground-muted))]">
              <Loader2 className="size-4 animate-spin" />
              Loading projects…
            </div>
          ) : projects.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <div className="mx-auto size-12 rounded-xl bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.06)] flex items-center justify-center mb-3">
                <FolderOpen size={20} className="text-[hsl(var(--foreground-subtle))]" />
              </div>
              <h3 className="text-sm font-semibold mb-1">No projects yet</h3>
              <p className="text-[12.5px] text-[hsl(var(--foreground-muted))] mb-4">
                Create your first one from the projects page.
              </p>
              <Button size="sm" onClick={() => navigate("/projects")}>
                <Plus size={13} className="mr-1.5" /> Go to projects
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-[hsl(0_0%_100%/0.05)]">
              {projects.map((p, i) => (
                <m.li
                  key={p.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: i * 0.025 }}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/dashboard/${p.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/dashboard/${p.id}`);
                      }
                    }}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[hsl(0_0%_100%/0.04)] active:bg-[hsl(0_0%_100%/0.06)] transition-colors group min-h-[60px] cursor-pointer outline-none focus-visible:bg-[hsl(0_0%_100%/0.06)]"
                  >
                    <div className="size-9 rounded-lg bg-gradient-primary-soft border border-primary/20 flex items-center justify-center shrink-0 group-hover:border-primary/40 transition-colors relative">
                      <FolderOpen size={15} className="text-primary" />
                      {p.pinned && (
                        <span
                          className="absolute -top-1 -right-1 size-3.5 rounded-full bg-primary border border-background flex items-center justify-center"
                          aria-hidden
                        >
                          <Pin size={8} className="text-background" />
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium text-foreground truncate flex items-center gap-1.5">
                        {p.name}
                      </div>
                      {p.description && (
                        <div className="text-[12px] text-[hsl(var(--foreground-muted))] truncate">
                          {p.description}
                        </div>
                      )}
                    </div>
                    <div className="hidden sm:flex items-center gap-1 text-[11px] text-[hsl(var(--foreground-subtle))] shrink-0 font-mono">
                      <Clock size={10} />
                      {new Date(p.updatedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => togglePin(e, p)}
                      className={cn(
                        "shrink-0 p-2 rounded-md transition-all",
                        p.pinned
                          ? "text-primary opacity-100 hover:bg-primary/10"
                          : "text-[hsl(var(--foreground-subtle))] opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-[hsl(0_0%_100%/0.06)] focus-visible:opacity-100",
                      )}
                      aria-label={p.pinned ? "Unpin project" : "Pin project"}
                      title={p.pinned ? "Unpin" : "Pin to top"}
                    >
                      {p.pinned ? <Pin size={14} className="fill-current" /> : <PinOff size={14} />}
                    </button>
                  </div>
                </m.li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
};
