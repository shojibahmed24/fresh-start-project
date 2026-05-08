// PathHighlight — renders a file path with subtle syntax-style highlighting.
// Folders are dim, the filename is bright, the extension is purple, and "/"
// separators get a slim purple tint. Designed for inline use inside pill
// buttons and tool rows.
import { memo } from "react";
import { cn } from "@/lib/utils";

type Props = {
  path: string;
  /** Truncate to last N segments. 0 = no truncation. Default 0. */
  maxSegments?: number;
  className?: string;
};

export const PathHighlight = memo(function PathHighlight({
  path,
  maxSegments = 0,
  className,
}: Props) {
  if (!path) return null;
  let segments = path.split("/").filter(Boolean);
  let truncated = false;
  if (maxSegments > 0 && segments.length > maxSegments) {
    segments = segments.slice(-maxSegments);
    truncated = true;
  }
  const fileName = segments[segments.length - 1] ?? "";
  const folders = segments.slice(0, -1);
  const dotIdx = fileName.lastIndexOf(".");
  const base = dotIdx > 0 ? fileName.slice(0, dotIdx) : fileName;
  const ext = dotIdx > 0 ? fileName.slice(dotIdx) : "";

  return (
    <code
      className={cn(
        "font-mono text-[11.5px] truncate min-w-0 inline-flex items-baseline",
        className,
      )}
    >
      {truncated && <span className="text-violet-400/60">…/</span>}
      {folders.map((f, i) => (
        <span key={i} className="inline-flex items-baseline">
          <span className="text-foreground/55">{f}</span>
          <span className="text-violet-400/70 mx-[1px]">/</span>
        </span>
      ))}
      <span className="text-foreground font-medium">{base}</span>
      {ext && <span className="text-violet-300">{ext}</span>}
    </code>
  );
});
