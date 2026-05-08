import { useState, useRef, useEffect, useMemo } from "react";
import { m, AnimatePresence } from "framer-motion";
import { RotateCcw, AlertCircle, Sparkles, Clock, UploadCloud } from "lucide-react";
import { StreamingIndicator } from "./StreamingIndicator";
import { ChatInput, type ChatMode, type Attachment, type ChatInputHandle } from "./ChatInput";
import { ChatEmpty } from "./ChatEmpty";
import { ChatHeader } from "./ChatHeader";
import { ChatMessage } from "./ChatMessage";
import { ChatMessageSkeleton } from "./Skeletons";
import { type FileChange } from "./FileDiffCard";
import { AgentTimeline, type TimelineStep } from "./AgentTimeline";
import { QuestionCard } from "./QuestionCard";
import { SecretRequestCard } from "./SecretRequestCard";
import { FileRequestCard } from "./FileRequestCard";
import { ConfirmationCard } from "./ConfirmationCard";
import { ScrollToBottomFAB } from "./ScrollToBottomFAB";
import { AgentProgressBar } from "./AgentProgressBar";
import { ChatSearchBar } from "./ChatSearchBar";
import type { ChatMessage as ChatMessageType, ProjectFile } from "@/lib/store";
import { cn } from "@/lib/utils";

export type SendPayload = { text: string; mode: ChatMode; attachments: Attachment[] };

type Props = {
  messages: ChatMessageType[];
  onSend: (payload: SendPayload) => void;
  loading: boolean;
  onStop?: () => void;
  onRegenerate?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onBranchMessage?: (messageId: string) => void;
  onNewChat?: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  existingPaths?: Set<string>;
  activePath?: string;
  onOpenFile?: (path: string) => void;
  projectFiles?: ProjectFile[];
  // Network resilience: last failed prompt + retry handler.
  lastFailed?: string | null;
  onRetry?: () => void;
  // Build resume: one-click button when last assistant message indicates an
  // interrupted/incomplete generation (server closed early, type continue, etc).
  onResumeBuild?: () => void;
  // Agent mode — live timeline + interactive question card.
  agentSteps?: TimelineStep[];
  agentQuestion?: {
    id: string;
    question: string;
    options: string[];
    allowOther?: boolean;
  } | null;
  onAgentAnswer?: (answer: string) => void;
  // Pre-filled retry state when an answer submission failed.
  agentAnswerError?: { answer: string; message: string } | null;
  onRetryAgentAnswer?: () => void;
  // Live LLM-loop iteration count (1-indexed). 0 = idle.
  agentIteration?: number;
  // Phase 11: determinate progress driven by `report_progress` tool calls.
  agentProgress?: import("./AgentProgressBar").AgentProgress | null;
  /** Current chat mode (Agent / Plan) — persisted in DB by parent. */
  chatMode?: ChatMode;
  onChatModeChange?: (mode: ChatMode) => void;
};

