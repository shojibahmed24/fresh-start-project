import {
  FileCode2, FileJson, FileText, FileType, FileImage, FileCog,
  Folder, FolderOpen, FileCode, Hash, Braces, Palette, Cog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * VSCode-style file icons. Returns a Lucide component + colour class
 * (semantic tokens; cyan for tsx/ts, violet for css, amber for json, etc.)
 */
export interface FileIconInfo {
  Icon: LucideIcon;
  colorClass: string;
}

export const folderIcon = (open: boolean): FileIconInfo => ({
  Icon: open ? FolderOpen : Folder,
  colorClass: "text-[hsl(var(--foreground-muted))]",
});

export const getFileIcon = (path: string): FileIconInfo => {
  const name = path.split("/").pop()?.toLowerCase() ?? "";

  // Special config files
  if (name === "package.json" || name === "package-lock.json")
    return { Icon: FileCog, colorClass: "text-amber-400" };
  if (name === "tsconfig.json" || name.startsWith("tsconfig"))
    return { Icon: Cog, colorClass: "text-sky-400" };
  if (name === "vite.config.ts" || name === "tailwind.config.ts" || name.includes(".config."))
    return { Icon: Cog, colorClass: "text-violet-300" };
  if (name === ".env" || name.startsWith(".env"))
    return { Icon: FileCog, colorClass: "text-yellow-300" };
  if (name === "readme.md" || name === "license")
    return { Icon: FileText, colorClass: "text-[hsl(var(--foreground-muted))]" };

  // By extension
  if (name.endsWith(".tsx")) return { Icon: Braces, colorClass: "text-sky-400" };
  if (name.endsWith(".ts")) return { Icon: FileType, colorClass: "text-blue-400" };
  if (name.endsWith(".jsx")) return { Icon: Braces, colorClass: "text-amber-300" };
  if (name.endsWith(".js")) return { Icon: FileCode, colorClass: "text-yellow-400" };
  if (name.endsWith(".json")) return { Icon: FileJson, colorClass: "text-amber-400" };
  if (name.endsWith(".css") || name.endsWith(".scss"))
    return { Icon: Palette, colorClass: "text-violet-400" };
  if (name.endsWith(".html")) return { Icon: FileCode2, colorClass: "text-orange-400" };
  if (name.endsWith(".md")) return { Icon: Hash, colorClass: "text-[hsl(var(--foreground-muted))]" };
  if (name.endsWith(".svg") || name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".webp") || name.endsWith(".gif"))
    return { Icon: FileImage, colorClass: "text-emerald-400" };

  return { Icon: FileCode, colorClass: "text-[hsl(var(--foreground-subtle))]" };
};
