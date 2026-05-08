// EstimatePill — small inline indicator showing the estimated effort for the
// current draft message in the chat input. Debounced (~600ms) so we don't
// hammer the edge function on every keystroke.
//
// Tap the pill to expand into a fuller breakdown popover: files, minutes,
// model, migrations, complexity.

import { useEffect, useRef, useState } from "react";
import { Loader2, Clock, FileCode, Database, Sparkles } from "lucide-react";
import { estimateBuild, formatModelLabel, type BuildEstimate } from "@/lib/estimateBuild";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Props = {
  message: string;
  isEmpty: boolean;
  fileCount: number;
  /** When false the pill renders nothing (e.g. plan mode draft). */
  enabled?: boolean;
};

export function EstimatePill({ message, isEmpty, fileCount, enabled = true }: Props) {
  const [estimate, setEstimate] = useState<BuildEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastReqRef = useRef<string>("");

  useEffect(() => {
    if (!enabled) return;
    const trimmed = message.trim();
    if (trimmed.length < 12) {
      setEstimate(null);
      setLoading(false);
      return;
    }
    // Debounce 600ms.
    const handle = setTimeout(async () => {
      // Skip if identical request already in-flight or just resolved.
      if (lastReqRef.current === trimmed) return;
      lastReqRef.current = trimmed;
      try { abortRef.current?.abort(); } catch {/* noop */}
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      const out = await estimateBuild({
        message: trimmed,
        isEmpty,
        fileCount,
        signal: ctrl.signal,
      });
      if (!ctrl.signal.aborted) {
        setEstimate(out);
        setLoading(false);
      }
    }, 600);
    return () => clearTimeout(handle);
  }, [message, isEmpty, fileCount, enabled]);

  if (!enabled) return null;
  if (!estimate && !loading) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[hsl(var(--bg-muted))] text-[hsl(var(--foreground-muted))] hover:text-foreground transition-colors border border-[hsl(var(--border))]"
          aria-label="Build estimate"
        >
          {loading ? (
            <>
              <Loader2 size={10} className="animate-spin" />
              <span>Estimating…</span>
            </>
          ) : estimate ? (
            <>
              <FileCode size={10} />
              <span>~{estimate.files} files</span>
              <span className="opacity-50">·</span>
              <Clock size={10} />
              <span>~{estimate.minutes} min</span>
            </>
          ) : null}
        </button>
      </PopoverTrigger>
      {estimate && (
        <PopoverContent
          align="end"
          side="top"
          className="w-[260px] p-3 text-xs"
        >
          <div className="font-semibold text-[11px] uppercase tracking-wide mb-2 text-[hsl(var(--foreground-muted))]">
            Build estimate
          </div>
          <p className="text-[12px] mb-3 leading-snug">{estimate.summary}</p>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <Row icon={<FileCode size={11} />} label="Files" value={`~${estimate.files}`} />
            <Row icon={<Clock size={11} />} label="Time" value={`~${estimate.minutes} min`} />
            <Row icon={<Sparkles size={11} />} label="Model" value={formatModelLabel(estimate.model)} />
            <Row icon={<Database size={11} />} label="Migrations" value={String(estimate.migrations)} />
          </div>
          <div className="mt-3 pt-2 border-t border-[hsl(var(--border))] text-[10px] text-[hsl(var(--foreground-muted))]">
            Complexity:{" "}
            <span className="font-medium text-foreground">{estimate.complexity}</span>
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
}

function Row({
  icon,
  label,
  value,
}: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[hsl(var(--foreground-muted))]">{icon}</span>
      <span className="text-[hsl(var(--foreground-muted))]">{label}:</span>
      <span className="font-medium ml-auto">{value}</span>
    </div>
  );
}