// Extract file paths mentioned in an assistant message.
// Matches paths inside backticks OR bare paths with at least one slash and a known extension.
const FILE_RE = /`([^`\n]+\.[a-z0-9]{1,6})`|([\w./-]+\/[\w./-]+\.[a-z0-9]{1,6})/gi;

function extractFileChanges(content: string, existing: Set<string>): FileChange[] {
  const found: FileChange[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(FILE_RE.source, "gi");
  while ((m = re.exec(content)) !== null) {
    const path = (m[1] || m[2] || "").trim();
    if (!path || seen.has(path)) continue;
    if (/^https?:\/\//.test(path)) continue;
    seen.add(path);
    found.push({ path, kind: existing.has(path) ? "modified" : "created" });
  }
  return found;
}

export const ChatPanel = ({
  messages: allMessages,
  onSend,
  loading,
  onStop,
  onRegenerate,
  onDeleteMessage,
  onBranchMessage,
  onNewChat,
  onUndo,
  canUndo = false,
  existingPaths,
  activePath,
  onOpenFile,
  projectFiles = [],
  lastFailed,
  onRetry,
  onResumeBuild,
  agentSteps = [],
  agentQuestion = null,
  onAgentAnswer,
  agentAnswerError,
  onRetryAgentAnswer,
  agentIteration = 0,
  agentProgress = null,
  chatMode,
  onChatModeChange,
}: Props) => {
  // Per-mode chat threads: Plan and Agent each see only their own messages.
  // Legacy messages (mode "chat" / "generate" / "edit") are bucketed into Agent
  // so existing project history isn't hidden.
  const messages = useMemo(() => {
    const activeMode = chatMode === "plan" ? "plan" : "agent";
    return allMessages.filter((m) => {
      const mm = m.mode === "plan" ? "plan" : "agent";
      return mm === activeMode;
    });
  }, [allMessages, chatMode]);

  const [input, setInput] = useState("");
  const [idleTooLong, setIdleTooLong] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const dragDepthRef = useRef(0); // counts dragenter/leave to handle nested elements
  const scrollRef = useRef<HTMLDivElement>(null);
  const questionAnchorRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputHandle>(null);

  // ---- In-chat search (Cmd/Ctrl+F) ----
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIdx, setSearchIdx] = useState(0);

  const searchHits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [] as string[];
    return messages
      .filter((m) => m.content.toLowerCase().includes(q))
      .map((m) => m.id);
  }, [messages, searchQuery]);

  // Reset / clamp the active hit index when results change.
  useEffect(() => {
    if (searchHits.length === 0) {
      setSearchIdx(0);
      return;
    }
    if (searchIdx >= searchHits.length) setSearchIdx(0);
  }, [searchHits, searchIdx]);

  // Scroll the active hit into view.
  useEffect(() => {
    if (!searchOpen || searchHits.length === 0) return;
    const id = searchHits[searchIdx];
    const root = scrollRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(`[data-message-id="${id}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [searchOpen, searchHits, searchIdx]);

  // Cmd/Ctrl+F to open. Esc to close (handled inside the bar input).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isFind = (e.key === "f" || e.key === "F") && (e.metaKey || e.ctrlKey);
      if (isFind) {
        // Only intercept when chat panel is mounted and visible.
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === "Escape" && searchOpen) {
        // Don't steal Escape from inputs deeper in the tree if not relevant.
        const tag = (document.activeElement as HTMLElement | null)?.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") {
          setSearchOpen(false);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  const hitSet = useMemo(() => new Set(searchHits), [searchHits]);
  const activeHitId = searchHits[searchIdx];

  const isFirst = useMemo(
    () => messages.filter((m) => m.role === "user").length === 0,
    [messages],
  );

  const lastAssistantIdx = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return i;
    }
    return -1;
  }, [messages]);

  // Detect interrupted build: the last assistant message contains a hint that
  // generation stopped mid-way and we should pick up where we left off.
  // (Server closes the SSE stream early, hits a timeout, or explicitly tells
  // the user to "type continue".) Showing a one-click Resume button is much
  // friendlier than asking the user to re-type the same prompt.
  const buildInterrupted = useMemo(() => {
    if (loading) return false;
    if (lastAssistantIdx < 0) return false;
    const last = messages[lastAssistantIdx];
    const text = String(last?.content ?? "").toLowerCase();
    if (!text) return false;
    return (
      text.includes("type 'continue'") ||
      text.includes("type \"continue\"") ||
      text.includes("type continue") ||
      text.includes("server closed the connection") ||
      text.includes("connection dropped mid-generation") ||
      text.includes("auto-resume failed") ||
      text.includes("continue from where it stopped")
    );
  }, [loading, lastAssistantIdx, messages]);

  // ─── Auto-scroll lock ──────────────────────────────────────────
  // Only auto-scroll to bottom when the user is already near the bottom
  // (≤120px). If they scrolled up to read history, respect that and don't
  // yank them down. The ScrollToBottomFAB shows a "Jump to latest" button.
  // We also count messages: a brand-new message → smooth scroll; live token
  // streaming into the same last message → instant scroll (smooth on every
  // token feels janky at high frequency).
  const stickToBottomRef = useRef(true);
  const prevMsgCountRef = useRef(messages.length);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      stickToBottomRef.current = distanceFromBottom <= 120;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!stickToBottomRef.current) return; // user scrolled up — don't yank
    const isNewMessage = messages.length > prevMsgCountRef.current;
    prevMsgCountRef.current = messages.length;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: isNewMessage ? "smooth" : "auto",
    });
  }, [messages, loading]);

  // Idle/timeout detection: if a question stays unanswered for 5 minutes,
  // surface a "Still there?" banner so the user knows the agent is paused
  // and can resume by jumping to the question.
  useEffect(() => {
    setIdleTooLong(false);
    if (!agentQuestion) return;
    const t = setTimeout(() => setIdleTooLong(true), 5 * 60 * 1000);
    return () => clearTimeout(t);
  }, [agentQuestion?.id]);

  const focusPendingQuestion = () => {
    setIdleTooLong(false);
    questionAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    // Move keyboard focus into the question's first option for instant a11y nav.
    setTimeout(() => {
      const radio = questionAnchorRef.current?.querySelector<HTMLElement>(
        '[role="radio"]',
      );
      radio?.focus();
    }, 250);
  };

  const handleSubmit = (payload: SendPayload) => {
    if ((!payload.text && payload.attachments.length === 0) || loading) return;
    onSend(payload);
    setInput("");
  };

  // ── Drag & drop: chat-area-wide file drop overlay ─────────────
  // Uses a depth counter so nested dragenter/leave events from children
  // don't flicker the overlay on/off. Accepts any files DataTransfer offers
  // and forwards them to ChatInput's imperative `addFiles`.
  const onDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setDragActive(true);
  };
  const onDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const onDragLeave = (e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragActive(false);
  };
  const onDrop = (e: React.DragEvent) => {
    if (!e.dataTransfer?.files || e.dataTransfer.files.length === 0) return;
    e.preventDefault();
    dragDepthRef.current = 0;
    setDragActive(false);
    chatInputRef.current?.addFiles(e.dataTransfer.files);
    chatInputRef.current?.focus();
  };

  return (
    <div
      className="relative flex flex-col h-full bg-[hsl(var(--bg-subtle))]"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* ── Drag & drop overlay ────────────────────────────────────
          Full-pane visual feedback while files are being dragged
          anywhere over the chat panel. Inert (pointer-events: none)
          so it doesn't intercept the actual drop event. */}
      <AnimatePresence>
        {dragActive && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute inset-2 z-40 rounded-2xl border-2 border-dashed border-primary/60 bg-[hsl(var(--bg-subtle))]/85 backdrop-blur-sm flex items-center justify-center"
          >
            <div className="flex flex-col items-center gap-3 text-center px-6">
              <div className="size-14 rounded-2xl bg-gradient-primary-soft border border-primary/30 flex items-center justify-center shadow-[0_0_24px_hsl(var(--primary)/0.35)]">
                <UploadCloud size={26} className="text-primary" />
              </div>
              <div>
                <div className="text-[15px] font-semibold text-foreground">Drop files to attach</div>
                <div className="text-[12px] text-[hsl(var(--foreground-muted))] mt-0.5">
                  Images, PDF, DOCX, code or text · up to 10 files
                </div>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Subtle radial depth — top-left primary glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 600px 400px at 0% 0%, hsl(var(--primary) / 0.05), transparent 60%)",
        }}
        aria-hidden
      />

      <ChatHeader onNewChat={onNewChat} onUndo={onUndo} canUndo={canUndo} onSearch={() => setSearchOpen(true)} />

      <ChatSearchBar
        open={searchOpen}
        query={searchQuery}
        total={searchHits.length}
        index={searchIdx}
        onChange={setSearchQuery}
        onClose={() => {
          setSearchOpen(false);
          setSearchQuery("");
        }}
        onPrev={() =>
          setSearchIdx((i) => (searchHits.length === 0 ? 0 : (i - 1 + searchHits.length) % searchHits.length))
        }
        onNext={() =>
          setSearchIdx((i) => (searchHits.length === 0 ? 0 : (i + 1) % searchHits.length))
        }
      />

      {/* Messages */}
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-y-auto px-3 py-3 space-y-4 scrollbar-thin"
      >
        {messages.length === 0 && <ChatEmpty onSelect={(p) => setInput(p)} />}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => {
            const isUser = msg.role === "user";
            const changes =
              !isUser && onOpenFile
                ? extractFileChanges(msg.content, existingPaths ?? new Set())
                : [];
            return (
              <ChatMessage
                key={msg.id}
                message={msg}
                changes={changes}
                isStreaming={!isUser && loading && i === lastAssistantIdx}
                existingPaths={existingPaths}
                activePath={activePath}
                onOpenFile={onOpenFile}
                projectFiles={projectFiles}
                onRegenerate={onRegenerate ? () => onRegenerate(msg.id) : undefined}
                onDelete={onDeleteMessage ? () => onDeleteMessage(msg.id) : undefined}
                onBranch={onBranchMessage ? () => onBranchMessage(msg.id) : undefined}
                searchQuery={searchOpen ? searchQuery : undefined}
                isSearchHit={hitSet.has(msg.id)}
                isActiveHit={activeHitId === msg.id}
              />
            );
          })}
        </AnimatePresence>

        {/* Agent timeline — live multi-step view (replaces the plain skeleton
            when the agent is actively running). The pending question card is
            injected inline at the end so the conversation flows naturally. */}
        {(agentSteps.length > 0 || (agentQuestion && onAgentAnswer)) && (
          <m.div
            ref={questionAnchorRef}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="rounded-xl border border-primary/20 bg-[hsl(var(--bg-elevated))] p-3 space-y-2"
          >
            {(() => {
              // Surface the agent's *current* activity in the header so users
              // see what it's doing right now, not just the iteration number.
              const lastTool = [...agentSteps].reverse().find((s) => s.kind === "tool");
              const isWorking =
                lastTool?.kind === "tool" && lastTool.status === "running";
              const TOOL_LABELS: Record<string, string> = {
                read_file: "Reading file",
                write_file: "Writing file",
                list_files: "Listing files",
                search_files: "Searching",
                grep_files: "Regex search",
                run_typecheck: "Type-checking",
                validate_files: "Validating",
                read_memory: "Recalling memory",
                write_memory: "Saving memory",
                list_memory: "Loading memory",
                ask_user: "Awaiting input",
                edit_file: "Editing file",
                delete_file: "Deleting file",
                read_console_logs: "Reading logs",
                add_dependency: "Installing package",
                db_migration: "Writing migration",
                deploy_edge_function: "Deploying function",
              };
              const activityLabel =
                isWorking && lastTool.kind === "tool"
                  ? TOOL_LABELS[lastTool.name] ?? lastTool.name
                  : agentIteration > 0
                  ? "Thinking"
                  : "";
              return (
                <div className="flex items-center justify-between gap-2 text-[11px] font-mono uppercase tracking-wider text-primary">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={12} className={isWorking ? "animate-pulse" : ""} />
                    Agent
                    {activityLabel && (
                      <span className="ml-1 normal-case tracking-normal text-primary/80">
                        · {activityLabel}
                        {isWorking && (
                          <span className="ml-0.5 inline-flex">
                            <span className="animate-[pulse_1.4s_ease-in-out_infinite] [animation-delay:0ms]">.</span>
                            <span className="animate-[pulse_1.4s_ease-in-out_infinite] [animation-delay:200ms]">.</span>
                            <span className="animate-[pulse_1.4s_ease-in-out_infinite] [animation-delay:400ms]">.</span>
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  {agentIteration > 0 && (
                    <span
                      className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-primary"
                      title={`Agent loop iteration ${agentIteration} of 40`}
                    >
                      Step {agentIteration}/40
                    </span>
                  )}
                </div>
              );
            })()}
            <AgentProgressBar progress={agentProgress} className="-mx-1" />
            <AgentTimeline
              steps={agentSteps}
              onOpenFile={onOpenFile}
              activeQuestion={
                agentQuestion && onAgentAnswer ? (
                  /^__SECRET_(REQUEST|DELETE)__:/.test(agentQuestion.question) ? (
                    <SecretRequestCard
                      question={agentQuestion.question}
                      options={agentQuestion.options}
                      onAnswer={onAgentAnswer}
                    />
                  ) : /^__FILE_REQUEST__:/.test(agentQuestion.question) ? (
                    <FileRequestCard
                      question={agentQuestion.question}
                      onAnswer={onAgentAnswer}
                    />
                  ) : /^__CONFIRM__:/.test(agentQuestion.question) ? (
                    <ConfirmationCard
                      question={agentQuestion.question}
                      onAnswer={onAgentAnswer}
                    />
                  ) : (
                    <QuestionCard
                      question={agentQuestion.question}
                      options={agentQuestion.options}
                      allowOther={agentQuestion.allowOther}
                      onAnswer={onAgentAnswer}
                      lastError={agentAnswerError}
                      onRetry={onRetryAgentAnswer}
                    />
                  )
                ) : undefined
              }
            />
          </m.div>
        )}

        {loading && agentSteps.length === 0 && (
          <m.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            {/* Skeleton bubble while waiting for the first token, then a thin
                streaming indicator inside it once content begins to flow. */}
            <ChatMessageSkeleton />
            <div className="mt-2 pl-10">
              <StreamingIndicator />
            </div>
          </m.div>
        )}
      </div>

      {/* Idle banner — surfaces after the agent has been waiting on a question
          for 5+ minutes so the user can quickly jump back to it. */}
      <AnimatePresence>
        {idleTooLong && agentQuestion && (
          <m.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className={cn(
              "mx-3 mb-2 flex items-center gap-2 rounded-lg border border-primary/40",
              "bg-primary/10 px-3 py-2 text-[12.5px] text-foreground",
            )}
            role="status"
          >
            <Clock className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="flex-1 truncate">
              Agent is waiting on your answer.
            </span>
            <button
              onClick={focusPendingQuestion}
              className={cn(
                "inline-flex items-center gap-1 rounded-md bg-primary/20 hover:bg-primary/30",
                "px-2.5 py-1 font-medium min-h-[32px] transition-colors text-primary",
              )}
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Resume
            </button>
          </m.div>
        )}
      </AnimatePresence>

      {/* Retry banner — appears when the last AI request failed (network or server). */}
      <AnimatePresence>
        {lastFailed && onRetry && !loading && (
          <m.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive"
          >
            <AlertCircle className="size-4 shrink-0" />
            <span className="flex-1 truncate">Last request failed.</span>
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1 rounded-md bg-destructive/20 hover:bg-destructive/30 px-2.5 py-1 font-medium min-h-[32px] transition-colors"
            >
              <RotateCcw className="size-3.5" />
              Retry
            </button>
          </m.div>
        )}
      </AnimatePresence>

      {/* Resume banner — appears when generation was interrupted mid-build.
          Sends a structured "continue" prompt instead of forcing the user to
          re-type their original request. */}
      <AnimatePresence>
        {buildInterrupted && onResumeBuild && !loading && (
          <m.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12.5px] text-foreground"
            role="status"
          >
            <RotateCcw className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="flex-1 truncate">
              Build was interrupted — resume from the last file.
            </span>
            <button
              onClick={onResumeBuild}
              className={cn(
                "inline-flex items-center gap-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30",
                "px-2.5 py-1 font-medium min-h-[32px] transition-colors text-amber-700 dark:text-amber-300",
              )}
            >
              <Sparkles className="size-3.5" />
              Resume build
            </button>
          </m.div>
        )}
      </AnimatePresence>

      {/* Floating "jump to latest" button — appears when scrolled away from
          the bottom. Sits just above the input. */}
      <div className="relative">
        <ScrollToBottomFAB scrollRef={scrollRef} className="-top-10" />
      </div>

      {/* Input */}
      <ChatInput
        ref={chatInputRef}
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        loading={loading}
        onStop={onStop}
        isFirst={isFirst}
        projectFiles={projectFiles}
        mode={chatMode}
        onModeChange={onChatModeChange}
      />
    </div>
  );
};
