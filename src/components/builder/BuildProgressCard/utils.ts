import type { BuildEvent } from "@/lib/store";
import type { FileGroup } from "./types";

// Per-file aggregation. Each file gets its own collapsible card.
export function groupByFile(events: BuildEvent[]): { groups: FileGroup[]; orphans: BuildEvent[] } {
  const map = new Map<string, FileGroup>();
  const orphans: BuildEvent[] = [];
  for (const e of events) {
    if (!e.path) {
      orphans.push(e);
      continue;
    }
    const g = map.get(e.path) ?? { path: e.path, events: [], status: "running" as const, lastAt: e.at };
    g.events.push(e);
    g.lastAt = Math.max(g.lastAt, e.at);
    // Severity precedence: error > warn > running(fix) > ok(file)
    if (e.kind === "error") g.status = "error";
    else if (e.kind === "warn" && g.status !== "error") g.status = "warn";
    else if (e.kind === "fix" && g.status === "ok") g.status = "running";
    else if (e.kind === "file" && g.status === "running") g.status = "ok";
    else if (e.kind === "file" && g.status !== "error" && g.status !== "warn") g.status = "ok";
    map.set(e.path, g);
  }
  return { groups: Array.from(map.values()).sort((a, b) => a.lastAt - b.lastAt), orphans };
}

export const formatElapsed = (ms: number): string => {
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
};
