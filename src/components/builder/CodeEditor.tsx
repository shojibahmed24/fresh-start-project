import { lazy, Suspense, useMemo } from "react";
import { FileCode, Download, Package } from "lucide-react";
import type { ProjectFile } from "@/lib/store";
import { CodeEditorSkeleton } from "./Skeletons";
import { toast } from "sonner";

// Monaco is ~2MB — keep it out of the initial bundle. It only loads when a user
// actually opens a file in the Builder.
const Editor = lazy(() => import("@monaco-editor/react").then((m) => ({ default: m.default })));

const langFor = (path: string) => {
  if (path.endsWith(".tsx") || path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".jsx") || path.endsWith(".js")) return "javascript";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".html")) return "html";
  return "plaintext";
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const CodeEditor = ({
  file,
  onChange,
  allFiles,
  projectName,
}: {
  file: ProjectFile | null;
  onChange: (content: string) => void;
  allFiles?: ProjectFile[];
  projectName?: string;
}) => {
  const loadingNode = useMemo(() => <CodeEditorSkeleton />, []);

  const handleDownloadFile = () => {
    if (!file) return;
    const name = file.path.split("/").filter(Boolean).pop() || "file.txt";
    downloadBlob(new Blob([file.content], { type: "text/plain;charset=utf-8" }), name);
    toast.success(`Downloaded ${name}`);
  };

  const handleDownloadProject = async () => {
    const files = allFiles ?? (file ? [file] : []);
    if (files.length === 0) {
      toast.error("No files to download");
      return;
    }
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const f of files) {
        zip.file(f.path.replace(/^\//, ""), f.content);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const safe = (projectName || "project").replace(/[^a-z0-9-_]+/gi, "-");
      downloadBlob(blob, `${safe}.zip`);
      toast.success(`Downloaded ${files.length} files as ZIP`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to build ZIP");
    }
  };

  if (!file) {
    return (
      <div className="h-full flex flex-col">
        {(allFiles?.length ?? 0) > 0 && (
          <div className="px-4 py-2 border-b border-border/50 flex items-center justify-end gap-1">
            <button
              onClick={handleDownloadProject}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs text-[hsl(var(--foreground-muted))] hover:text-foreground hover:bg-[hsl(0_0%_100%/0.06)] transition-colors"
              title="Download full project as ZIP"
            >
              <Package size={12} /> Download project
            </button>
          </div>
        )}
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
          <FileCode size={32} className="opacity-50" />
          <p className="text-sm">Select a file to view its code</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border/50 text-xs font-mono text-muted-foreground flex items-center gap-2">
        <FileCode size={12} className="text-primary" />
        <span className="truncate flex-1">{file.path}</span>
        <button
          onClick={handleDownloadFile}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:text-foreground hover:bg-[hsl(0_0%_100%/0.06)] transition-colors"
          title="Download this file"
        >
          <Download size={11} /> File
        </button>
        {(allFiles?.length ?? 0) > 1 && (
          <button
            onClick={handleDownloadProject}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:text-foreground hover:bg-[hsl(0_0%_100%/0.06)] transition-colors"
            title="Download full project as ZIP"
          >
            <Package size={11} /> ZIP
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <Suspense fallback={<CodeEditorSkeleton />}>
          <Editor
            height="100%"
            path={file.path}
            language={langFor(file.path)}
            value={file.content}
            onChange={(v) => onChange(v ?? "")}
            theme="vs-dark"
            loading={loadingNode}
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              padding: { top: 12 },
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              smoothScrolling: true,
            }}
          />
        </Suspense>
      </div>
    </div>
  );
};
