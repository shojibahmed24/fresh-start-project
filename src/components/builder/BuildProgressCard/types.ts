import type { BuildEvent } from "@/lib/store";

export type FileGroup = {
  path: string;
  events: BuildEvent[];
  status: "running" | "ok" | "warn" | "error";
  lastAt: number;
};

export type Stats = {
  files: number;
  fixes: number;
  warnings: number;
  errors: number;
};

export type BuildStatus = "running" | "done" | "error";

export type BuildProgressCardProps = {
  events: BuildEvent[];
  status: BuildStatus;
  startedAt?: number;
  endedAt?: number;
};
