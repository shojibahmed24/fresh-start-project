import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { m, AnimatePresence } from "framer-motion";
import { Eye, MessageSquare } from "lucide-react";
import { SupabaseCloudPanel } from "@/components/builder/SupabaseCloudPanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { NetworkStatusBanner } from "@/components/NetworkStatusBanner";
import { ChatPanel } from "@/components/builder/ChatPanel";
import { FileTree } from "@/components/builder/FileTree";
import { MobileFileTreeDrawer } from "@/components/builder/MobileFileTreeDrawer";
import { CodeEditor } from "@/components/builder/CodeEditor";
import { BuilderHeader } from "@/components/builder/BuilderHeader";
import { BuildLiveBadge } from "@/components/builder/BuildLiveBadge";
import { useActiveBuild } from "@/hooks/useAppBuilds";
import { BuilderMobileNav, type MobileView } from "@/components/builder/BuilderMobileNav";
import { MobilePreviewPill } from "@/components/builder/MobilePreviewPill";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import {
  loadProject,
  deleteMessage,
  branchProject,
  type Project,
  type ChatMessage,
  type ProjectFile,
} from "@/lib/store";
import {
  RenameFileDialog,
  DeleteFileDialog,
  NewFileDialog,
} from "@/components/builder/FileDialogs";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { haptic } from "@/lib/haptics";
import { useBuilderHeal } from "@/hooks/useBuilderHeal";
import { useBuilderAgent } from "@/hooks/useBuilderAgent";
import { useBuilderFileOps } from "@/hooks/useBuilderFileOps";
import { useBuilderUndo } from "@/hooks/useBuilderUndo";
import { streamPlanChat } from "@/lib/planChat";
import { addMessage as persistMessage } from "@/lib/store";
import { useProfile } from "@/hooks/useProfile";

type RightView = "preview" | "code" | "cloud";
const MOBILE_TABS: MobileView[] = ["chat", "code", "preview"];

const LazyPreviewPanel = lazy(() =>
  import("@/components/builder/PreviewPanel").then((module) => ({ default: module.PreviewPanel })),
);

const WorkspaceLoader = ({ label }: { label: string }) => {
  // After 12s without project data, show a soft "still loading" hint with a
  // retry option — so users never get stuck staring at a silent dot.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 12_000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center text-[hsl(var(--foreground-muted))] gap-3 font-mono text-sm px-6 text-center">
      <div className="flex items-center gap-2">
        <div className="size-2 rounded-full bg-primary animate-pulse" />
        {label}
      </div>
      {slow && (
        <div className="space-y-2 max-w-xs animate-fade-in">
          <p className="text-xs">Taking longer than usual…</p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs px-3 py-1.5 rounded-md bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.08)] hover:bg-[hsl(var(--bg-subtle))] transition"
          >
            Reload workspace
          </button>
        </div>
      )}
    </div>
  );
};


const PreviewFallback = ({ filesReady = false }: { filesReady?: boolean }) => (
  <div className="h-full flex items-center justify-center bg-[hsl(var(--bg-subtle))] px-6">
    <div className="max-w-sm text-center space-y-3">
      <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.06)]">
        <Eye size={20} className="text-primary" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          {filesReady ? "Loading preview…" : "Preview will appear after files are generated"}
        </h3>
        <p className="mt-1 text-xs text-[hsl(var(--foreground-muted))]">
          {filesReady
            ? "Starting the live sandbox only when needed, so the workspace opens faster."
            : "Open chat and start building — the heavy live preview stays unloaded until your app has code to run."}
        </p>
      </div>
    </div>
  </div>
);

