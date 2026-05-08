import { useEffect, useMemo, useRef, useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { Smartphone, Download, Loader2, CheckCircle2, XCircle, Circle, ExternalLink, Copy, RotateCw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useBuildLive } from "@/hooks/useAppBuilds";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { celebrate } from "@/lib/celebrate";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  // Optional: if provided, dialog binds to this existing build instead of
  // showing the "Start build" screen. Used when reopening from the live badge.
  initialBuildId?: string | null;
  // Notify parent of the active build id so a floating badge can track it.
  onBuildIdChange?: (id: string | null) => void;
};

export function BuildAPKDialog({ open, onOpenChange, projectId, initialBuildId, onBuildIdChange }: Props) {
  const [buildId, setBuildId] = useState<string | null>(initialBuildId ?? null);
  const [starting, setStarting] = useState(false);
  const { build, steps } = useBuildLive(buildId);

  // Keep local state in sync with parent-supplied id (e.g. user reopens dialog
  // for an in-flight build via the floating badge).
  useEffect(() => {
    if (initialBuildId && initialBuildId !== buildId) setBuildId(initialBuildId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBuildId]);

  // Notify parent whenever our tracked id changes (start, reset, etc.)
  useEffect(() => {
    onBuildIdChange?.(buildId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildId]);

  // Reset *only* the starting flag on close; keep buildId so the badge stays
  // bound to the in-flight build. We only clear buildId when the build is
  // terminal (ready/failed/cancelled) and the user closes the dialog.
  useEffect(() => {
    if (!open) {
      setStarting(false);
      const terminal = build?.status === "ready" || build?.status === "failed" || build?.status === "cancelled";
      if (terminal) setBuildId(null);
    }
  }, [open, build?.status]);

  const startBuild = async () => {
    setStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke("trigger-build", {
        body: { projectId, platform: "android" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setBuildId((data as any).build_id);
      toast.success("Build started on GitHub Actions");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start build");
    } finally {
      setStarting(false);
    }
  };

  const isFailed = build?.status === "failed" || build?.status === "cancelled";
  const isReady = build?.status === "ready" && !!build.download_url;

  // Confetti on first transition to ready state
  const celebratedRef = useRef(false);
  useEffect(() => {
    if (isReady && !celebratedRef.current) {
      celebratedRef.current = true;
      celebrate("build");
    }
    if (!open) celebratedRef.current = false;
  }, [isReady, open]);
  const overallProgress = useMemo(() => {
    if (!steps.length) return 0;
    const done = steps.filter((s) => s.status === "done").length;
    return Math.round((done / steps.length) * 100);
  }, [steps]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-primary/15 via-transparent to-transparent px-6 pt-6 pb-4 border-b border-border/50">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Smartphone size={20} className="text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base">Build Android APK</DialogTitle>
                <DialogDescription className="text-xs">
                  Compile your project into an installable .apk via GitHub Actions
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 max-h-[65vh] overflow-y-auto">
          {!buildId && !starting && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                <p>• Build runs on our central GitHub Actions runner.</p>
                <p>• Typical time: <span className="text-foreground font-medium">3–6 minutes</span>.</p>
                <p>• You'll get a direct download link + QR code when done.</p>
              </div>
              <Button onClick={startBuild} className="w-full" size="lg">
                <Smartphone size={16} className="mr-2" /> Start Android build
              </Button>
            </div>
          )}

          {(buildId || starting) && (
            <div className="space-y-5">
              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span className="font-mono">
                    {build?.status?.toUpperCase() ?? "STARTING"}
                  </span>
                  <span>{overallProgress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <m.div
                    className={cn(
                      "h-full rounded-full",
                      isFailed ? "bg-destructive" : isReady ? "bg-emerald-500" : "bg-primary",
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${overallProgress}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              </div>

              {/* Steps timeline */}
              <ol className="space-y-2.5">
                {steps.map((s) => (
                  <StepRow key={s.id} step={s} />
                ))}
                {!steps.length && (
                  <li className="text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Queueing on GitHub…
                  </li>
                )}
              </ol>

              {/* GitHub run link */}
              {build?.github_run_url && (
                <a
                  href={build.github_run_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink size={12} /> View live logs on GitHub
                </a>
              )}

              {/* Failed */}
              {isFailed && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <XCircle size={16} /> Build failed
                  </div>
                  {build?.error_message && (
                    <p className="text-xs text-destructive/90 font-mono whitespace-pre-wrap break-words">
                      {build.error_message.slice(0, 400)}
                    </p>
                  )}
                  <Button size="sm" variant="outline" onClick={() => { setBuildId(null); startBuild(); }}>
                    <RotateCw size={14} className="mr-1.5" /> Retry build
                  </Button>
                </div>
              )}

              {/* Ready: download + QR */}
              <AnimatePresence>
                {isReady && build?.download_url && (
                  <m.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-4"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={16} /> APK ready!
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 items-center">
                      <div className="bg-white p-2 rounded-lg shrink-0">
                        <QRCodeSVG value={build.download_url} size={120} level="M" />
                      </div>
                      <div className="flex-1 space-y-2 w-full">
                        <p className="text-xs text-muted-foreground">
                          Scan with your phone to install, or download below.
                        </p>
                        {build.file_size_bytes && (
                          <p className="text-xs text-muted-foreground">
                            Size: {(build.file_size_bytes / (1024 * 1024)).toFixed(1)} MB
                          </p>
                        )}
                        <div className="flex gap-2">
                          <Button asChild size="sm" className="flex-1">
                            <a href={build.download_url} target="_blank" rel="noreferrer">
                              <Download size={14} className="mr-1.5" /> Download
                            </a>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(build.download_url!);
                              toast.success("Link copied");
                            }}
                          >
                            <Copy size={14} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StepRow({ step }: { step: { step_key: string; label: string; status: string; detail: string | null } }) {
  const Icon =
    step.status === "done" ? CheckCircle2 :
    step.status === "failed" ? XCircle :
    step.status === "running" ? Loader2 : Circle;

  const color =
    step.status === "done" ? "text-emerald-500" :
    step.status === "failed" ? "text-destructive" :
    step.status === "running" ? "text-primary" : "text-muted-foreground/50";

  return (
    <li className="flex items-start gap-2.5 text-sm">
      <Icon size={15} className={cn("mt-0.5 shrink-0", color, step.status === "running" && "animate-spin")} />
      <div className="flex-1 min-w-0">
        <div className={cn("text-xs", step.status === "pending" ? "text-muted-foreground" : "text-foreground")}>
          {step.label}
        </div>
        {step.detail && (
          <div className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">
            {step.detail}
          </div>
        )}
      </div>
    </li>
  );
}
