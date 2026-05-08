import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Loader2, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface Props {
  open: boolean;
  src: string | null;
  onClose: () => void;
  /** Receives a cropped Blob (1:1, square). Should resolve when upload completes. */
  onConfirm: (blob: Blob) => Promise<void> | void;
}

/**
 * Crops the given image to a square avatar via react-easy-crop.
 * Returns a Blob (JPEG, max 512×512) so storage stays small.
 */
export const AvatarCropDialog = ({ open, src, onClose, onConfirm }: Props) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [areaPx, setAreaPx] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset transform whenever a new source loads.
  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setAreaPx(null);
    }
  }, [open, src]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => setAreaPx(pixels), []);

  const handleConfirm = async () => {
    if (!src || !areaPx || saving) return;
    setSaving(true);
    try {
      const blob = await getCroppedBlob(src, areaPx, rotation);
      await onConfirm(blob);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden gap-0">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base">Crop your avatar</DialogTitle>
          <DialogDescription className="text-[12px]">
            Drag to reposition · pinch / slider to zoom.
          </DialogDescription>
        </DialogHeader>

        <div className="relative w-full aspect-square bg-black">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              objectFit="contain"
            />
          )}
        </div>

        <div className="px-5 py-4 space-y-3 bg-[hsl(var(--bg-muted))]">
          <div className="flex items-center gap-3">
            <ZoomOut size={14} className="text-[hsl(var(--foreground-subtle))] shrink-0" />
            <Slider
              min={1}
              max={3}
              step={0.01}
              value={[zoom]}
              onValueChange={([v]) => setZoom(v)}
              className="flex-1"
            />
            <ZoomIn size={14} className="text-[hsl(var(--foreground-subtle))] shrink-0" />
          </div>
          <div className="flex items-center justify-between">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="text-[12px]"
            >
              <RotateCw size={13} className="mr-1.5" />
              Rotate
            </Button>
            <span className="text-[11px] text-[hsl(var(--foreground-subtle))] tabular-nums">
              {Math.round(zoom * 100)}% · {rotation}°
            </span>
          </div>
        </div>

        <DialogFooter className="px-5 py-4 bg-[hsl(var(--bg-muted))] border-t border-border gap-2 sm:gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={saving || !areaPx}>
            {saving ? <><Loader2 className="size-3.5 mr-1.5 animate-spin" /> Uploading…</> : "Save avatar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ─── Crop helpers ─────────────────────────────────────────────── */

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

async function getCroppedBlob(src: string, area: Area, rotation: number): Promise<Blob> {
  const img = await loadImage(src);
  const rad = (rotation * Math.PI) / 180;

  // Render rotated image onto a tmp canvas first.
  const safe = Math.max(img.width, img.height) * 2;
  const tmp = document.createElement("canvas");
  tmp.width = safe;
  tmp.height = safe;
  const tctx = tmp.getContext("2d")!;
  tctx.translate(safe / 2, safe / 2);
  tctx.rotate(rad);
  tctx.drawImage(img, -img.width / 2, -img.height / 2);

  // Coordinates of the original image's top-left within the rotated canvas.
  const dataX = Math.round((safe - img.width) / 2);
  const dataY = Math.round((safe - img.height) / 2);

  // Crop area is in original-image coordinates → translate to tmp canvas.
  const out = document.createElement("canvas");
  const target = Math.min(512, Math.round(area.width));
  out.width = target;
  out.height = target;
  const octx = out.getContext("2d")!;
  octx.drawImage(
    tmp,
    dataX + area.x,
    dataY + area.y,
    area.width,
    area.height,
    0,
    0,
    target,
    target,
  );

  return await new Promise<Blob>((resolve, reject) => {
    out.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode image"))),
      "image/jpeg",
      0.92,
    );
  });
}
