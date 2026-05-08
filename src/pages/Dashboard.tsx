import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ArrowLeft, FolderKanban, Coins, Hammer, Clock, LayoutGrid } from "lucide-react";
import { Link } from "react-router-dom";
import { m } from "framer-motion";
import { Logo } from "@/components/Logo";
import { UserMenu } from "@/components/UserMenu";
import { NotificationBell } from "@/components/NotificationBell";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createProject, deleteProject, listProjects, updateProject, type Project } from "@/lib/store";
import { type Template } from "@/lib/templates";
import { pickRandomPreset, renderPresetForPrompt } from "@/lib/themePresets";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { useProfile } from "@/hooks/useProfile";
import { ProjectCard } from "@/components/ProjectCard";
import { haptic } from "@/lib/haptics";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/dashboard/StatCard";
import { TemplateGallery } from "@/components/dashboard/TemplateGallery";
import { EmptyProjectsState } from "@/components/dashboard/EmptyProjectsState";
import { RecentActivityTimeline } from "@/components/dashboard/RecentActivityTimeline";
import { celebrate } from "@/lib/celebrate";
import { generateProjectName } from "@/lib/projectNaming";

const Dashboard = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [editing, setEditing] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [buildsCount, setBuildsCount] = useState(0);
  const [buildsTrend, setBuildsTrend] = useState<number[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { balance } = useCredits();
  const { profile } = useProfile();
  const firstName = (profile?.display_name?.trim().split(/\s+/)[0]
    || user?.email?.split("@")[0]
    || "there");

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) listProjects().then(setProjects).catch((e) => toast.error(e.message));
  }, [user]);

  // Fetch the user's recent builds — used by the "Apps built" stat card and its sparkline.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
      const { data, count } = await supabase
        .from("app_builds")
        .select("created_at, status", { count: "exact" })
        .eq("user_id", user.id)
        .gte("created_at", since)
        .order("created_at", { ascending: true });
      setBuildsCount(count ?? 0);
      // Bucket builds into 14 daily counts for the sparkline.
      const buckets = new Array(14).fill(0);
      const dayMs = 86_400_000;
      const start = Date.now() - 14 * dayMs;
      (data ?? []).forEach((b) => {
        const idx = Math.min(13, Math.max(0, Math.floor((new Date(b.created_at).getTime() - start) / dayMs)));
        buckets[idx]++;
      });
      setBuildsTrend(buckets);
    })();
  }, [user]);

  // Derived sparkline for the "Total projects" card — count by day over last 14d.
  const projectsTrend = useMemo(() => {
    const buckets = new Array(14).fill(0);
    const dayMs = 86_400_000;
    const start = Date.now() - 14 * dayMs;
    projects.forEach((p) => {
      const idx = Math.floor((p.createdAt - start) / dayMs);
      if (idx >= 0 && idx < 14) buckets[idx]++;
    });
    return buckets;
  }, [projects]);

  // "Last active" — relative time from the most recently updated project.
  const lastActive = useMemo(() => {
    if (projects.length === 0) return { value: "—", caption: "No activity yet" };
    const latest = Math.max(...projects.map((p) => p.updatedAt));
    const diff = Date.now() - latest;
    const m = Math.floor(diff / 60_000);
    if (m < 1) return { value: "now", caption: "Just now" };
    if (m < 60) return { value: `${m}m`, caption: "ago" };
    const h = Math.floor(m / 60);
    if (h < 24) return { value: `${h}h`, caption: "ago" };
    const d = Math.floor(h / 24);
    return { value: `${d}d`, caption: "ago" };
  }, [projects]);

  const openWithTemplate = (tpl: Template | null) => {
    setSelectedTemplate(tpl);
    setName(tpl?.defaultName ?? "");
    setDesc(tpl?.defaultDescription ?? "");
    setTemplatesOpen(false);
    setOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      // Local heuristic only — AI naming removed.
      const cleanName = generateProjectName(name.trim());
      const p = await createProject(cleanName, desc.trim());
      celebrate("project");
      setOpen(false);
      let prompt = selectedTemplate?.starterPrompt;
      if (prompt && selectedTemplate) {
        // Inject a fully randomized theme preset so two users picking the
        // same template don't end up with visually identical apps.
        const preset = pickRandomPreset();
        console.log(`[template] ${selectedTemplate.id} → preset: ${preset.name}`);
        prompt = `${renderPresetForPrompt(preset)}\n\n---\n\n${prompt}`;
      }
      setSelectedTemplate(null);
      setName("");
      setDesc("");
      navigate(`/dashboard/${p.id}`, prompt ? { state: { autoPrompt: prompt } } : undefined);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      toast.success("Project deleted");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const openEdit = (p: Project) => {
    setEditing(p);
    setEditName(p.name);
    setEditDesc(p.description ?? "");
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editName.trim()) return;
    setEditBusy(true);
    try {
      await updateProject(editing.id, { name: editName.trim(), description: editDesc.trim() });
      setProjects((prev) =>
        prev.map((p) => (p.id === editing.id ? { ...p, name: editName.trim(), description: editDesc.trim() } : p))
      );
      toast.success("Project updated");
      setEditing(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setEditBusy(false);
    }
  };

  if (loading) return <div className="min-h-[100dvh] flex items-center justify-center text-muted-foreground">Loading...</div>;

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-10 backdrop-blur-2xl bg-background/80 border-b border-border/60 shadow-[0_2px_24px_-12px_hsl(var(--primary)/0.35)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Back to home — icon-only on mobile */}
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground p-2 -ml-2 rounded-md hover:bg-muted transition shrink-0"
              aria-label="Home"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Home</span>
            </Link>

            {/* Mobile: page title only — no logo / divider clutter */}
            <h1 className="sm:hidden text-[15px] font-semibold tracking-tight truncate">
              Dashboard
            </h1>

            {/* Desktop: divider + logo + breadcrumbs */}
            <div className="hidden sm:flex items-center gap-3 min-w-0">
              <div className="h-5 w-px bg-border" />
              <Logo size="sm" />
              <div className="hidden md:block ml-2">
                <Breadcrumbs />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Templates menu — opens a gallery sheet/dialog. Lives in the header
                so the projects section below stays clean and focused. */}
            <button
              onClick={() => { haptic("light"); setTemplatesOpen(true); }}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border/60 transition"
              aria-label="Browse templates"
            >
              <LayoutGrid size={15} />
              <span className="hidden sm:inline">Templates</span>
            </button>
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8 pb-28 sm:pb-20">
        {/* Page header — compact one-liner on mobile, full greeting on desktop */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5 sm:mb-6">
          <div className="min-w-0">
            {/* Mobile: single line, no paragraph */}
            <h2 className="sm:hidden text-xl font-bold tracking-tight truncate">
              Hi, {firstName} <span className="inline-block">👋</span>
            </h2>

            {/* Desktop: full greeting + helper */}
            <h2 className="hidden sm:block text-2xl sm:text-3xl font-bold tracking-tight">
              Welcome back 👋
            </h2>
            <p className="hidden sm:block text-sm sm:text-base text-muted-foreground mt-1">
              Here's a snapshot of your workspace.
            </p>
          </div>

          {/* Desktop "New project" button — mobile uses FAB below */}
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSelectedTemplate(null); }}>
            <DialogTrigger asChild>
              <Button
                onClick={() => openWithTemplate(null)}
                className="hidden sm:inline-flex w-full sm:w-auto h-11 bg-gradient-primary text-primary-foreground shadow-glow"
              >
                <Plus size={16} className="mr-2" /> New project
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-strong w-[calc(100vw-2rem)] sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle>
                  {selectedTemplate ? (
                    <span className="flex items-center gap-2">
                      <span className="text-2xl">{selectedTemplate.emoji}</span>
                      Create {selectedTemplate.name} app
                    </span>
                  ) : (
                    "Create new project"
                  )}
                </DialogTitle>
              </DialogHeader>
              {selectedTemplate && (
                <div className={`rounded-xl p-3 bg-gradient-to-r ${selectedTemplate.gradient} text-white text-sm`}>
                  <div className="font-semibold mb-1">{selectedTemplate.tagline}</div>
                  <div className="text-white/80 text-xs line-clamp-2">{selectedTemplate.starterPrompt}</div>
                </div>
              )}
              <form onSubmit={handleCreate} className="space-y-4 mt-2">
                <Input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} required className="h-11" />
                <Textarea placeholder="What are you building? (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} />
                <Button type="submit" disabled={busy} className="w-full h-11 bg-gradient-primary text-primary-foreground">
                  {busy ? "Creating..." : selectedTemplate ? `Create & auto-build ${selectedTemplate.name}` : "Create & open builder"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats hero
            Mobile: horizontal snap-scroll carousel (iOS Wallet/Health pattern) — one prominent
            card visible at a time, swipe for the rest. Desktop: 4-up grid as before. */}
        <div className="mb-8">
          {/* Mobile carousel */}
          <div className="sm:hidden -mx-4 px-4">
            <div
              className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              role="list"
              aria-label="Workspace stats"
            >
              {[
                { label: "Total projects", value: projects.length, icon: <FolderKanban size={16} />, spark: projectsTrend, gradient: "from-violet-500/25 to-fuchsia-500/10", caption: projects.length === 0 ? "Start your first" : "Last 14 days" },
                { label: "Credits left", value: balance, icon: <Coins size={16} />, gradient: "from-amber-500/25 to-orange-500/10", caption: "Top up in Shop" },
                { label: "Apps built", value: buildsCount, icon: <Hammer size={16} />, spark: buildsTrend, gradient: "from-cyan-500/25 to-sky-500/10", caption: "Last 14 days" },
                { label: "Last active", value: lastActive.value, icon: <Clock size={16} />, gradient: "from-emerald-500/25 to-teal-500/10", caption: lastActive.caption },
              ].map((s, i) => (
                <div
                  key={s.label}
                  role="listitem"
                  className="snap-start shrink-0 w-[78%] first:ml-0"
                >
                  <StatCard {...s} delay={i * 0.05} />
                </div>
              ))}
            </div>
          </div>

          {/* Desktop grid */}
          <div className="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total projects"
              value={projects.length}
              icon={<FolderKanban size={16} />}
              spark={projectsTrend}
              gradient="from-violet-500/25 to-fuchsia-500/10"
              caption={projects.length === 0 ? "Start your first" : "Last 14 days"}
              delay={0.0}
            />
            <StatCard
              label="Credits left"
              value={balance}
              icon={<Coins size={16} />}
              gradient="from-amber-500/25 to-orange-500/10"
              caption="Top up in Shop"
              delay={0.05}
            />
            <StatCard
              label="Apps built"
              value={buildsCount}
              icon={<Hammer size={16} />}
              spark={buildsTrend}
              gradient="from-cyan-500/25 to-sky-500/10"
              caption="Last 14 days"
              delay={0.1}
            />
            <StatCard
              label="Last active"
              value={lastActive.value}
              icon={<Clock size={16} />}
              gradient="from-emerald-500/25 to-teal-500/10"
              caption={lastActive.caption}
              delay={0.15}
            />
          </div>
        </div>

        {/* 2-column layout: main + activity timeline */}
        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-6">
          <div className="min-w-0">
            {/* Projects header — Templates moved to the header menu */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg sm:text-xl font-bold">Your projects</h2>
              {projects.length > 0 && (
                <span className="text-xs text-muted-foreground">{projects.length} total</span>
              )}
            </div>

            {projects.length === 0 ? (
              <EmptyProjectsState onCreate={() => openWithTemplate(null)} />
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {projects.map((p, i) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    index={i}
                    onOpen={() => navigate(`/dashboard/${p.id}`)}
                    onDelete={() => handleDelete(p.id)}
                    onEdit={() => openEdit(p)}
                    onCopyLink={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/dashboard/${p.id}`);
                      haptic("success");
                      toast.success("Link copied");
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right rail — recent activity timeline (desktop only) */}
          <div className="hidden lg:block">
            <RecentActivityTimeline projects={projects} onCreate={() => openWithTemplate(null)} />
          </div>
        </div>
      </main>

      {/* Edit project dialog — rename + update description */}
      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}>
        <DialogContent className="glass-strong w-[calc(100vw-2rem)] sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSave} className="space-y-4 mt-2">
            <Input
              placeholder="Project name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
              className="h-11"
            />
            <Textarea
              placeholder="Description (optional)"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditing(null)}
                className="flex-1 h-11"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={editBusy}
                className="flex-1 h-11 bg-gradient-primary text-primary-foreground"
              >
                {editBusy ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Templates gallery dialog — opens from the header "Templates" button.
          Picking a template closes this and opens the create-project dialog. */}
      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent className="glass-strong w-[calc(100vw-1.5rem)] sm:max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Templates</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <TemplateGallery onPick={openWithTemplate} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile FAB — primary "New project" action in thumb zone.
          Hidden on sm+ where the header button is shown instead. */}
      <m.button
        type="button"
        aria-label="New project"
        onClick={() => { haptic("light"); openWithTemplate(null); }}
        initial={{ opacity: 0, scale: 0.6, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 360, damping: 22, delay: 0.2 }}
        whileTap={{ scale: 0.92 }}
        className="sm:hidden fixed right-4 z-40 inline-flex items-center gap-2 h-14 pl-4 pr-5 rounded-full bg-gradient-primary text-primary-foreground font-semibold shadow-[0_12px_32px_-8px_hsl(var(--primary)/0.65)] active:shadow-[0_6px_16px_-4px_hsl(var(--primary)/0.6)]"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
      >
        <Plus size={20} strokeWidth={2.5} />
        <span className="text-[14px]">New project</span>
      </m.button>
    </div>
  );
};

export default Dashboard;
