// Helpers to detect "resume / continue" prompts and rewrite them with full
// context (real files, broken placeholders, recent generation log) so the
// LLM keeps the SAME app instead of re-planning a new one.
//
// Extracted from Builder.tsx to keep the page slim. Pure functions — no React,
// no side effects — so they're trivial to unit test.

import type { Project, ProjectFile } from "@/lib/store";

export const isGeneratedFallbackContent = (content: string | null | undefined): boolean => {
  const text = String(content ?? "");
  return /Generator hit an error on App\.tsx|placeholder · retry to generate|Placeholder — generation failed|Ask the AI to "fix [^"]+" to retry|baseline shell|App ready/i.test(
    text,
  );
};

// ---------------------------------------------------------------------------
// Build-log noise classifier
// ---------------------------------------------------------------------------
// Historically, every status line emitted during a streaming build (e.g.
// "Will create src/App.tsx", "Writing src/index.css", "Chunk 2/4 done",
// "🧹 Auto-fixed 3 files…") was persisted as an assistant message in
// `chat_messages`. That created two problems:
//   1. The chat UI re-rendered hundreds of low-signal lines on reload.
//   2. On auto-resume, those lines were stuffed back into the prompt as
//      `recentGenerationLog`, ballooning the context window and confusing
//      the model — leading to longer generations, more timeouts, and more
//      failed patches.
//
// This helper identifies those legacy build-log rows so we can hide them in
// the UI AND skip them when assembling resume context. Real conversation
// (user prompts, final summaries, Q&A, plan descriptions) is preserved.
const BUILD_LOG_PREFIX_RE =
  /^(?:Will (?:create|patch|write|update)|Writing|Patching|Generating|Generated|Creating|Updating|Skipped|Chunk\s*\d|Syntax error|Auto[- ]fix|Local fix|Semantic fix|Resuming|Connection (?:dropped|closed|failed)|Streaming|Plan(?:ning)?|🧹|🛠️|🛡️|🔄|📝|📦|⚙️|✏️)/i;

// Bounded check: count how many lines start with a file-path-ish "src/" marker.
// Replaces the previous catastrophic-backtracking regex
// (/^(?:[\s\S]*?\n){3,}\s*[-•]?\s*src\//m) which crashed Firefox with
// "too much recursion" on long assistant messages.
const looksLikeFilePathList = (text: string): boolean => {
  // Cap work: only scan the first ~8KB and first 200 lines.
  const slice = text.length > 8192 ? text.slice(0, 8192) : text;
  const lines = slice.split("\n", 200);
  let hits = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*[-•]?\s*src\//.test(lines[i])) {
      hits++;
      if (hits >= 3) return true;
    }
  }
  return false;
};

export const isBuildLogMessage = (msg: { role: string; content: string }): boolean => {
  if (msg.role !== "assistant") return false;
  const text = String(msg.content ?? "").trim();
  if (!text) return false;
  // Final summary lines like "✅ Built 22 files: …" are clean — keep them.
  if (/^✅\s+Built\s+\d+/i.test(text)) return false;
  if (text.length < 12) return false; // short replies are conversation
  // Only test the first line for the prefix pattern — bounded work.
  const firstLine = text.split("\n", 1)[0];
  if (BUILD_LOG_PREFIX_RE.test(firstLine)) return true;
  return looksLikeFilePathList(text);
};

const RESUME_RE =
  /\b(resume|continue|keep going|pick up where|where you stopped|finish|complete)\b|continue from where|next theke|start koro|suru koro|shuru koro|theke\s+(?:suru|shuru)\s+koro|(?:jei|je|jey|jekhane|jeikhane).*?(?:ses|shesh).*?(?:korcho|korecho|hoise|hoyeche)/i;

export function normalizeResumePrompt(
  text: string,
  snapshot: Project | null,
  recentGenerationLogOverride?: string,
): string {
  if (!snapshot?.files.length) return text;
  if (!RESUME_RE.test(text)) return text;

  const realFiles = snapshot.files
    .filter((file) => !isGeneratedFallbackContent(file.content))
    .map((file) => file.path);
  const placeholders = snapshot.files
    .filter((file) => isGeneratedFallbackContent(file.content))
    .map((file) => file.path);
  const recentGenerationLog =
    recentGenerationLogOverride?.slice(-3500) ||
    [...snapshot.messages]
      .reverse()
      .find(
        (message) =>
          message.role === "assistant" &&
          // Only consider clean "real" assistant turns — never legacy build-log rows.
          !isBuildLogMessage(message) &&
          /(Will create|Will patch|Writing|Patching|Chunk|Syntax error|Skipped|Generated|Built\s+\d+)/i.test(
            message.content,
          ),
      )
      ?.content.slice(-3500);

  return `${text}

---
**RESUME REQUEST**
Continue the SAME existing app. Do NOT create a new plan. Do NOT rewrite these completed files:
${realFiles.length ? realFiles.map((path) => `- ${path}`).join("\n") : "- (none yet)"}

Regenerate placeholder/broken files first, then add only truly missing files:
${placeholders.length ? placeholders.map((path) => `- ${path}`).join("\n") : "- (none detected)"}
${
  recentGenerationLog
    ? `\nRecent generation log — use this to continue from the exact last unfinished file, not to re-plan:\n\`\`\`\n${recentGenerationLog}\n\`\`\``
    : ""
}

Keep the original app idea and continue from the next unfinished file.`;
}

export function buildAutoResumePrompt(
  originalText: string,
  statusLog: string,
  latestProject: Project | null,
  newFiles: ProjectFile[] = [],
  lastBuildIntent = "",
): string {
  if (!latestProject) return originalText;
  const baseIntent = /^(continue|resume|keep going|finish|complete)$/i.test(originalText.trim())
    ? lastBuildIntent || originalText
    : originalText;

  const mergedFiles = new Map<string, ProjectFile>();
  for (const file of latestProject.files) mergedFiles.set(file.path, file);
  for (const file of newFiles) mergedFiles.set(file.path, file);

  const snapshot: Project = {
    ...latestProject,
    files: Array.from(mergedFiles.values()),
  };

  return normalizeResumePrompt(
    `${baseIntent}\n\nContinue from where you stopped. Do NOT start over, switch app domain, or create a different file plan.`,
    snapshot,
    statusLog,
  );
}

export function mergeProjectSnapshot(
  snapshot: Project | null | undefined,
  extraFiles: ProjectFile[] = [],
): Project | null {
  if (!snapshot) return null;
  if (extraFiles.length === 0) return snapshot;

  const mergedFiles = new Map(snapshot.files.map((file) => [file.path, file]));
  for (const file of extraFiles) mergedFiles.set(file.path, file);

  return {
    ...snapshot,
    files: Array.from(mergedFiles.values()),
  };
}
