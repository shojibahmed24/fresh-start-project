// Lightweight client-side "undo last AI update" stack.
//
// Before every agent run we snapshot the current project state (files +
// last assistant message id) into sessionStorage, keyed by project id. The
// undo button in the chat header pops the latest snapshot, restores files
// to disk via Supabase, and removes the assistant message that produced
// the change. Snapshots are session-scoped (cleared on tab close) and
// capped at 10 entries per project to bound memory.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Project, ProjectFile } from "@/lib/store";
import { upsertFiles, deleteFile } from "@/lib/store";

type Snapshot = {
  at: number;
  files: ProjectFile[];
  // ids of messages that existed BEFORE this run. Anything newer is rolled back.
  messageIds: string[];
};

const MAX_DEPTH = 10;
const keyFor = (projectId: string) => `oneclick:undo:${projectId}`;

const readStack = (projectId: string): Snapshot[] => {
  if (!projectId) return [];
  try {
    const raw = sessionStorage.getItem(keyFor(projectId));
    return raw ? (JSON.parse(raw) as Snapshot[]) : [];
  } catch {
    return [];
  }
};

const writeStack = (projectId: string, stack: Snapshot[]) => {
  if (!projectId) return;
  try {
    sessionStorage.setItem(keyFor(projectId), JSON.stringify(stack.slice(-MAX_DEPTH)));
  } catch {
    /* quota — silently drop oldest */
  }
};

export const useBuilderUndo = (
  project: Project | null,
  setProject: React.Dispatch<React.SetStateAction<Project | null>>,
) => {
  const [depth, setDepth] = useState(0);

  // Recompute depth whenever the project changes.
  useEffect(() => {
    if (!project?.id) {
      setDepth(0);
      return;
    }
    setDepth(readStack(project.id).length);
  }, [project?.id]);

  const pushSnapshot = useCallback(() => {
    if (!project?.id) return;
    const stack = readStack(project.id);
    stack.push({
      at: Date.now(),
      files: project.files.map((f) => ({ ...f })),
      messageIds: project.messages.map((m) => m.id),
    });
    writeStack(project.id, stack);
    setDepth(stack.length);
  }, [project]);

  const undo = useCallback(async (): Promise<boolean> => {
    if (!project?.id) return false;
    const stack = readStack(project.id);
    const snap = stack.pop();
    if (!snap) return false;
    writeStack(project.id, stack);
    setDepth(stack.length);

    // 1. Determine which messages are NEW since the snapshot — those are the
    //    AI/user turn(s) we're undoing.
    const knownIds = new Set(snap.messageIds);
    const newMsgIds = project.messages.filter((m) => !knownIds.has(m.id)).map((m) => m.id);

    // 2. Determine which files were CREATED after the snapshot — they need to
    //    be deleted from the DB. Files that existed before but were modified
    //    are restored by upserting the snapshot content.
    const snapPaths = new Set(snap.files.map((f) => f.path));
    const createdPaths = project.files
      .filter((f) => !snapPaths.has(f.path))
      .map((f) => f.path);

    // 3. Persist: delete created files, upsert snapshot content, delete new messages.
    try {
      await Promise.all([
        ...createdPaths.map((p) => deleteFile(project.id, p).catch(() => {})),
        snap.files.length ? upsertFiles(project.id, snap.files) : Promise.resolve(),
        newMsgIds.length
          ? supabase
              .from("chat_messages")
              .delete()
              .in("id", newMsgIds)
              .then(() => undefined)
          : Promise.resolve(),
      ]);
    } catch (err) {
      console.warn("[undo] persist failed:", err);
    }

    // 4. Update local state.
    setProject((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        files: snap.files.map((f) => ({ ...f })),
        messages: prev.messages.filter((m) => knownIds.has(m.id)),
        updatedAt: Date.now(),
      };
    });

    return true;
  }, [project, setProject]);

  const clear = useCallback(() => {
    if (!project?.id) return;
    try {
      sessionStorage.removeItem(keyFor(project.id));
    } catch {
      /* ignore */
    }
    setDepth(0);
  }, [project?.id]);

  return { pushSnapshot, undo, clear, canUndo: depth > 0, depth };
};
