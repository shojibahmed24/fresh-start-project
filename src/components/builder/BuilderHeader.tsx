// Builder top header — back link, project name, view tabs, and action buttons
// (Save / Share / Build APK / Publish / UserMenu). Pure presentation; all
// state is passed in via props so it stays trivially testable.

import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileCode, Eye, Share2, Rocket, Save, Smartphone, FolderOpen, Database, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { UserMenu } from "@/components/UserMenu";
import { ModelSettingsMenu } from "@/components/builder/ModelSettingsMenu";
import { toast } from "sonner";
import type { Project } from "@/lib/store";

// Heavy dialogs — pulled in only when the user actually opens them. Saves
// QR code lib + framer-heavy UI from the initial Builder bundle.
const BuildAPKDialog = lazy(() =>
  import("@/components/builder/BuildAPKDialog").then((m) => ({ default: m.BuildAPKDialog })),
);
const BuildPWADialog = lazy(() =>
  import("@/components/builder/BuildPWADialog").then((m) => ({ default: m.BuildPWADialog })),
);

type RightView = "preview" | "code" | "cloud";

type Props = {
  project: Project;
  rightView: RightView;
  setRightView: (v: RightView) => void;
  loading: boolean;
  buildDialogOpen: boolean;
  setBuildDialogOpen: (open: boolean) => void;
  // Optional: when present, the BuildAPKDialog re-binds to this build instead
  // of resetting on close. Lets the floating BuildLiveBadge reopen the dialog
  // for an in-flight build.
  activeBuildId?: string | null;
  onBuildIdChange?: (id: string | null) => void;
};

export const BuilderHeader = ({
  project,
  rightView,
  setRightView,
  loading,
  buildDialogOpen,
  setBuildDialogOpen,
  activeBuildId,
  onBuildIdChange,
}: Props) => {
  const [pwaDialogOpen, setPwaDialogOpen] = useState(false);
  return (
    <header
      className="glass-nav h-12 md:h-12 flex items-center justify-between px-2 md:px-3 shrink-0 z-20 gap-2 pt-safe"
      style={{
        paddingLeft: "max(0.5rem, env(safe-area-inset-left))",
        paddingRight: "max(0.5rem, env(safe-area-inset-right))",
      }}
    >
      <div className="flex items-center gap-1.5 md:gap-2 min-w-0 flex-1">
        <Link
          to="/projects"
          className="text-[hsl(var(--foreground-muted))] hover:text-foreground p-1.5 rounded-md hover:bg-[hsl(0_0%_100%/0.06)] transition-colors shrink-0"
          aria-label="Back to projects"
          title="Back to all projects"
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="hidden md:flex items-center gap-2 min-w-0">
          <Logo size="sm" />
          <div className="h-4 w-px bg-[hsl(0_0%_100%/0.08)] mx-1" />
        </div>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[hsl(var(--foreground-muted))] hover:text-foreground hover:bg-[hsl(0_0%_100%/0.06)] transition-colors shrink-0 text-[12px] font-medium"
          aria-label="All projects"
          title="All projects"
        >
          <FolderOpen size={14} />
          <span className="hidden sm:inline">Projects</span>
        </Link>
        <div className="text-[13px] md:text-sm font-medium truncate flex-1 md:max-w-[200px] md:flex-initial text-foreground">
          {project.name}
        </div>
        <span className="text-[10px] font-mono text-[hsl(var(--foreground-subtle))] hidden md:inline ml-2">
          {project.files.length} files
        </span>
      </div>

      <div className="hidden md:flex items-center gap-0.5 p-0.5 bg-[hsl(var(--bg-muted))] border border-[hsl(0_0%_100%/0.06)] rounded-md">
        {(
          [
            { key: "code" as const, icon: FileCode, label: "Code" },
            { key: "preview" as const, icon: Eye, label: "Preview" },
            { key: "cloud" as const, icon: Database, label: "Cloud" },
          ]
        ).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setRightView(key)}
            className={`px-2.5 py-1 text-xs font-medium rounded flex items-center gap-1.5 transition-colors duration-150 ${
              rightView === key
                ? "bg-[hsl(var(--bg-elevated))] text-foreground shadow-xs"
                : "text-[hsl(var(--foreground-muted))] hover:text-foreground"
            }`}
          >
            <Icon size={11} /> {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          leftIcon={<Save size={13} />}
          className="hidden lg:inline-flex h-8"
          disabled={loading || !project}
          onClick={() => {
            if (loading) return;
            toast.success("All changes saved", {
              description: "Your project is auto-saved as you build.",
            });
          }}
          title={loading ? "Saving…" : "All changes saved automatically"}
        >
          <span className="text-xs">{loading ? "Saving…" : "Saved"}</span>
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="h-8 px-2 md:px-3"
          disabled={!project}
          onClick={async () => {
            const url = `${window.location.origin}/dashboard/${project.id}`;
            try {
              if (navigator.share) {
                await navigator.share({ title: project.name || "My project", url });
              } else {
                await navigator.clipboard.writeText(url);
                toast.success("Project link copied", { description: url });
              }
            } catch (err: any) {
              if (err?.name !== "AbortError") {
                try {
                  await navigator.clipboard.writeText(url);
                  toast.success("Project link copied", { description: url });
                } catch {
                  toast.error("Could not share link");
                }
              }
            }
          }}
          title="Share project link"
        >
          <Share2 size={13} />
          <span className="hidden md:inline text-xs ml-1.5">Share</span>
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="h-8 px-2 md:px-3"
          disabled={!project}
          onClick={() => setBuildDialogOpen(true)}
          title="Build Android APK"
        >
          <Smartphone size={13} />
          <span className="hidden md:inline text-xs ml-1.5">Build APK</span>
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="h-8 px-2 md:px-3"
          disabled={!project || project.files.length === 0}
          onClick={() => setPwaDialogOpen(true)}
          title="Export as installable PWA"
        >
          <Globe size={13} />
          <span className="hidden md:inline text-xs ml-1.5">PWA</span>
        </Button>
        <Button
          size="sm"
          variant="primary"
          className="h-8 px-2 md:px-3"
          disabled={!project || project.files.length === 0}
          onClick={() => {
            toast.info("Publish your app", {
              description:
                "Click the Publish button at the top-right of the editor to deploy your app to a live URL.",
              duration: 6000,
            });
          }}
          title="Publish to a live URL"
        >
          <Rocket size={13} />
          <span className="hidden md:inline text-xs ml-1.5">Publish</span>
        </Button>
        <ModelSettingsMenu />
        <UserMenu variant="compact" />
        {buildDialogOpen && (
          <Suspense fallback={null}>
            <BuildAPKDialog
              open={buildDialogOpen}
              onOpenChange={setBuildDialogOpen}
              projectId={project.id}
              initialBuildId={activeBuildId ?? null}
              onBuildIdChange={onBuildIdChange}
            />
          </Suspense>
        )}
        {pwaDialogOpen && (
          <Suspense fallback={null}>
            <BuildPWADialog
              open={pwaDialogOpen}
              onOpenChange={setPwaDialogOpen}
              project={project}
            />
          </Suspense>
        )}
      </div>
    </header>
  );
};
