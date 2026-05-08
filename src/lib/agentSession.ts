// Persistent agent session storage — survives page reloads and tab switches
// so a user who accidentally refreshes mid-conversation doesn't lose their
// pending question + agent context.
//
// Per-project key: `agent-session-${projectId}`
// Auto-expires after 1 hour (stale runs would point at outdated tool_call_ids).

import type { TimelineStep } from "@/components/builder/AgentTimeline";

const TTL_MS = 60 * 60 * 1000; // 1 hour
const KEY_PREFIX = "agent-session-";

export type PendingQuestion = {
  id: string;
  question: string;
  options: string[];
  allowOther?: boolean;
};

export type AgentSession = {
  pendingQuestion: PendingQuestion | null;
  agentSteps: TimelineStep[];
  // OpenAI-format conversation history echoed by the backend on `paused`.
  conversationHistory: any[];
  // Original prompt that started the run — handy for debugging.
  originalMessage: string;
  // Last pending question text (for resume answer wrapping).
  pendingQuestionText: string;
  timestamp: number;
};

const keyFor = (projectId: string) => `${KEY_PREFIX}${projectId}`;

export function saveAgentSession(projectId: string, session: Omit<AgentSession, "timestamp">): void {
  if (!projectId) return;
  try {
    const payload: AgentSession = { ...session, timestamp: Date.now() };
    localStorage.setItem(keyFor(projectId), JSON.stringify(payload));
  } catch (err) {
    // Quota or serialization issue — non-fatal.
    console.warn("[agentSession] save failed:", err);
  }
}

export function loadAgentSession(projectId: string): AgentSession | null {
  if (!projectId) return null;
  try {
    const raw = localStorage.getItem(keyFor(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AgentSession;
    if (!parsed?.timestamp || Date.now() - parsed.timestamp > TTL_MS) {
      localStorage.removeItem(keyFor(projectId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearAgentSession(projectId: string): void {
  if (!projectId) return;
  try {
    localStorage.removeItem(keyFor(projectId));
  } catch {
    /* ignore */
  }
}

// Best-effort sweep of stale sessions across all projects (called once on mount).
export function purgeExpiredAgentSessions(): void {
  try {
    const now = Date.now();
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(KEY_PREFIX)) continue;
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || "{}");
        if (!parsed?.timestamp || now - parsed.timestamp > TTL_MS) {
          toRemove.push(key);
        }
      } catch {
        toRemove.push(key);
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
