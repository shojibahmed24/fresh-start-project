import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import {
  Paperclip,
  Image as ImageIcon,
  AtSign,
  Mic,
  Send,
  Loader2,
  Sparkles,
  Eraser,
  Wand2,
  HelpCircle,
  Bug,
  X,
  FileText,
  Square,
  Hammer,
  MessagesSquare,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import type { ProjectFile } from "@/lib/store";
import { EstimatePill } from "./EstimatePill";

export type ChatMode = "agent" | "plan";

export type Attachment = {
  id: string;
  name: string;
  kind: "file" | "image";
  size: number;
  content: string; // text content or data URL for images
  mime?: string;
};

type SlashCmd = {
  cmd: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

const SLASH_COMMANDS: SlashCmd[] = [
  { cmd: "/clear", label: "Clear chat", description: "Start a fresh conversation", icon: Eraser },
  { cmd: "/explain", label: "Explain code", description: "Walk through the current file", icon: HelpCircle },
  { cmd: "/refactor", label: "Refactor", description: "Improve structure without changing behavior", icon: Wand2 },
  { cmd: "/fix", label: "Fix issues", description: "Find and fix bugs in the project", icon: Bug },
  { cmd: "/improve", label: "Improve UI", description: "Polish design & visual quality", icon: Sparkles },
];

const TOKEN_LIMIT = 4000;
const MAX_FILE_SIZE = 1024 * 1024; // 1 MB for plain text
const MAX_DOC_SIZE = 20 * 1024 * 1024; // 20 MB for PDF / DOCX (parsed to text client-side)

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (payload: { text: string; mode: ChatMode; attachments: Attachment[] }) => void;
  loading: boolean;
  onStop?: () => void;
  isFirst: boolean;
  projectFiles?: ProjectFile[];
  /** Current chat mode (controlled by parent so it can be persisted to DB). */
  mode?: ChatMode;
  /** Called when the user toggles between Agent and Plan mode. */
  onModeChange?: (mode: ChatMode) => void;
};

/** Imperative handle exposed to the parent so external drop-zones (or any
 *  outside-the-input file source) can push files into the attachment tray. */
export type ChatInputHandle = {
  /** Push files into the attachment tray, auto-bucketed by MIME type. */
  addFiles: (files: FileList | File[]) => void;
  /** Programmatically focus the textarea. */
  focus: () => void;
};

// Speech Recognition (vendor-prefixed)
const SpeechRecognition: any =
  typeof window !== "undefined" &&
  ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

export const ChatInput = forwardRef<ChatInputHandle, Props>(function ChatInput(
  { value, onChange, onSubmit, loading, onStop, isFirst, projectFiles = [], mode: controlledMode, onModeChange }: Props,
  forwardedRef,
) {
  // Mode is controlled by the parent (which persists it to the DB profile).
  // Fall back to "agent" until the parent has loaded the profile.
  const mode: ChatMode = controlledMode ?? "agent";
  const setMode = (next: ChatMode) => {
    onModeChange?.(next);
  };
  const [focused, setFocused] = useState(false);
  const [slashIdx, setSlashIdx] = useState(0);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [recording, setRecording] = useState(false);
  const [mentionState, setMentionState] = useState<{ query: string; start: number } | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // ── Slash commands ─────────────────────────────────────────
  const showSlash = useMemo(() => {
    const t = value.trimStart();
    return t.startsWith("/") && !t.includes(" ") && !t.includes("\n");
  }, [value]);

  const filteredSlash = useMemo(() => {
    if (!showSlash) return [];
    const q = value.trimStart().toLowerCase();
    return SLASH_COMMANDS.filter((s) => s.cmd.startsWith(q));
  }, [value, showSlash]);

  useEffect(() => setSlashIdx(0), [value]);

  // ── Mentions: detect "@..." at caret ────────────────────────
  const detectMention = (text: string, caret: number) => {
    const before = text.slice(0, caret);
    const m = /(?:^|\s)@([\w./-]*)$/.exec(before);
    if (!m) return null;
    return { query: m[1], start: caret - m[1].length - 1 };
  };

  const filteredMentions = useMemo(() => {
    if (!mentionState) return [];
    const q = mentionState.query.toLowerCase();
    return projectFiles
      .filter((f) => f.path.toLowerCase().includes(q))
      .slice(0, 8);
  }, [mentionState, projectFiles]);

  useEffect(() => setMentionIdx(0), [mentionState?.query]);

  const insertMention = (path: string) => {
    if (!mentionState) return;
    const before = value.slice(0, mentionState.start);
    const after = value.slice(mentionState.start + 1 + mentionState.query.length);
    const next = `${before}@${path} ${after}`;
    onChange(next);
    setMentionState(null);
    requestAnimationFrame(() => taRef.current?.focus());
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    onChange(next);
    const caret = e.target.selectionStart ?? next.length;
    setMentionState(detectMention(next, caret));
  };

  // ── Token counter ──────────────────────────────────────────
  const attachmentTokens = useMemo(
    () => attachments.reduce((sum, a) => sum + Math.ceil(a.content.length / 4), 0),
    [attachments],
  );
  const tokenEstimate = Math.ceil(value.length / 4) + attachmentTokens;
  const tokenPct = tokenEstimate / TOKEN_LIMIT;
  const tokenColor =
    tokenPct > 0.95
      ? "text-destructive"
      : tokenPct > 0.75
        ? "text-amber-400"
        : "text-[hsl(var(--foreground-subtle))]";

  // ── Submit ─────────────────────────────────────────────────
  const submit = () => {
    if ((!value.trim() && attachments.length === 0) || loading) return;
    onSubmit({ text: value.trim(), mode, attachments });
    setAttachments([]);
  };

  const applySlash = (cmd: string) => {
    onChange(cmd + " ");
    requestAnimationFrame(() => taRef.current?.focus());
  };

  // ── Keyboard ───────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Mention picker takes priority
    if (mentionState && filteredMentions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIdx((i) => (i + 1) % filteredMentions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIdx((i) => (i - 1 + filteredMentions.length) % filteredMentions.length);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        insertMention(filteredMentions[mentionIdx].path);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionState(null);
        return;
      }
    }
    if (showSlash && filteredSlash.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIdx((i) => (i + 1) % filteredSlash.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIdx((i) => (i - 1 + filteredSlash.length) % filteredSlash.length);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        applySlash(filteredSlash[slashIdx].cmd);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onChange("");
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  // ── Attachments ────────────────────────────────────────────
  const handleFiles = async (files: FileList | null, kind: "file" | "image") => {
    if (!files || files.length === 0) return;
    const next: Attachment[] = [];
    for (const f of Array.from(files)) {
      const { isPdf, isDocx, parsePdf, parseDocx } = await import("@/lib/parseDocument");
      const isDoc = isPdf(f) || isDocx(f);
      const sizeLimit = isDoc ? MAX_DOC_SIZE : MAX_FILE_SIZE;
      if (f.size > sizeLimit) {
        toast.error(
          `${f.name} is too large (max ${isDoc ? "20 MB" : "1 MB"})`,
        );
        continue;
      }
      try {
        let content: string;
        let mime = f.type;
        if (kind === "image") {
          content = await readAsDataURL(f);
        } else if (isPdf(f)) {
          toast.info(`Parsing ${f.name}…`);
          const parsed = await parsePdf(f);
          content = parsed.text;
          mime = "text/plain";
        } else if (isDocx(f)) {
          toast.info(`Parsing ${f.name}…`);
          const parsed = await parseDocx(f);
          content = parsed.text;
          mime = "text/plain";
        } else {
          content = await readAsText(f);
        }
        next.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: f.name,
          kind,
          size: f.size,
          content,
          mime,
        });
      } catch (err) {
        console.error("attachment parse failed", err);
        toast.error(`Failed to read ${f.name}`);
      }
    }
    if (next.length) {
      setAttachments((prev) => [...prev, ...next]);
      toast.success(`Attached ${next.length} ${kind === "image" ? "image" : "file"}${next.length > 1 ? "s" : ""}`);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Auto-bucket files by MIME → "image" vs "file" so a single drop/paste call
  // can mix screenshots and docs in one go.
  const ingestFiles = async (files: File[] | FileList) => {
    const arr = Array.from(files);
    const images = arr.filter((f) => f.type.startsWith("image/"));
    const others = arr.filter((f) => !f.type.startsWith("image/"));
    if (images.length) {
      const dt = new DataTransfer();
      images.forEach((f) => dt.items.add(f));
      await handleFiles(dt.files, "image");
    }
    if (others.length) {
      const dt = new DataTransfer();
      others.forEach((f) => dt.items.add(f));
      await handleFiles(dt.files, "file");
    }
  };

  // Expose imperative API to the parent (for chat-area drag&drop overlay).
  useImperativeHandle(forwardedRef, () => ({
    addFiles: (files) => { void ingestFiles(files); },
    focus: () => taRef.current?.focus(),
  }));

  // ── Paste handler: pull images out of the clipboard ─────────
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items || items.length === 0) return;
    const files: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length) {
      e.preventDefault(); // suppress the (binary) text paste fallback
      void ingestFiles(files);
    }
  };

  // ── @ button: insert @ at caret to open picker ─────────────
  const triggerMention = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.focus();
    const caret = ta.selectionStart ?? value.length;
    const needsSpace = caret > 0 && !/\s/.test(value[caret - 1] ?? "");
    const insert = (needsSpace ? " " : "") + "@";
    const next = value.slice(0, caret) + insert + value.slice(caret);
    onChange(next);
    requestAnimationFrame(() => {
      const newCaret = caret + insert.length;
      ta.setSelectionRange(newCaret, newCaret);
      setMentionState({ query: "", start: newCaret - 1 });
    });
  };

  // ── Voice (Web Speech API) ─────────────────────────────────
  const toggleVoice = () => {
    if (!SpeechRecognition) {
      toast.error("Voice input not supported in this browser");
      return;
    }
    if (recording) {
      recognitionRef.current?.stop();
      return;
    }
    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = "en-US";
      let finalText = "";
      rec.onresult = (e: any) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        const append = (finalText + interim).trim();
        if (append) {
          const base = value.replace(/\s*\[listening…\].*$/, "").trimEnd();
          onChange(base + (base ? " " : "") + append);
        }
      };
      rec.onend = () => setRecording(false);
      rec.onerror = (e: any) => {
        setRecording(false);
        if (e.error !== "aborted" && e.error !== "no-speech") {
          toast.error(`Voice error: ${e.error}`);
        }
      };
      rec.start();
      recognitionRef.current = rec;
      setRecording(true);
    } catch {
      toast.error("Could not start voice input");
    }
  };

  useEffect(() => () => recognitionRef.current?.stop?.(), []);

  // Mobile: ≥44px tap targets per iOS HIG. Desktop: compact icons.
  const toolBtn =
    "inline-flex items-center justify-center min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 p-2.5 md:p-1.5 rounded-md text-[hsl(var(--foreground-muted))] hover:text-foreground hover:bg-[hsl(0_0%_100%/0.06)] active:bg-[hsl(0_0%_100%/0.1)] transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div
      className="px-3 pt-2 pb-3 bg-[hsl(var(--bg-subtle))] relative"
      // On mobile when keyboard is open, --keyboard-inset > 0 — but since we already
      // shrink the whole app via --app-height, the bar naturally sits above the keyboard.
      // We just add safe-area padding for notched devices in landscape.
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      {/* Hidden file inputs */}
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        accept=".txt,.md,.json,.ts,.tsx,.js,.jsx,.css,.html,.svg,.yml,.yaml,.csv,.log,.pdf,.docx"
        onChange={(e) => {
          handleFiles(e.target.files, "file");
          e.target.value = "";
        }}
      />
      <input
        ref={imageRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files, "image");
          e.target.value = "";
        }}
      />

      {/* Mention picker */}
      <AnimatePresence>
        {mentionState && filteredMentions.length > 0 && (
          <m.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.12 }}
            className="absolute left-3 right-3 bottom-[calc(100%-8px)] z-30 mb-2 rounded-xl border border-[hsl(0_0%_100%/0.08)] bg-[hsl(var(--bg-elevated))] shadow-2xl shadow-black/40 backdrop-blur-xl overflow-hidden"
          >
            <div className="px-3 py-1.5 border-b border-[hsl(0_0%_100%/0.06)] flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[hsl(var(--foreground-subtle))]">
                Mention file
              </span>
              <span className="text-[10px] font-mono text-[hsl(var(--foreground-subtle))]">
                ↑↓ ⏎ to insert
              </span>
            </div>
            <div className="py-1 max-h-64 overflow-y-auto scrollbar-thin">
              {filteredMentions.map((f, i) => {
                const active = i === mentionIdx;
                const name = f.path.split("/").pop();
                const dir = f.path.slice(0, f.path.length - (name?.length ?? 0)).replace(/\/$/, "");
                return (
                  <button
                    key={f.path}
                    onMouseEnter={() => setMentionIdx(i)}
                    onClick={() => insertMention(f.path)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors",
                      active ? "bg-primary/10" : "hover:bg-[hsl(0_0%_100%/0.04)]",
                    )}
                  >
                    <FileText size={12} className="text-[hsl(var(--foreground-subtle))]" />
                    <span className="text-[12.5px] font-medium text-foreground">{name}</span>
                    {dir && (
                      <span className="text-[10.5px] font-mono text-[hsl(var(--foreground-subtle))] truncate">
                        {dir}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Slash command palette */}
      <AnimatePresence>
        {showSlash && filteredSlash.length > 0 && !mentionState && (
          <m.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.12 }}
            className="absolute left-3 right-3 bottom-[calc(100%-8px)] z-20 mb-2 rounded-xl border border-[hsl(0_0%_100%/0.08)] bg-[hsl(var(--bg-elevated))] shadow-2xl shadow-black/40 backdrop-blur-xl overflow-hidden"
          >
            <div className="px-3 py-1.5 border-b border-[hsl(0_0%_100%/0.06)] flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[hsl(var(--foreground-subtle))]">
                Commands
              </span>
              <span className="text-[10px] font-mono text-[hsl(var(--foreground-subtle))]">
                ↑↓ navigate · ⏎ select
              </span>
            </div>
            <div className="py-1 max-h-64 overflow-y-auto">
              {filteredSlash.map((s, i) => {
                const Icon = s.icon;
                const active = i === slashIdx;
                return (
                  <button
                    key={s.cmd}
                    onMouseEnter={() => setSlashIdx(i)}
                    onClick={() => applySlash(s.cmd)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                      active ? "bg-primary/10" : "hover:bg-[hsl(0_0%_100%/0.04)]",
                    )}
                  >
                    <div
                      className={cn(
                        "size-7 rounded-md flex items-center justify-center border",
                        active
                          ? "bg-gradient-primary-soft border-primary/30 text-primary"
                          : "bg-[hsl(var(--bg-muted))] border-[hsl(0_0%_100%/0.06)] text-[hsl(var(--foreground-muted))]",
                      )}
                    >
                      <Icon size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-foreground">{s.label}</span>
                        <code className="text-[11px] font-mono text-[hsl(var(--foreground-subtle))]">
                          {s.cmd}
                        </code>
                      </div>
                      <div className="text-[11px] text-[hsl(var(--foreground-subtle))] truncate">
                        {s.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Premium input container with gradient border */}
      <div
        className={cn(
          "relative rounded-2xl p-[1px] transition-all duration-200",
          focused
            ? "bg-gradient-to-br from-primary/50 via-primary/20 to-transparent shadow-[0_0_0_4px_hsl(var(--primary)/0.08),0_8px_32px_-12px_hsl(var(--primary)/0.4)] animate-focus-pulse"
            : "bg-gradient-to-br from-[hsl(0_0%_100%/0.10)] via-[hsl(0_0%_100%/0.04)] to-transparent",
        )}
      >
        <div className="rounded-[15px] bg-[hsl(var(--bg-muted))] shadow-inner shadow-black/20 overflow-hidden">
          {/* ── Attachment preview tray ──────────────────────────────
              Image attachments render as 56px thumbnails with a hover dim +
              an X corner-button. Files render as a richer card with type
              badge, name, size, and a "parsed text" indicator for PDF/DOCX
              that were converted to text in handleFiles(). */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 pt-3">
              {attachments.map((a) => {
                const isImage = a.kind === "image";
                // PDF/DOCX get parsed to text → mime is "text/plain" but the
                // original filename still ends in .pdf/.docx. We surface that
                // so the user knows the content is going to the AI as text.
                const isParsedDoc =
                  a.kind === "file" &&
                  /\.(pdf|docx)$/i.test(a.name) &&
                  a.mime === "text/plain";
                const ext = a.name.split(".").pop()?.toUpperCase().slice(0, 4);
                if (isImage) {
                  return (
                    <div
                      key={a.id}
                      className="group/att relative size-14 rounded-lg overflow-hidden border border-[hsl(0_0%_100%/0.10)] bg-[hsl(var(--bg-subtle))] shadow-sm"
                      title={`${a.name} · ${formatBytes(a.size)}`}
                    >
                      <img
                        src={a.content}
                        alt={a.name}
                        className="size-full object-cover transition-transform duration-200 group-hover/att:scale-110"
                      />
                      {/* Bottom gradient with name */}
                      <div className="absolute inset-x-0 bottom-0 px-1 py-0.5 bg-gradient-to-t from-black/80 to-transparent text-[9px] text-white truncate font-medium">
                        {a.name}
                      </div>
                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => removeAttachment(a.id)}
                        className="absolute top-0.5 right-0.5 size-5 rounded-full grid place-items-center bg-black/70 text-white hover:bg-destructive transition-colors opacity-0 group-hover/att:opacity-100 focus:opacity-100"
                        aria-label={`Remove ${a.name}`}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  );
                }
                return (
                  <div
                    key={a.id}
                    className="group/att relative flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-lg bg-[hsl(var(--bg-subtle))] border border-[hsl(0_0%_100%/0.08)] hover:border-primary/30 transition-colors max-w-[220px]"
                  >
                    <div className="shrink-0 size-8 rounded-md bg-gradient-primary-soft border border-primary/20 grid place-items-center">
                      <FileText size={14} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-medium text-foreground truncate">{a.name}</span>
                        {ext && (
                          <span className="shrink-0 px-1 py-[1px] rounded text-[9px] font-bold tracking-wider bg-primary/15 text-primary border border-primary/20">
                            {ext}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-[hsl(var(--foreground-subtle))]">
                        <span className="font-mono">{formatBytes(a.size)}</span>
                        {isParsedDoc && (
                          <span className="inline-flex items-center gap-0.5 text-[9.5px] text-success font-medium">
                            • parsed
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(a.id)}
                      className="shrink-0 p-1 rounded hover:bg-destructive/15 text-[hsl(var(--foreground-subtle))] hover:text-destructive transition-colors"
                      aria-label={`Remove ${a.name}`}
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <Textarea
            ref={taRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={(e) => {
              setFocused(true);
              // On mobile, when keyboard opens, scroll the input into view above the keyboard.
              // We delay so visualViewport has time to report the new size.
              if (window.matchMedia("(max-width: 767px)").matches) {
                setTimeout(() => {
                  e.target.scrollIntoView({ block: "center", behavior: "smooth" });
                }, 250);
              }
            }}
            onBlur={() => setFocused(false)}
            placeholder={isFirst ? "Describe the app you want to build…" : "Ask for changes, type / for commands or @ to mention…"}
            disabled={loading}
            // text-base (16px) on mobile prevents iOS Safari from auto-zooming the page on focus.
            // We bump down to 14.5px on md+ where zoom-on-focus is not a concern.
            className="bg-transparent border-0 resize-none min-h-[84px] max-h-[240px] px-4 pt-3 pb-1 text-base md:text-[14.5px] leading-[1.6] focus-visible:ring-0 focus-visible:border-0 placeholder:text-[hsl(var(--foreground-subtle))]"
          />

          {/* Toolbar */}
          <div className="flex items-center justify-between px-2 pb-2 pt-1">
            {/* Left: utility icons */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={toolBtn}
                aria-label="Attach file"
                title="Attach file (text, code, json…)"
              >
                <Paperclip className="size-[18px] md:size-[14px]" />
              </button>
              <button
                type="button"
                onClick={() => imageRef.current?.click()}
                className={toolBtn}
                aria-label="Add image"
                title="Add image"
              >
                <ImageIcon className="size-[18px] md:size-[14px]" />
              </button>
              <button
                type="button"
                onClick={triggerMention}
                className={toolBtn}
                aria-label="Mention file"
                title="Mention a project file (@)"
                disabled={projectFiles.length === 0}
              >
                <AtSign className="size-[18px] md:size-[14px]" />
              </button>
              {/* Voice input — bigger & more prominent on mobile (voice-first UX). */}
              <button
                type="button"
                onClick={toggleVoice}
                className={cn(
                  // Mobile: gradient pill with text label, ≥48px tap target.
                  // Desktop: compact icon-only matching the other tools.
                  "inline-flex items-center justify-center gap-1.5 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed",
                  // Mobile sizing
                  "min-h-[44px] px-3 rounded-full",
                  // Desktop sizing — overrides mobile
                  "md:min-h-0 md:p-1.5 md:rounded-md md:bg-transparent md:border-0 md:shadow-none",
                  recording
                    ? "bg-destructive/15 border border-destructive/40 text-destructive shadow-[0_0_0_4px_hsl(var(--destructive)/0.15)] animate-pulse md:bg-destructive/10 md:border-0 md:shadow-none md:px-1.5"
                    : "bg-gradient-primary-soft border border-primary/30 text-primary shadow-[0_0_12px_-2px_hsl(var(--primary)/0.4)] md:text-[hsl(var(--foreground-muted))] md:hover:text-foreground md:hover:bg-[hsl(0_0%_100%/0.06)] md:px-1.5",
                )}
                aria-label={recording ? "Stop recording" : "Voice input"}
                title={recording ? "Stop recording" : "Voice input"}
              >
                <Mic className="size-[18px] md:size-[14px]" />
                {/* Label — mobile only, hidden on desktop */}
                <span className="text-[12px] font-medium md:hidden">
                  {recording ? "Listening…" : "Voice"}
                </span>
              </button>
            </div>

            {/* Right: mode + send */}
            <div className="flex items-center gap-2">
              {/* Mode toggle: Agent (build code) ↔ Plan (discuss only) */}
              <div
                className="inline-flex items-center rounded-full bg-[hsl(var(--bg-subtle))] border border-[hsl(0_0%_100%/0.08)] p-0.5 text-[11px] font-medium"
                role="radiogroup"
                aria-label="Chat mode"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === "agent"}
                  onClick={() => setMode("agent")}
                  disabled={loading}
                  title="Agent mode — build code"
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full transition-all duration-150 min-h-[28px] disabled:opacity-50 disabled:cursor-not-allowed",
                    mode === "agent"
                      ? "bg-gradient-to-br from-primary to-[hsl(var(--primary-glow,var(--primary)))] text-background shadow-[0_0_10px_-2px_hsl(var(--primary)/0.5)]"
                      : "text-[hsl(var(--foreground-muted))] hover:text-foreground",
                  )}
                >
                  <Hammer className="size-[11px]" />
                  <span className="hidden sm:inline">Agent</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === "plan"}
                  onClick={() => setMode("plan")}
                  disabled={loading}
                  title="Plan mode — discuss & plan, no code changes"
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full transition-all duration-150 min-h-[28px] disabled:opacity-50 disabled:cursor-not-allowed",
                    mode === "plan"
                      ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_0_10px_-2px_hsl(280_80%_60%/0.5)]"
                      : "text-[hsl(var(--foreground-muted))] hover:text-foreground",
                  )}
                >
                  <MessagesSquare className="size-[11px]" />
                  <span className="hidden sm:inline">Plan</span>
                </button>
              </div>
              <button
                onClick={loading ? onStop : submit}
                disabled={loading ? !onStop : !value.trim() && attachments.length === 0}
                aria-label={loading ? "Stop generation" : "Send message"}
                title={loading ? "Stop generation" : "Send"}
                className={cn(
                  // Mobile: 44px tap target. Desktop: 32px compact.
                  "relative size-11 md:size-8 rounded-full flex items-center justify-center transition-all duration-200",
                  loading
                    ? "bg-destructive text-destructive-foreground shadow-[0_0_16px_-2px_hsl(var(--destructive)/0.6)] hover:scale-105 hover:shadow-[0_0_24px_-2px_hsl(var(--destructive)/0.8)] active:scale-95"
                    : "bg-gradient-to-br from-primary to-[hsl(var(--primary-glow,var(--primary)))] shadow-[0_0_16px_-2px_hsl(var(--primary)/0.5)] hover:scale-105 hover:shadow-[0_0_24px_-2px_hsl(var(--primary)/0.7)] active:scale-95",
                  "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none",
                )}
              >
                {loading ? (
                  <Square className="size-[14px] md:size-[11px] text-destructive-foreground fill-current" />
                ) : (
                  <Send className="size-[16px] md:size-[13px] text-background -translate-x-px translate-y-px" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Token counter + build estimate pill */}
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] font-mono text-[hsl(var(--foreground-subtle))] px-1">
        <div className="min-w-0">
          {mode === "agent" && (
            <EstimatePill
              message={value}
              isEmpty={(projectFiles?.length ?? 0) === 0}
              fileCount={projectFiles?.length ?? 0}
            />
          )}
        </div>
        <span className={cn("tabular-nums transition-colors shrink-0", tokenColor)}>
          {tokenEstimate.toLocaleString()} / {TOKEN_LIMIT.toLocaleString()}
        </span>
      </div>
    </div>
  );
});


function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}
