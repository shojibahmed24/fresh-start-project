import { useState } from "react";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { FileTree } from "./FileTree";
import { Folder, ChevronUp } from "lucide-react";
import { haptic } from "@/lib/haptics";
import type { ProjectFile } from "@/lib/store";

type Props = {
  files: ProjectFile[];
  activePath: string;
  onSelect: (path: string) => void;
  onAction?: (action: "rename" | "delete" | "copy" | "new", path: string) => void;
};

/**
 * Mobile-only bottom-sheet wrapper around FileTree.
 * Shows a compact "current file" pill at the top of the editor that opens a
 * full-height drawer with the file tree. Lets the editor use the entire screen
 * by default while keeping file navigation one tap away.
 */
export const MobileFileTreeDrawer = ({ files, activePath, onSelect, onAction }: Props) => {
  const [open, setOpen] = useState(false);
  const activeName = activePath.split("/").pop() ?? "Select file";
  const activeDir = activePath.slice(0, activePath.length - activeName.length).replace(/\/$/, "");

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button
          onClick={() => haptic("light")}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-[hsl(var(--bg-elevated))] border-b border-[hsl(0_0%_100%/0.06)] text-left active:bg-[hsl(var(--bg-muted))] transition-colors"
          aria-label="Open file tree"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="size-7 rounded-md bg-gradient-primary-soft border border-primary/20 flex items-center justify-center shrink-0">
              <Folder size={13} className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-foreground truncate">{activeName}</div>
              {activeDir && (
                <div className="text-[10.5px] font-mono text-[hsl(var(--foreground-subtle))] truncate">
                  {activeDir}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-mono text-[hsl(var(--foreground-subtle))]">
              {files.length} files
            </span>
            <ChevronUp size={14} className="text-[hsl(var(--foreground-muted))]" />
          </div>
        </button>
      </DrawerTrigger>
      <DrawerContent
        className="bg-[hsl(var(--bg-subtle))] border-[hsl(0_0%_100%/0.08)] max-h-[80vh]"
      >
        <div className="px-4 pt-2 pb-1 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-[hsl(var(--foreground-subtle))]">
              Files
            </div>
            <div className="text-sm font-semibold text-foreground">{files.length} in project</div>
          </div>
        </div>
        <div
          className="flex-1 min-h-0 overflow-hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <FileTree
            files={files}
            activePath={activePath}
            onSelect={(p) => {
              haptic("light");
              onSelect(p);
              setOpen(false);
            }}
            onAction={onAction}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
};
