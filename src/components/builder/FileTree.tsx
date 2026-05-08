import { useMemo, useState } from "react";
import { ChevronRight, Pencil, Trash2, Copy, FilePlus } from "lucide-react";
import { m, AnimatePresence } from "framer-motion";
import type { ProjectFile } from "@/lib/store";
import { getFileIcon, folderIcon } from "./file-icons";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface TreeNode {
  name: string;
  path: string;
  isFile: boolean;
  children: TreeNode[];
}

function buildTree(files: ProjectFile[]): TreeNode {
  const root: TreeNode = { name: "", path: "", isFile: false, children: [] };
  for (const f of files) {
    const parts = f.path.split("/").filter(Boolean);
    let cur = root;
    parts.forEach((seg, i) => {
      const isLast = i === parts.length - 1;
      let child = cur.children.find((c) => c.name === seg);
      if (!child) {
        child = {
          name: seg,
          path: parts.slice(0, i + 1).join("/"),
          isFile: isLast,
          children: [],
        };
        cur.children.push(child);
      }
      cur = child;
    });
  }
  const sort = (n: TreeNode) => {
    n.children.sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    n.children.forEach(sort);
  };
  sort(root);
  return root;
}

type ActionFn = (action: "rename" | "delete" | "copy" | "new", path: string) => void;

const FileRow = ({
  node, depth, active, onSelect, onAction,
}: { node: TreeNode; depth: number; active: string; onSelect: (p: string) => void; onAction?: ActionFn }) => {
  const { Icon, colorClass } = getFileIcon(node.path);
  const isActive = active === node.path;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSelect(node.path);
          }}
          onPointerUp={(e) => {
            // Fallback for environments where Radix ContextMenuTrigger swallows
            // the synthetic click (left button only — right-click still opens menu).
            if (e.button !== 0) return;
            onSelect(node.path);
          }}
          className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs font-mono text-left transition-colors duration-150
            ${isActive
              ? "bg-primary/12 text-foreground border border-primary/25"
              : "text-[hsl(var(--foreground-muted))] hover:bg-[hsl(0_0%_100%/0.04)] hover:text-foreground border border-transparent"}`}
          style={{ paddingLeft: 8 + depth * 14 }}
        >
          <Icon size={13} className={colorClass} />
          <span className="truncate">{node.name}</span>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent className="glass-overlay min-w-[180px]">
        <ContextMenuItem onClick={() => onAction?.("rename", node.path)}>
          <Pencil className="size-3.5 mr-2" /> Rename
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onAction?.("copy", node.path)}>
          <Copy className="size-3.5 mr-2" /> Copy path
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => onAction?.("delete", node.path)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="size-3.5 mr-2" /> Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

const FolderRow = ({
  node, depth, active, onSelect, onAction,
}: { node: TreeNode; depth: number; active: string; onSelect: (p: string) => void; onAction?: ActionFn }) => {
  const [open, setOpen] = useState(depth < 2);
  const { Icon, colorClass } = folderIcon(open);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1 px-2 py-1 rounded text-xs font-mono font-medium text-foreground hover:bg-[hsl(0_0%_100%/0.04)] transition-colors duration-150"
        style={{ paddingLeft: 4 + depth * 14 }}
      >
        <ChevronRight
          size={12}
          className={`transition-transform duration-200 text-[hsl(var(--foreground-subtle))] ${open ? "rotate-90" : ""}`}
        />
        <Icon size={13} className={colorClass} />
        <span className="truncate">{node.name}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            {node.children.map((c) =>
              c.isFile ? (
                <FileRow key={c.path} node={c} depth={depth + 1} active={active} onSelect={onSelect} onAction={onAction} />
              ) : (
                <FolderRow key={c.path} node={c} depth={depth + 1} active={active} onSelect={onSelect} onAction={onAction} />
              ),
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const FileTree = ({
  files, activePath, onSelect, onAction,
}: { files: ProjectFile[]; activePath: string; onSelect: (path: string) => void; onAction?: ActionFn }) => {
  const tree = useMemo(() => buildTree(files), [files]);

  if (files.length === 0) {
    return (
      <div className="p-4 text-xs text-[hsl(var(--foreground-subtle))] text-center">
        No files yet — describe your app to generate.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto py-2">
      <div className="flex items-center justify-between px-3 pb-1.5 mb-1 border-b border-[hsl(0_0%_100%/0.06)]">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[hsl(var(--foreground-subtle))]">
          Explorer · {files.length}
        </span>
        <button
          className="p-1 rounded hover:bg-[hsl(0_0%_100%/0.06)] text-[hsl(var(--foreground-subtle))] hover:text-foreground transition-colors"
          onClick={() => onAction?.("new", "")}
          title="New file"
          aria-label="New file"
        >
          <FilePlus size={12} />
        </button>
      </div>
      {tree.children.map((c) =>
        c.isFile ? (
          <FileRow key={c.path} node={c} depth={0} active={activePath} onSelect={onSelect} onAction={onAction} />
        ) : (
          <FolderRow key={c.path} node={c} depth={0} active={activePath} onSelect={onSelect} onAction={onAction} />
        ),
      )}
    </div>
  );
};
