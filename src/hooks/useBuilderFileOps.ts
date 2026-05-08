// Builder file-operations hook.
//
// Pulls the "rename / delete / copy / new file" plumbing out of Builder.tsx.
// Keeps Builder.tsx focused on chat + agent + preview orchestration, and lets
// us unit-test file CRUD without spinning up the whole page.
//
// What lives here:
//   - The file dialog state machine (rename | delete | new) + open/close UI helpers
//   - `handleFileChange`           → save edited file content (debounced through Supabase)
//   - `handleFileAction`           → router for tree-row actions
//   - `applyFileOp`                → executes the actual CRUD against `store.ts`
//
// What stays in Builder.tsx:
//   - Anything that needs to know about chat/agent state (e.g. the MOBILE_TABS
//     navigation switch).

import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  renameFile,
  deleteFile,
  createFile,
  updateFileContent,
  type Project,
  type ProjectFile,
} from "@/lib/store";

export type FileDialog =
  | { kind: "rename" | "delete"; path: string }
  | { kind: "new"; path: string }
  | null;

export type FileAction = "rename" | "delete" | "copy" | "new";
export type FileOp = "rename" | "delete" | "create";

export interface UseBuilderFileOpsArgs {
  project: Project | null;
  setProject: React.Dispatch<React.SetStateAction<Project | null>>;
  activePath: string;
  setActivePath: (p: string) => void;
  /** Optional callback when a new file is created — lets the page swap UI to the editor. */
  onAfterCreate?: (path: string) => void;
}

export function useBuilderFileOps({
  project,
  setProject,
  activePath,
  setActivePath,
  onAfterCreate,
}: UseBuilderFileOpsArgs) {
  const [fileDialog, setFileDialog] = useState<FileDialog>(null);

  const closeDialog = useCallback(() => setFileDialog(null), []);

  // Persist a code edit from the editor back to Supabase.
  const handleFileChange = useCallback(
    async (content: string) => {
      if (!project || !activePath) return;
      setProject((prev) =>
        prev
          ? {
              ...prev,
              files: prev.files.map((f) =>
                f.path === activePath ? { ...f, content } : f,
              ),
            }
          : prev,
      );
      try {
        await updateFileContent(project.id, activePath, content);
      } catch (e: any) {
        toast.error(e?.message ?? "Could not save file");
      }
    },
    [project, activePath, setProject],
  );

  // Tree-row action router: rename / delete open dialogs, copy is instant,
  // and "new" opens the new-file dialog seeded with the active directory.
  const handleFileAction = useCallback(
    (action: FileAction, path: string) => {
      if (action === "copy" && path) {
        navigator.clipboard.writeText(path).then(() => toast.success("Path copied"));
        return;
      }
      if (action === "new") {
        const activeDir = activePath
          ? activePath.split("/").slice(0, -1).join("/") + "/"
          : "src/";
        setFileDialog({ kind: "new", path: activeDir });
        return;
      }
      if (action === "rename" || action === "delete") {
        setFileDialog({ kind: action, path });
      }
    },
    [activePath],
  );

  // Execute an actual CRUD op (called from the dialog confirm buttons).
  const applyFileOp = useCallback(
    async (op: FileOp, path: string, newPath?: string) => {
      if (!project) return;
      try {
        if (op === "rename" && newPath) {
          await renameFile(project.id, path, newPath);
          setProject((prev) =>
            prev
              ? {
                  ...prev,
                  files: prev.files.map((f) =>
                    f.path === path
                      ? { ...f, path: newPath, updatedAt: Date.now() }
                      : f,
                  ),
                }
              : prev,
          );
          if (activePath === path) setActivePath(newPath);
          toast.success(`Renamed to ${newPath}`);
        } else if (op === "delete") {
          await deleteFile(project.id, path);
          let nextActive: string | undefined;
          setProject((prev) => {
            if (!prev) return prev;
            const remaining = prev.files.filter((f) => f.path !== path);
            if (activePath === path) {
              nextActive = remaining[0]?.path ?? "";
            }
            return { ...prev, files: remaining };
          });
          if (nextActive !== undefined) setActivePath(nextActive);
          toast.success(`Deleted ${path}`);
        } else if (op === "create") {
          await createFile(project.id, path, "");
          const newFile: ProjectFile = { path, content: "", updatedAt: Date.now() };
          setProject((prev) =>
            prev ? { ...prev, files: [...prev.files, newFile] } : prev,
          );
          setActivePath(path);
          onAfterCreate?.(path);
          toast.success(`Created ${path}`);
        }
      } catch (e: any) {
        toast.error(e?.message ?? "File operation failed");
      }
    },
    [project, activePath, setProject, setActivePath, onAfterCreate],
  );

  return {
    fileDialog,
    setFileDialog,
    closeDialog,
    handleFileChange,
    handleFileAction,
    applyFileOp,
  };
}
