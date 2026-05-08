import { useMemo, useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { Bot, User, ChevronRight } from "lucide-react";
import remarkGfm from "remark-gfm";
import { FileDiffList, type FileChange } from "../FileDiffCard";
import { BuildProgressCard } from "../BuildProgressCard";
import { AgentTimeline, type TimelineStep } from "../AgentTimeline";
import { ResumeBadge, parseResumeMarker } from "../ResumeBadge";
import { HealBadge, parseHealMarker } from "../HealBadge";
import { PlanBlock, extractPlan, deriveStatuses } from "../PlanBlock";
import type { ChatMessage as ChatMessageType } from "@/lib/store";
import { cn } from "@/lib/utils";
import { MessageActions } from "./MessageActions";
import { SupabaseConnectCard } from "../SupabaseConnectCard";
import {
  STATUS_LINE_RE,
  isLongContent,
  extractHeadline,
  markdownComponents,
  ReactMarkdown,
} from "./markdown";

const SUPABASE_CONNECT_MARKER = /\[\[supabase-connect\]\]/g;
const splitOnConnectMarker = (text: string): { parts: string[]; hasMarker: boolean } => {
  if (!SUPABASE_CONNECT_MARKER.test(text)) return { parts: [text], hasMarker: false };
  // Reset because .test() advances lastIndex on global regex.
  SUPABASE_CONNECT_MARKER.lastIndex = 0;
  return { parts: text.split(SUPABASE_CONNECT_MARKER), hasMarker: true };
};

type Props = {
  message: ChatMessageType;
  changes: FileChange[];
  isStreaming: boolean;
  existingPaths?: Set<string>;
  activePath?: string;
  onOpenFile?: (path: string) => void;
  projectFiles?: import("@/lib/store").ProjectFile[];
  onRegenerate?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onBranch?: () => void;
  searchQuery?: string;
  isSearchHit?: boolean;
  isActiveHit?: boolean;
};

export const ChatMessage = ({
  message,
  changes,
  isStreaming,
  existingPaths,
  activePath,
  onOpenFile,
  projectFiles,
  onRegenerate,
  onEdit,
  onDelete,
  onBranch,
  searchQuery,
  isSearchHit,
  isActiveHit,
}: Props) => {
  const isUser = message.role === "user";

  const resume = isUser ? parseResumeMarker(message.content) : null;
  const heal = isUser && !resume ? parseHealMarker(message.content) : null;

  const baseContent =
    changes.length > 0
      ? message.content.replace(STATUS_LINE_RE, "").replace(/\n{3,}/g, "\n\n").trim()
      : message.content;

  const { planItems, rawContent } = useMemo(() => {
    if (isUser) return { planItems: [] as string[], rawContent: baseContent };
    const { items, rest } = extractPlan(baseContent);
    return { planItems: items, rawContent: rest };
  }, [baseContent, isUser]);

  const collapsible =
    !resume && !heal && isLongContent(rawContent) && (isUser || !isStreaming);
  const [expanded, setExpanded] = useState(false);
  const headline = collapsible ? extractHeadline(rawContent) : "";

  const ts = new Date(message.createdAt ?? Date.now());
  const isToday = ts.toDateString() === new Date().toDateString();
  const timeLabel = isToday
    ? ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : ts.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <m.div
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      data-message-id={message.id}
      data-search-hit={isSearchHit ? "1" : undefined}
      className={cn(
        "group relative flex gap-2.5 scroll-mt-24 transition-shadow rounded-2xl",
        isUser && "flex-row-reverse",
        isSearchHit && "ring-1 ring-primary/40",
        isActiveHit && "ring-2 ring-primary shadow-[0_0_24px_-4px_hsl(var(--primary)/0.5)]",
      )}
    >
      <div
        className={cn(
          "shrink-0 size-7 rounded-md flex items-center justify-center border relative",
          isUser
            ? "bg-[hsl(var(--bg-elevated))] border-[hsl(0_0%_100%/0.08)]"
            : "bg-gradient-primary border-primary/30 shadow-[0_0_12px_hsl(var(--primary)/0.3)]",
        )}
      >
        {!isUser && isStreaming && (
          <span className="absolute inset-0 rounded-md bg-primary/40 animate-ping opacity-60" aria-hidden />
        )}
        {isUser ? (
          <User size={13} className="text-[hsl(var(--foreground-muted))]" />
        ) : (
          <Bot size={13} className="text-background relative" />
        )}
      </div>
      <div
        className={cn(
          "relative flex-1 max-w-[85%] text-[14.5px] md:text-[14px] leading-[1.7]",
          resume || heal
            ? "bg-transparent border-0 px-0 py-0.5 rounded-lg"
            : isUser
              ? "rounded-2xl rounded-tr-sm px-4 py-2.5 md:px-3.5 md:py-2.5 text-foreground border border-primary/25 bg-[linear-gradient(135deg,hsl(var(--primary)/0.18),hsl(var(--accent-cyan)/0.10))] shadow-[0_1px_0_hsl(0_0%_100%/0.04)_inset,0_8px_24px_-12px_hsl(var(--primary)/0.4)]"
              : "rounded-2xl rounded-tl-sm px-4 py-3 md:px-3.5 md:py-2.5 text-foreground border border-[hsl(0_0%_100%/0.07)] bg-[hsl(var(--bg-muted))] shadow-[0_1px_0_hsl(0_0%_100%/0.03)_inset,0_2px_8px_-4px_hsl(0_0%_0%/0.45)]",
        )}
      >
        {!isUser && !resume && !heal && (
          <span
            className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full bg-gradient-to-b from-primary via-primary/40 to-transparent"
            aria-hidden
          />
        )}

        <span
          className={cn(
            "pointer-events-none absolute -top-4 text-[10px] font-mono text-[hsl(var(--foreground-subtle))] opacity-0 group-hover:opacity-100 transition-opacity duration-150",
            isUser ? "right-1" : "left-2",
          )}
          aria-hidden
        >
          {timeLabel}
        </span>

        {resume && <ResumeBadge parsed={resume} />}
        {heal && <HealBadge parsed={heal} />}

        {!isUser && message.buildEvents && message.buildEvents.length > 0 && (
          <div className={cn(rawContent ? "mb-2.5" : "")}>
            <BuildProgressCard
              events={message.buildEvents}
              status={message.buildStatus ?? (isStreaming ? "running" : "done")}
              startedAt={message.buildStartedAt}
              endedAt={message.buildEndedAt}
            />
          </div>
        )}

        {/* Persisted agent timeline — snapshot of the tool calls from the run
            that produced this assistant message. Click any row to expand and
            see the raw arguments + tool output (e.g. "Built the project to
            verify compilation" → full build log). */}
        {!isUser && Array.isArray((message as any).timelineSteps) && (message as any).timelineSteps.length > 0 && (
          <div className="mb-2.5">
            <AgentTimeline steps={(message as any).timelineSteps as TimelineStep[]} onOpenFile={onOpenFile} />
          </div>
        )}

        {/* V1 markdown PlanBlock removed — V2 plan card (in timelineSteps) is the only plan UI now. */}


        {!resume && !heal && collapsible && !expanded && rawContent && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full flex items-start gap-2 text-left group/toggle"
          >
            <ChevronRight
              size={14}
              className="mt-[3px] shrink-0 text-[hsl(var(--foreground-muted))] group-hover/toggle:text-primary transition-colors"
            />
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] md:text-[13.5px] text-foreground/90 line-clamp-2">
                {headline}
              </span>
              <span className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-medium text-[hsl(var(--foreground-muted))] group-hover/toggle:text-primary transition-colors">
                Show details
              </span>
            </span>
          </button>
        )}

        <AnimatePresence initial={false}>
          {!resume && !heal && (!collapsible || expanded) && rawContent && (
            <m.div
              key="body"
              initial={collapsible ? { opacity: 0, height: 0 } : false}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="chat-prose max-w-none">
                {(() => {
                  const { parts, hasMarker } = splitOnConnectMarker(rawContent);
                  if (!hasMarker) {
                    return (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {rawContent}
                      </ReactMarkdown>
                    );
                  }
                  return parts.map((segment, i) => (
                    <div key={i}>
                      {segment.trim() && (
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                          {segment}
                        </ReactMarkdown>
                      )}
                      {i < parts.length - 1 && <SupabaseConnectCard />}
                    </div>
                  ));
                })()}
                {isStreaming && <span className="streaming-caret" aria-hidden />}
              </div>
              {collapsible && expanded && (
                <button
                  onClick={() => setExpanded(false)}
                  className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-[hsl(var(--foreground-muted))] hover:text-primary transition-colors"
                >
                  <ChevronRight size={12} className="rotate-90" />
                  Hide details
                </button>
              )}
            </m.div>
          )}
        </AnimatePresence>

        {changes.length > 0 && onOpenFile && (
          <FileDiffList
            changes={changes}
            existingPaths={existingPaths ?? new Set()}
            activePath={activePath}
            onOpen={onOpenFile}
            projectFiles={projectFiles}
          />
        )}
        {!isStreaming && !resume && !heal && message.content.length > 0 && (
          <MessageActions
            content={message.content}
            isUser={isUser}
            onRegenerate={!isUser ? onRegenerate : undefined}
            onEdit={onEdit}
            onDelete={onDelete}
            onBranch={onBranch}
          />
        )}
      </div>
    </m.div>
  );
};
