import { type ReactNode } from "react";
import { m } from "framer-motion";
import { cn } from "@/lib/utils";

export type DeviceId = "iphone15" | "pixel" | "ipad" | "desktop";
export type Orientation = "portrait" | "landscape";
export type ColorScheme = "dark" | "light";

type DeviceSpec = {
  id: DeviceId;
  label: string;
  short: string;
  /** Portrait dimensions in CSS px. Landscape swaps width/height. */
  width: number;
  height: number;
  /** Outer corner radius of the device. */
  radius: number;
  /** Bezel padding. */
  bezel: number;
  /** "Notch" / "dynamic island" / "punch hole" style. */
  notch: "dynamic-island" | "punch-hole" | "none";
  /** Render a home indicator at the bottom. */
  homeBar: boolean;
};

export const DEVICE_SPECS: Record<DeviceId, DeviceSpec> = {
  iphone15: {
    id: "iphone15",
    label: "iPhone 15 Pro",
    short: "iPhone",
    width: 320,
    height: 680,
    radius: 40,
    bezel: 10,
    notch: "dynamic-island",
    homeBar: true,
  },
  pixel: {
    id: "pixel",
    label: "Pixel 8",
    short: "Pixel",
    width: 320,
    height: 700,
    radius: 32,
    bezel: 8,
    notch: "punch-hole",
    homeBar: false,
  },
  ipad: {
    id: "ipad",
    label: "iPad Mini",
    short: "iPad",
    width: 540,
    height: 720,
    radius: 28,
    bezel: 14,
    notch: "none",
    homeBar: true,
  },
  desktop: {
    id: "desktop",
    label: "Desktop",
    short: "Desktop",
    width: 1024,
    height: 640,
    radius: 12,
    bezel: 0,
    notch: "none",
    homeBar: false,
  },
};

type Props = {
  device: DeviceId;
  orientation: Orientation;
  scheme: ColorScheme;
  children: ReactNode;
  /** Fired when the user requests this frame's screenshot to be saved (optional). */
  innerRef?: React.RefObject<HTMLDivElement>;
  /**
   * Optional CSS scale (1 = 100%). Used by the parent to auto-fit the frame
   * inside small containers (e.g. the mobile Builder preview tab) so the full
   * device — including bezels and home bar — is visible without scrolling.
   */
  scale?: number;
};

/**
 * Visually realistic device frame with morphing dimensions when the user
 * switches device or rotates. The frame acts as a styled container — the
 * Sandpack iframe is passed in as `children` and stretches to fill the inner
 * screen area.
 */