const Builder = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { profile, update: updateProfile } = useProfile();
  const isMobile = useIsMobile();
  const network = useNetworkStatus();

  // Chat mode (Agent / Plan) is sourced from the user's DB profile so it
  // syncs across devices. Default = "agent" until profile loads.
  const chatMode: "agent" | "plan" = profile?.chat_mode === "plan" ? "plan" : "agent";
  const handleChatModeChange = useCallback(
    (next: "agent" | "plan") => {
      if (next === chatMode) return;
      void updateProfile({ chat_mode: next }).catch((e) => {
        toast.error(e?.message ?? "Could not save mode preference");
      });
    },
    [chatMode, updateProfile],
  );

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [activePath, setActivePath] = useState<string>("");
  const [rightView, setRightView] = useState<RightView>("preview");
  const [mobileView, setMobileView] = useState<MobileView>("chat");
  const [lastFailed, setLastFailed] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [buildDialogOpen, setBuildDialogOpen] = useState(false);
  // Tracks the currently in-flight APK build so the floating BuildLiveBadge
  // can stay visible after the dialog is closed. Seeded from the DB on mount
  // (so a page reload mid-build still shows progress) and kept in sync by
  // BuildAPKDialog via onBuildIdChange.
  const [activeBuildId, setActiveBuildId] = useState<string | null>(null);
  const [badgeDismissed, setBadgeDismissed] = useState(false);

  // Mobile "View preview" pill — bumps when files change OR a generation
  // completes, so the user gets a one-tap shortcut to jump from chat to preview.
  const [previewPillTrigger, setPreviewPillTrigger] = useState(0);
  const prevFileCountRef = useRef(0);
  const prevLoadingRef = useRef(false);
  useEffect(() => {
    const fileCount = project?.files.length ?? 0;
    const justFinished = prevLoadingRef.current && !loading;
    const filesGrew = fileCount > prevFileCountRef.current;
    if (filesGrew || justFinished) {
      setPreviewPillTrigger((n) => n + 1);
    }
    prevFileCountRef.current = fileCount;
    prevLoadingRef.current = loading;
  }, [project?.files.length, loading]);

  // Seed activeBuildId from DB so a page reload mid-build still shows the
  // floating progress badge without requiring the user to reopen the dialog.
  const { activeBuild } = useActiveBuild(project?.id ?? null);
  useEffect(() => {
    if (activeBuild?.id && !activeBuildId) {
      setActiveBuildId(activeBuild.id);
      setBadgeDismissed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBuild?.id]);

  const autoPromptFiredRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const projectRef = useRef<Project | null>(null);
  const sendInFlightKeyRef = useRef<string | null>(null);

  // Sync ref synchronously during render so the very first send (before any
  // useEffect has flushed) sees the latest project. Using useEffect here caused
  // the first prompt to silently no-op when handleSend ran before the effect.
  projectRef.current = project;

  // ─── Auth gate ───
  useEffect(() => {
    if (!authLoading && !user) navigate("/auth", { replace: true });
  }, [user, authLoading, navigate]);

  // ─── Bootstrap empty workspace when no project id ───
  useEffect(() => {
    if (id || !user) return;
    setProject((prev) =>
      prev ?? {
        id: "",
        name: "New chat",
        description: "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
        files: [],
        plan: null,
      },
    );
  }, [id, user]);

  // ─── Agent runtime (separate hook) ───
  const agent = useBuilderAgent({
    project,
    setProject,
    projectRef,
    navigate,
    setActivePath,
    setRightView,
    setMobileView,
    isMobile,
    online: network.online,
    setLoading,
    abortRef,
    onBuildResume: (wrapped) => handleSend(wrapped),
  });

  // ─── Load project + restore agent session ───
  useEffect(() => {
    if (!id || !user) return;
    let cancelled = false;
    loadProject(id)
      .then((p) => {
        if (cancelled) return;
        if (!p) {
          toast.error("Project not found");
          navigate("/projects", { replace: true });
          return;
        }
        setProject(p);
        if (p.files.length > 0) setActivePath(p.files[0].path);
        agent.restoreAgentSession(p.id);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[Builder] loadProject failed:", err);
        toast.error("Couldn't load project. Please try again.");
        navigate("/projects", { replace: true });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user, navigate]);


  // ─── Auto-prompt from navigation state ───
  // Wait until the project is fully loaded AND projectRef is in sync before firing.
  // Capture the prompt locally so a re-render that nukes location.state can't lose it.
  useEffect(() => {
    const state = location.state as { autoPrompt?: string } | null;
    const prompt = state?.autoPrompt;
    if (!prompt || !project || autoPromptFiredRef.current || project.messages.length > 0) return;
    // Ensure the ref is synced with the latest project before handleSend reads it.
    if (projectRef.current?.id !== project.id) return;
    autoPromptFiredRef.current = true;
    // Fire the agent run first, THEN clear the navigation state — otherwise
    // the re-render from navigate() can race with the project snapshot and
    // the very first send silently no-ops. Build mode is retired; landing-page
    // prompts now go through the Agent loop just like in-builder sends.
    Promise.resolve(agent.handleAgent(prompt)).finally(() => {
      navigate(location.pathname, { replace: true, state: null });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.state, navigate, project]);

  const handleStop = () => {
    (window as any).__manualStop = true;
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    toast.info("Generation stopped. Type 'continue' to resume from where it left off.");
  };

  // ─── Regenerate last assistant response ─────────────────────────
  // Strategy: find the user message that immediately preceded the targeted
  // assistant message, drop the assistant message from local state, and
  // re-send the same user prompt to the agent.
  const handleRegenerate = useCallback(
    (messageId: string) => {
      if (loading) return;
      setProject((prev) => {
        if (!prev) return prev;
        const idx = prev.messages.findIndex((m) => m.id === messageId);
        if (idx < 0) return prev;
        const target = prev.messages[idx];
        if (target.role !== "assistant") return prev;
        // Find the user message just before it.
        let userIdx = idx - 1;
        while (userIdx >= 0 && prev.messages[userIdx].role !== "user") userIdx--;
        if (userIdx < 0) return prev;
        const userPrompt = prev.messages[userIdx].content;
        // Remove the assistant message locally + delete from DB (best-effort).
        deleteMessage(target.id).catch(() => {/* ignore */});
        const messages = prev.messages.filter((m) => m.id !== target.id);
        // Re-fire the prompt on the next tick so state has settled.
        setTimeout(() => agent.handleAgent(userPrompt, false, false, []), 0);
        return { ...prev, messages };
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading],
  );

  // ─── Delete a message (with optimistic UI + DB sync) ────────────
  const handleDeleteMessage = useCallback((messageId: string) => {
    setProject((prev) => {
      if (!prev) return prev;
      return { ...prev, messages: prev.messages.filter((m) => m.id !== messageId) };
    });
    deleteMessage(messageId)
      .then(() => toast.success("Message deleted"))
      .catch((e) => toast.error(e?.message || "Could not delete message"));
  }, []);

  // ─── Branch (fork) the conversation from a given message point ──
  // Creates a new project containing all messages up to and including
  // the chosen one, snapshots the current files, and navigates there.
  const handleBranchMessage = useCallback(
    (messageId: string) => {
      const projId = project?.id;
      if (!projId) return;
      const t = toast.loading("Creating branch…");
      branchProject(projId, messageId)
        .then((newId) => {
          toast.dismiss(t);
          toast.success("Branched into a new project");
          navigate(`/dashboard/${newId}`);
        })
        .catch((e) => {
          toast.dismiss(t);
          toast.error(e?.message || "Could not branch project");
        });
    },
    [project?.id, navigate],
  );

  // ─── Auto-heal preview crashes (separate hook) ───
  // Layer-2 healed callback: Claude rewrote a file directly via the
  // `heal-claude` edge function. Splice the new content into local state so
  // the preview reloads without a full re-generation.
  const handleClaudeHealed = useCallback((path: string, content: string) => {
    setProject((prev) => {
      if (!prev) return prev;
      const idx = prev.files.findIndex((f) => f.path === path);
      const updatedFile: ProjectFile = {
        path,
        content,
        updatedAt: Date.now(),
      };
      const files =
        idx === -1
          ? [...prev.files, updatedFile]
          : prev.files.map((f, i) => (i === idx ? updatedFile : f));
      return { ...prev, files, updatedAt: Date.now() };
    });
  }, []);

  const { resetHeal } = useBuilderHeal({
    project,
    loading,
    onHealPrompt: (prompt) => handleSend(prompt),
    onClaudeHealed: handleClaudeHealed,
  });

  // ─── File CRUD (separate hook) ───
  const {
    fileDialog,
    setFileDialog,
    handleFileChange,
    handleFileAction,
    applyFileOp,
  } = useBuilderFileOps({
    project,
    setProject,
    activePath,
    setActivePath,
    onAfterCreate: () => {
      // Mobile: don't yank the user out of chat. They'll switch tabs themselves
      // (or auto-jump to preview when generation completes).
      if (!isMobile) setRightView("code");
    },
  });

  // ─── Undo stack: snapshot files+messages before each agent run ───
  const { pushSnapshot, undo, canUndo, clear: clearUndo } = useBuilderUndo(project, setProject);

  const handleNewChat = useCallback(() => {
    if (loading) {
      toast.info("Wait for the current run to finish before starting a new chat.");
      return;
    }
    haptic("light");
    clearUndo();
    autoPromptFiredRef.current = false;
    navigate("/dashboard", { replace: false });
  }, [loading, navigate, clearUndo]);

  const handleUndo = useCallback(async () => {
    if (loading) {
      toast.info("Can't undo while a run is in progress.");
      return;
    }
    if (!canUndo) return;
    haptic("medium");
    const ok = await undo();
    if (ok) toast.success("Reverted to the previous version.");
    else toast.error("Nothing to undo.");
  }, [loading, canUndo, undo]);

  // Chat mode removed — agent-only.

  // ─── Unified send pipeline (agent-only) ───
  // All entry points (user typed message, resume click, preview heal prompt,
  // offline-queue drain, retry button) funnel through this wrapper. It is
  // responsible for two things only:
  //   1. Offline detection → enqueue for later replay
  //   2. Routing the prompt to the agent loop (`agent.handleAgent`)
  // The agent itself handles project creation, file persistence, retries,
  // self-healing, and abort. All AI work goes through `supabase/functions/ai-agent`.
  const handleSend = async (text: string) => {
    const sendKey = text;
    if (sendInFlightKeyRef.current === sendKey) return;
    sendInFlightKeyRef.current = sendKey;

    try {
      if (!text.startsWith("The live preview crashed")) resetHeal();

      // Offline → queue for auto-replay when the network returns.
      if (!network.online) {
        setQueue((q) => [...q, text]);
        const note: ChatMessage = {
          id: `queued-${Date.now()}`,
          role: "assistant",
          content: `📥 Queued — you're offline. I'll send "${text.slice(0, 60)}${text.length > 60 ? "…" : ""}" as soon as you're back online.`,
          mode: "agent",
          createdAt: Date.now(),
        };
        setProject((prev) =>
          prev
            ? {
                ...prev,
                messages: [
                  ...prev.messages,
                  { id: `user-${Date.now()}`, role: "user", content: text, mode: "agent", createdAt: Date.now() },
                  note,
                ],
              }
            : prev,
        );
        toast.warning("Offline — message queued", {
          description: "It'll send automatically when your connection returns.",
        });
        return;
      }

      // Snapshot current state so the user can undo this turn from the chat header.
      // Skip for self-healing prompts (those are reactive, not user-initiated edits).
      if (!text.startsWith("The live preview crashed")) {
        pushSnapshot();
      }

      // Hand off to the agent. The agent hook owns loading state, file
      // persistence, error toasts, and retry — so we just await it here.
      try {
        await agent.handleAgent(text);
        setLastFailed(null);
      } catch (e: any) {
        if (!navigator.onLine) {
          setQueue((q) => [...q, text]);
          toast.warning("Connection lost — message re-queued for when you're back online.");
        } else {
          toast.error(e?.message || "Agent run failed", {
            action: { label: "Retry", onClick: () => handleSend(text) },
          });
          setLastFailed(text);
        }
      }
    } finally {
      sendInFlightKeyRef.current = null;
    }
  };

  // ─── Drain queued offline messages ───
  useEffect(() => {
    if (!network.online || queue.length === 0 || loading || !project) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    toast.success(`Back online — sending ${rest.length + 1} queued message${rest.length ? "s" : ""}…`);
    handleSend(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, network.online, project, queue]);

  const handleRetry = useCallback(() => {
    if (!lastFailed) return;
    const text = lastFailed;
    setLastFailed(null);
    handleSend(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastFailed]);

  // One-click resume after an interrupted build. Sends a structured prompt
  // that triggers the server-side checkpoint resume path (pending_paths in
  // project_plans) instead of re-planning from scratch.
  const handleResumeBuild = useCallback(() => {
    if (loading) return;
    handleSend("continue from where you stopped");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // File CRUD handlers live in `useBuilderFileOps` (see hook init above).

  if (!project) {
    return <WorkspaceLoader label={authLoading ? "Checking access…" : "Loading workspace…"} />;
  }

  const normalizePath = (p: string) => p.replace(/^\.?\//, "");
  const activeFile = project.files.find((f) => normalizePath(f.path) === normalizePath(activePath)) ?? null;
  const hasProjectFiles = project.files.length > 0;
  const previewNode = hasProjectFiles ? (
    <Suspense fallback={<PreviewFallback filesReady />}>
      <LazyPreviewPanel
        files={project.files}
        appDescription={project.description || project.name}
        onAutoFix={(prompt) => {
          void handleSend(prompt);
        }}
      />
    </Suspense>
  ) : (
    <PreviewFallback />
  );

  // ─── Plan Mode handler ───
  // Discussion-only chat. Streams a reply from the plan-chat edge function
  // (Lovable AI Gateway) into a fresh assistant message. Does NOT touch files,
  // does NOT run tools, does NOT use the agent loop.
  const handlePlanSend = async (text: string) => {
    if (!project) return;
    if (!network.online) {
      toast.warning("Offline — Plan mode needs an internet connection.");
      return;
    }
    const projectId = project.id;
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      mode: "plan",
      createdAt: Date.now(),
    };
    const assistantId = `plan-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      mode: "plan",
      createdAt: Date.now() + 1,
    };
    setProject((prev) =>
      prev ? { ...prev, messages: [...prev.messages, userMsg, assistantMsg] } : prev,
    );
    setLoading(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const history = (project.messages ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    try {
      const full = await streamPlanChat(
        {
          projectId,
          message: text,
          history,
        },
        (delta) => {
          setProject((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              messages: prev.messages.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + delta } : m,
              ),
            };
          });
        },
        ctrl.signal,
      );

      if (projectId) {
        try {
          await persistMessage(projectId, { role: "user", content: text, mode: "plan" });
          await persistMessage(projectId, { role: "assistant", content: full, mode: "plan" });
        } catch {
          /* persistence failure shouldn't break the chat */
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        toast.error(err?.message ?? "Plan mode failed");
        setProject((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === assistantId
                ? { ...m, content: `⚠ ${err?.message ?? "Plan mode failed"}` }
                : m,
            ),
          };
        });
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  // ─── Chat panel send dispatcher ───

  // Two modes:
  //   - "agent" → full ai-agent build loop (writes files, runs tools)
  //   - "plan"  → discussion-only chat (no code, no file changes)
  const handlePanelSend = ({
    text,
    mode,
    attachments,
  }: {
    text: string;
    mode: string;
    attachments: { kind: string; name: string; mime?: string; content: string; size?: number }[];
  }) => {
    // Brief inline summary so the user sees attachments in the conversation,
    // but the actual rich content is forwarded structurally so the agent can
    // run vision / read_attachment / lookup_npm_package on it.
    const summary =
      attachments.length === 0
        ? ""
        : "\n\n---\n**Attachments (" +
          attachments.length +
          "):** " +
          attachments
            .map((a) => (a.kind === "image" ? `🖼 ${a.name}` : `📎 ${a.name}`))
            .join(", ");
    const fullText = (text || "(see attachments)") + summary;

    if (mode === "plan") {
      void handlePlanSend(fullText);
      return;
    }

    const structured = attachments.map((a) => ({
      name: a.name,
      kind: a.kind === "image" ? ("image" as const) : ("file" as const),
      content: a.content,
      mime: a.mime,
      size: a.size,
    }));
    agent.handleAgent(fullText, false, false, structured);
  };


  return (
    <div className="flex flex-col bg-background overflow-hidden" style={{ height: "var(--app-height, 100dvh)" }}>
      <NetworkStatusBanner queuedCount={queue.length} />
      <BuilderHeader
        project={project}
        rightView={rightView}
        setRightView={setRightView}
        loading={loading}
        buildDialogOpen={buildDialogOpen}
        setBuildDialogOpen={setBuildDialogOpen}
        activeBuildId={activeBuildId}
        onBuildIdChange={(id) => {
          setActiveBuildId(id);
          if (id) setBadgeDismissed(false);
        }}
      />

      {/* Floating live build status — visible when dialog is closed */}
      <BuildLiveBadge
        buildId={activeBuildId}
        visible={!buildDialogOpen && !badgeDismissed}
        onClick={() => setBuildDialogOpen(true)}
        onDismiss={() => setBadgeDismissed(true)}
      />


      {isMobile ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <m.div
            className="flex-1 min-h-0 relative touch-pan-y"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            dragMomentum={false}
            onDragEnd={(_, info) => {
              const SWIPE_THRESHOLD = 60;
              const VELOCITY_THRESHOLD = 350;
              const dx = info.offset.x;
              const vx = info.velocity.x;
              const idx = MOBILE_TABS.indexOf(mobileView);
              if ((dx < -SWIPE_THRESHOLD || vx < -VELOCITY_THRESHOLD) && idx < MOBILE_TABS.length - 1) {
                haptic("selection");
                setMobileView(MOBILE_TABS[idx + 1]);
              } else if ((dx > SWIPE_THRESHOLD || vx > VELOCITY_THRESHOLD) && idx > 0) {
                haptic("selection");
                setMobileView(MOBILE_TABS[idx - 1]);
              }
            }}
          >
            <AnimatePresence mode="wait">
              <m.div
                key={mobileView}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                className="absolute inset-0 h-full"
              >
                {mobileView === "chat" && (
                  <ChatPanel
                    messages={project.messages}
                    onSend={handlePanelSend}
                    loading={loading}
                    onStop={handleStop}
                    onRegenerate={handleRegenerate}
                    onDeleteMessage={handleDeleteMessage}
                    onBranchMessage={handleBranchMessage}
                    onNewChat={handleNewChat}
                    onUndo={handleUndo}
                    canUndo={canUndo}
                    existingPaths={new Set(project.files.map((f) => f.path))}
                    activePath={activePath}
                    onOpenFile={(path) => {
                      setActivePath(path);
                      setMobileView("code");
                    }}
                    projectFiles={project.files}
                    lastFailed={lastFailed}
                    onRetry={handleRetry}
                    onResumeBuild={handleResumeBuild}
                    agentSteps={agent.agentSteps}
                    agentQuestion={agent.agentQuestion}
                    onAgentAnswer={agent.handleAgentAnswer}
                    agentAnswerError={agent.agentAnswerError}
                    onRetryAgentAnswer={agent.handleRetryAgentAnswer}
                    agentIteration={agent.agentIteration}
                    agentProgress={agent.agentProgress}
                    chatMode={chatMode}
                    onChatModeChange={handleChatModeChange}
                  />
                )}
                {mobileView === "code" && (
                  <div className="h-full flex flex-col bg-[hsl(var(--bg-subtle))]">
                    <MobileFileTreeDrawer
                      files={project.files}
                      activePath={activePath}
                      onSelect={setActivePath}
                      onAction={handleFileAction}
                    />
                    <div className="flex-1 min-h-0">
                      <CodeEditor file={activeFile} onChange={handleFileChange} allFiles={project.files} projectName={project.name} />
                    </div>
                  </div>
                )}
                {mobileView === "preview" && (
                  <div className="h-full relative">
                    {previewNode}
                    <m.button
                      initial={{ opacity: 0, scale: 0.6, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 380, damping: 24, delay: 0.15 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => {
                        haptic("medium");
                        setMobileView("chat");
                      }}
                      className="absolute right-4 bottom-4 z-30 size-14 rounded-full bg-gradient-primary text-background shadow-[0_10px_28px_-8px_hsl(var(--primary)/0.7),0_0_0_1px_hsl(var(--primary)/0.3)] flex items-center justify-center active:scale-95"
                      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
                      aria-label="Chat with AI"
                    >
                      <MessageSquare size={22} />
                      <span className="absolute -top-1 -right-1 size-3 rounded-full bg-success ring-2 ring-[hsl(var(--bg-subtle))]" />
                    </m.button>
                  </div>
                )}
              </m.div>
            </AnimatePresence>
          </m.div>

          <BuilderMobileNav mobileView={mobileView} setMobileView={setMobileView} />
          <MobilePreviewPill
            visible={isMobile && mobileView === "chat" && previewPillTrigger > 0}
            trigger={previewPillTrigger}
            onOpen={() => {
              haptic("medium");
              setMobileView("preview");
            }}
          />

        </div>
      ) : (
        <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
          <ResizablePanel defaultSize={38} minSize={28} maxSize={55}>
            <ChatPanel
              messages={project.messages}
              onSend={handlePanelSend}
              loading={loading}
              onStop={handleStop}
              onRegenerate={handleRegenerate}
              onDeleteMessage={handleDeleteMessage}
              onBranchMessage={handleBranchMessage}
              onNewChat={handleNewChat}
              onUndo={handleUndo}
              canUndo={canUndo}
              existingPaths={new Set(project.files.map((f) => f.path))}
              activePath={activePath}
              onOpenFile={(path) => {
                setActivePath(path);
                setRightView("code");
              }}
              projectFiles={project.files}
              lastFailed={lastFailed}
              onRetry={handleRetry}
              onResumeBuild={handleResumeBuild}
              agentSteps={agent.agentSteps}
              agentQuestion={agent.agentQuestion}
              onAgentAnswer={agent.handleAgentAnswer}
              agentAnswerError={agent.agentAnswerError}
              onRetryAgentAnswer={agent.handleRetryAgentAnswer}
              agentIteration={agent.agentIteration}
              agentProgress={agent.agentProgress}
              chatMode={chatMode}
              onChatModeChange={handleChatModeChange}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={62} minSize={40}>
            <AnimatePresence mode="wait">
              <m.div
                key={rightView}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="h-full"
              >
                {rightView === "code" ? (
                  <ResizablePanelGroup direction="horizontal">
                    <ResizablePanel defaultSize={22} minSize={12} maxSize={40} collapsible>
                      <div className="h-full bg-[hsl(var(--bg-subtle))] border-r border-[hsl(0_0%_100%/0.06)]">
                        <FileTree
                          files={project.files}
                          activePath={activePath}
                          onSelect={(path) => {
                            setActivePath(path);
                            setRightView("code");
                          }}
                          onAction={handleFileAction}
                        />
                      </div>
                    </ResizablePanel>
                    <ResizableHandle />
                    <ResizablePanel defaultSize={78}>
                      <CodeEditor file={activeFile} onChange={handleFileChange} allFiles={project.files} projectName={project.name} />
                    </ResizablePanel>
                  </ResizablePanelGroup>
                ) : rightView === "cloud" ? (
                  <div className="h-full overflow-y-auto bg-[hsl(var(--bg-subtle))]">
                    <SupabaseCloudPanel projectId={project.id} />
                  </div>
                ) : (
                  previewNode
                )}
              </m.div>
            </AnimatePresence>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}

      {/* File CRUD dialogs — controlled centrally so any tree (desktop or mobile) can trigger */}
      <RenameFileDialog
        open={fileDialog?.kind === "rename"}
        onOpenChange={(v) => !v && setFileDialog(null)}
        currentPath={fileDialog?.kind === "rename" ? fileDialog.path : ""}
        existingPaths={new Set(project.files.map((f) => f.path))}
        onConfirm={(np) =>
          fileDialog?.kind === "rename" && applyFileOp("rename", fileDialog.path, np)
        }
      />
      <DeleteFileDialog
        open={fileDialog?.kind === "delete"}
        onOpenChange={(v) => !v && setFileDialog(null)}
        path={fileDialog?.kind === "delete" ? fileDialog.path : ""}
        onConfirm={() =>
          fileDialog?.kind === "delete" && applyFileOp("delete", fileDialog.path)
        }
      />
      <NewFileDialog
        open={fileDialog?.kind === "new"}
        onOpenChange={(v) => !v && setFileDialog(null)}
        existingPaths={new Set(project.files.map((f) => f.path))}
        defaultDir={fileDialog?.kind === "new" ? fileDialog.path : "src/"}
        onConfirm={(p) => applyFileOp("create", p)}
      />
    </div>
  );
};

export default Builder;
