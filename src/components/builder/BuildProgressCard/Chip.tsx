import { cn } from "@/lib/utils";

export function Chip({
  tone,
  icon,
  label,
}: {
  tone: "success" | "info" | "warn" | "error";
  icon: React.ReactNode;
  label: string;
}) {
  const map = {
    success: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    info: "bg-sky-500/15 text-sky-300 border-sky-500/25",
    warn: "bg-amber-500/15 text-amber-200 border-amber-500/25",
    error: "bg-rose-500/15 text-rose-300 border-rose-500/25",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border font-medium",
        map[tone],
      )}
    >
      {icon}
      {label}
    </span>
  );
}
