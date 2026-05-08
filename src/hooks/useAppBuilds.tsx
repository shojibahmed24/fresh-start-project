import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppBuild = {
  id: string;
  project_id: string;
  user_id: string;
  platform: "android" | "ios";
  status: "queued" | "preparing" | "building" | "uploading" | "ready" | "failed" | "cancelled";
  app_name: string;
  package_id: string;
  version_name: string;
  version_code: number;
  github_run_id: string | null;
  github_run_url: string | null;
  download_url: string | null;
  file_size_bytes: number | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AppBuildStep = {
  id: string;
  build_id: string;
  step_key: string;
  label: string;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  detail: string | null;
  step_order: number;
  started_at: string | null;
  finished_at: string | null;
};

// Subscribe to a single build (status + steps) in realtime.
export function useBuildLive(buildId: string | null) {
  const [build, setBuild] = useState<AppBuild | null>(null);
  const [steps, setSteps] = useState<AppBuildStep[]>([]);

  useEffect(() => {
    if (!buildId) {
      setBuild(null);
      setSteps([]);
      return;
    }
    let cancelled = false;

    const load = async () => {
      const [{ data: b }, { data: s }] = await Promise.all([
        supabase.from("app_builds").select("*").eq("id", buildId).maybeSingle(),
        supabase.from("app_build_steps").select("*").eq("build_id", buildId).order("step_order", { ascending: true }),
      ]);
      if (cancelled) return;
      if (b) setBuild(b as AppBuild);
      if (s) setSteps(s as AppBuildStep[]);
    };
    load();

    const chName = `build:${buildId}:${Math.random().toString(36).slice(2, 8)}`;
    const ch = supabase
      .channel(chName)
      .on("postgres_changes", { event: "*", schema: "public", table: "app_builds", filter: `id=eq.${buildId}` },
        (payload) => { if (payload.new) setBuild(payload.new as AppBuild); })
      .on("postgres_changes", { event: "*", schema: "public", table: "app_build_steps", filter: `build_id=eq.${buildId}` },
        () => { load(); })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [buildId]);

  return { build, steps };
}

// Active (in-flight) build for a project — picks the latest non-terminal one.
// Used by the floating live-build badge so users see progress even after
// closing the build dialog.
const ACTIVE_STATUSES: AppBuild["status"][] = ["queued", "preparing", "building", "uploading"];

export function useActiveBuild(projectId: string | null) {
  const [activeBuild, setActiveBuild] = useState<AppBuild | null>(null);

  const refresh = async () => {
    if (!projectId) { setActiveBuild(null); return; }
    const { data } = await supabase
      .from("app_builds")
      .select("*")
      .eq("project_id", projectId)
      .in("status", ACTIVE_STATUSES)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveBuild((data as AppBuild) ?? null);
  };

  useEffect(() => {
    refresh();
    if (!projectId) return;
    const ch = supabase
      .channel(`active-build:${projectId}:${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_builds", filter: `project_id=eq.${projectId}` },
        () => refresh(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return { activeBuild, refresh };
}

// List recent builds for a project
export function useProjectBuilds(projectId: string | null) {
  const [builds, setBuilds] = useState<AppBuild[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!projectId) return;
    setLoading(true);
    const { data } = await supabase.from("app_builds").select("*")
      .eq("project_id", projectId).order("created_at", { ascending: false }).limit(10);
    setBuilds((data as AppBuild[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    if (!projectId) return;
    const ch = supabase
      .channel(`project-builds:${projectId}:${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "app_builds", filter: `project_id=eq.${projectId}` },
        () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return { builds, loading, refresh };
}
