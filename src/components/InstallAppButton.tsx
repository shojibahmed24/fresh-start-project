import { useState } from "react";
import { Download, Share, Plus, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { toast } from "sonner";

interface Props {
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "sm" | "default" | "lg";
  className?: string;
  label?: string;
}

/**
 * Cross-platform "Install app" button.
 *  - Android / Desktop Chromium: triggers native install prompt
 *  - iOS Safari: opens dialog with Add-to-Home-Screen instructions
 *  - Hidden entirely if app is already installed / running standalone
 */
export function InstallAppButton({
  variant = "default",
  size = "default",
  className,
  label = "Install app",
}: Props) {
  const { canInstall, promptInstall, platform, hasNativePrompt } = usePWAInstall();
  const [iosOpen, setIosOpen] = useState(false);

  if (!canInstall) return null;

  const handleClick = async () => {
    if (hasNativePrompt) {
      const outcome = await promptInstall();
      if (outcome === "accepted") toast.success("App installed!");
      else if (outcome === "dismissed") toast("Install cancelled");
      else if (outcome === "unavailable") setIosOpen(true);
      return;
    }
    // iOS or no native prompt available
    setIosOpen(true);
  };

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={handleClick}>
        <Download className="mr-2 h-4 w-4" />
        {label}
      </Button>

      <Dialog open={iosOpen} onOpenChange={setIosOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Install OneClick Studio
            </DialogTitle>
            <DialogDescription>
              {platform === "ios"
                ? "On iPhone / iPad, install via Safari's share menu:"
                : "Install this app to your home screen:"}
            </DialogDescription>
          </DialogHeader>

          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                1
              </span>
              <span className="flex items-center gap-2 pt-0.5">
                Tap the <Share className="h-4 w-4 inline" /> <strong>Share</strong> button in your browser.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                2
              </span>
              <span className="flex items-center gap-2 pt-0.5">
                Choose <Plus className="h-4 w-4 inline" /> <strong>Add to Home Screen</strong>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                3
              </span>
              <span className="pt-0.5">Tap <strong>Add</strong> — the app icon appears on your home screen.</span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
