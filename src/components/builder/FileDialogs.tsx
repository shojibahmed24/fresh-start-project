// File operation dialogs for the builder file tree.
// - RenameFileDialog: inline path edit with validation
// - DeleteFileDialog: destructive confirm (AlertDialog)
// - NewFileDialog: path input with template suggestion
//
// All dialogs are controlled via { open, onOpenChange } so the parent owns state.
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash2, FilePlus, Pencil } from "lucide-react";

const PATH_RE = /^[\w./-]+\.[a-zA-Z0-9]{1,8}$/;

function validatePath(p: string, existing: Set<string>, allowSame?: string): string | null {
  const path = p.trim();
  if (!path) return "Path required";
  if (path.length > 200) return "Path too long";
  if (path.startsWith("/")) return "Path must be relative (no leading /)";
  if (path.includes("..")) return "Path cannot contain ..";
  if (!PATH_RE.test(path)) return "Path must include a file extension (e.g. src/foo.tsx)";
  if (existing.has(path) && path !== allowSame) return "A file already exists at that path";
  return null;
}

export const RenameFileDialog = ({
  open,
  onOpenChange,
  currentPath,
  existingPaths,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentPath: string;
  existingPaths: Set<string>;
  onConfirm: (newPath: string) => Promise<void> | void;
}) => {
  const [value, setValue] = useState(currentPath);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(currentPath);
      setError(null);
    }
  }, [open, currentPath]);

  const submit = async () => {
    const err = validatePath(value, existingPaths, currentPath);
    if (err) return setError(err);
    if (value.trim() === currentPath) return onOpenChange(false);
    setBusy(true);
    try {
      await onConfirm(value.trim());
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message || "Rename failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-4" /> Rename file
          </DialogTitle>
          <DialogDescription>
            Move or rename <span className="font-mono">{currentPath}</span>. Imports
            referencing the old path will not auto-update.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="rename-path">New path</Label>
          <Input
            id="rename-path"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoFocus
            spellCheck={false}
            className="font-mono text-sm"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const DeleteFileDialog = ({
  open,
  onOpenChange,
  path,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  path: string;
  onConfirm: () => Promise<void> | void;
}) => {
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="size-4 text-destructive" /> Delete file?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete{" "}
            <span className="font-mono text-foreground">{path}</span> from your
            project. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              submit();
            }}
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export const NewFileDialog = ({
  open,
  onOpenChange,
  existingPaths,
  defaultDir = "src/",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingPaths: Set<string>;
  defaultDir?: string;
  onConfirm: (path: string) => Promise<void> | void;
}) => {
  const [value, setValue] = useState(defaultDir);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(defaultDir);
      setError(null);
    }
  }, [open, defaultDir]);

  const submit = async () => {
    const err = validatePath(value, existingPaths);
    if (err) return setError(err);
    setBusy(true);
    try {
      await onConfirm(value.trim());
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message || "Create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FilePlus className="size-4" /> New file
          </DialogTitle>
          <DialogDescription>
            Create a new empty file. Use a relative path with an extension (e.g.{" "}
            <span className="font-mono">src/components/Foo.tsx</span>).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="new-path">Path</Label>
          <Input
            id="new-path"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoFocus
            spellCheck={false}
            placeholder="src/components/Foo.tsx"
            className="font-mono text-sm"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