export const DeviceFrame = ({ device, orientation, scheme, children, innerRef, scale = 1 }: Props) => {
  const spec = DEVICE_SPECS[device];
  const isLandscape = orientation === "landscape" && device !== "desktop";
  const w = isLandscape ? spec.height : spec.width;
  const h = isLandscape ? spec.width : spec.height;
  // When auto-fit shrinks the frame we wrap it in a sized box so the parent
  // flex container reserves the *visual* (post-scale) footprint, otherwise the
  // un-scaled element keeps its original bounds and clips against the panel.
  const scaled = scale > 0 && scale < 0.999;

  if (device === "desktop") {
    return (
      <m.div
        layout
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
        className="relative h-full w-full max-w-5xl overflow-hidden rounded-lg border border-[hsl(0_0%_100%/0.08)] shadow-2xl"
        style={{
          background: scheme === "dark" ? "hsl(0 0% 4%)" : "hsl(0 0% 96%)",
        }}
      >
        {/* Browser chrome */}
        <div
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 border-b text-[10px] font-mono",
            scheme === "dark"
              ? "bg-[hsl(0_0%_8%)] border-[hsl(0_0%_100%/0.06)] text-[hsl(var(--foreground-subtle))]"
              : "bg-[hsl(0_0%_92%)] border-[hsl(0_0%_0%/0.08)] text-[hsl(0_0%_30%)]",
          )}
        >
          <span className="size-2.5 rounded-full bg-[hsl(0_70%_60%)]" />
          <span className="size-2.5 rounded-full bg-[hsl(40_85%_55%)]" />
          <span className="size-2.5 rounded-full bg-[hsl(140_55%_50%)]" />
          <span className="ml-3 truncate opacity-70">localhost:5173</span>
        </div>
        <div ref={innerRef} className="relative h-[calc(100%-26px)] w-full">{children}</div>
      </m.div>
    );
  }

  const frame = (
    <m.div
      layout
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
      style={{
        width: w,
        height: h,
        borderRadius: spec.radius,
        padding: spec.bezel,
        background: "linear-gradient(135deg,#1a1a1a,#0a0a0a)",
        boxShadow:
          "0 25px 60px -15px hsl(var(--primary) / 0.35), 0 0 0 1.5px hsl(0 0% 100% / 0.06), inset 0 0 0 1px rgba(255,255,255,0.04)",
        // IMPORTANT: do NOT use `transform: scale(...)` here. CSS transforms on
        // iframe ancestors cause Chromium to re-attach the iframe's document
        // context, which kills Sandpack's compile worker mid-message and
        // surfaces as: TypeError: "message" is read-only (sandbox compile.ts).
        // `zoom` performs the same visual fit-to-container without triggering
        // an iframe context reset.
        zoom: scaled ? scale : undefined,
      } as React.CSSProperties}
      className="relative shrink-0"
    >
      {/* Side buttons (subtle) — power on right, volume on left */}
      <span
        aria-hidden
        className="absolute top-[80px] -right-[2px] w-[3px] h-[60px] rounded-l-sm bg-gradient-to-b from-[#222] to-[#111]"
      />
      <span
        aria-hidden
        className="absolute top-[60px] -left-[2px] w-[3px] h-[28px] rounded-r-sm bg-gradient-to-b from-[#222] to-[#111]"
      />
      <span
        aria-hidden
        className="absolute top-[100px] -left-[2px] w-[3px] h-[50px] rounded-r-sm bg-gradient-to-b from-[#222] to-[#111]"
      />

      <div
        ref={innerRef}
        className="relative h-full w-full overflow-hidden"
        style={{
          borderRadius: Math.max(spec.radius - spec.bezel, 8),
          background: scheme === "dark" ? "#000" : "#fafafa",
          boxShadow: "inset 0 0 0 1.5px #000",
        }}
      >
        {/* Notches */}
        {spec.notch === "dynamic-island" && !isLandscape && (
          <div
            className="absolute left-1/2 top-1.5 z-50 -translate-x-1/2 rounded-full bg-black flex items-center justify-end pr-2"
            style={{ width: 96, height: 26, pointerEvents: "none" }}
            aria-hidden
          >
            {/* Camera dot */}
            <span className="size-1.5 rounded-full bg-[hsl(220_30%_18%)] ring-1 ring-white/5" />
          </div>
        )}
        {spec.notch === "punch-hole" && !isLandscape && (
          <div
            className="absolute left-1/2 top-2 z-50 -translate-x-1/2 size-3 rounded-full bg-black ring-1 ring-white/5"
            aria-hidden
            style={{ pointerEvents: "none" }}
          />
        )}

        {children}

        {/* Home indicator bar */}
        {spec.homeBar && (
          <div
            className={cn(
              "absolute bottom-1 left-1/2 z-50 -translate-x-1/2 rounded-full",
              scheme === "dark" ? "bg-white/70" : "bg-black/40",
            )}
            style={{ width: isLandscape ? 60 : 90, height: 3, pointerEvents: "none" }}
            aria-hidden
          />
        )}
      </div>
    </m.div>
  );

  // `zoom` already changes the rendered layout box, so the parent flex
  // container will reserve the correct (post-zoom) footprint automatically —
  // no extra wrapper needed.
  return frame;
};
