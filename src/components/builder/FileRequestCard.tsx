// Phase 11 — Renders an inline upload prompt when the agent calls
// `request_file_upload`. The question payload is encoded as
//   __FILE_REQUEST__:{"purpose":"…","accept":"image/*,.pdf","multiple":false}
// We surface a styled drop-zone, parse PDFs/DOCX client-side (same path as
// ChatInput), then resolve the pause channel with a JSON answer the agent
// can read back.

import { useRef, useState } from "react";
import { m } from "framer-motion";
import { Upload, FileText, Image as ImageIcon, X, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  /** Raw question — `__FILE_REQUEST__:` + JSON payload. */
  question: string;
  onAnswer: (answer: string) => void;
};

type ParsedFile = { name: string; kind: "image" | "file"; size: number; mime: string; content: string };

export const FileRequestCard = ({ question, onAnswer }: Props) => {
  const payload = (() => {
    try {
      return JSON.parse(question.replace(/^__FILE_REQUEST__:/, ""));
    } catch {
      return { purpose: "Upload a file", accept: "*/*", multiple: false };
    }
  })();

  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [busy, setBusy] = useState(false);

  const handleFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setBusy(true);
    const { isPdf, isDocx, parsePdf, parseDocx } = await import("@/lib/parseDocument");
    const out: ParsedFile[] = [];
    for (const f of Array.from(list)) {
      try {
        let content: string;
        let mime = f.type;
        let kind: "image" | "file" = "file";
        if (f.type.startsWith("image/")) {
          kind = "image";
          content = await new Promise<string>((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(String(r.result));
            r.onerror = rej;
            r.readAsDataURL(f);
          });
        } else if (isPdf(f)) {
          const parsed = await parsePdf(f);
          content = parsed.text;
          mime = "text/plain";
        } else if (isDocx(f)) {
          const parsed = await parseDocx(f);
          content = parsed.text;
          mime = "text/plain";
        } else {
          content = await f.text();
        }
        out.push({ name: f.name, kind, size: f.size, mime, content });
      } catch (e) {
        console.error("file parse failed", e);
        toast.error(`Failed to read ${f.name}`);
      }
    }
    setFiles((prev) => (payload.multiple ? [...prev, ...out] : out));
    setBusy(false);
  };

  const submit = () => {
    if (files.length === 0) {
      onAnswer("Skip");
      return;
    }
    // Encode files into the answer so the agent's resume turn receives them.
    // The hook (useBuilderAgent) pulls these out and forwards as `attachments`.
    onAnswer(`__FILES__:${JSON.stringify(files)}`);
  };

  const skip = () => onAnswer("Skip");

  return (
    <m.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-4 space-y-3"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Upload className="size-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Agent needs a file</p>
          <p className="text-xs text-muted-foreground mt-0.5">{payload.purpose}</p>
          {payload.accept && payload.accept !== "*/*" && (
            <p className="text-[10px] text-muted-foreground/70 mt-1 font-mono">accept: {payload.accept}</p>
          )}
        </div>
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-lg border-2 border-dashed border-border p-4 text-center cursor-pointer hover:border-primary/50 transition-colors",
          busy && "opacity-50 pointer-events-none",
        )}
      >
        <Upload className="size-5 mx-auto text-muted-foreground mb-1" />
        <p className="text-xs text-muted-foreground">
          {busy ? "Parsing…" : "Click or drop file" + (payload.multiple ? "s" : "")}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={payload.accept || undefined}
        multiple={!!payload.multiple}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-xs"
            >
              {f.kind === "image" ? (
                <ImageIcon className="size-3.5 text-muted-foreground" />
              ) : (
                <FileText className="size-3.5 text-muted-foreground" />
              )}
              <span className="flex-1 truncate font-medium">{f.name}</span>
              <span className="text-muted-foreground tabular-nums">
                {(f.size / 1024).toFixed(0)} KB
              </span>
              <button
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${f.name}`}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={skip} disabled={busy}>
          Skip
        </Button>
        <Button size="sm" onClick={submit} disabled={busy || files.length === 0}>
          <Check className="size-3.5 mr-1" />
          Send {files.length > 0 ? `(${files.length})` : ""}
        </Button>
      </div>
    </m.div>
  );
};
