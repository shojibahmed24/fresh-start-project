// Supabase-backed project store.
import { supabase } from "@/integrations/supabase/client";

export type ChatMode = "plan" | "agent" | "generate" | "edit" | "chat";

// Per-event entry shown inside the live build-progress card. These are
// in-memory only — never persisted to the chat_messages table — so the
// chat history stays clean once a build completes.
export type BuildEvent = {
  id: string;
  // "info" = generic status, "file" = file written successfully,
  // "warn" = recoverable issue (auto-fix, retry), "error" = failed step,
  // "fix" = patch attempt, "milestone" = chunk/plan/finished marker,
  // "debug" = internal noise (auto-fix details) — hidden by default in UI.
  kind: "info" | "file" | "warn" | "error" | "fix" | "milestone" | "debug";
  message: string;
  // Optional file path so we can group events per file.
  path?: string;
  at: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode: ChatMode;
  createdAt: number;
  // Transient, in-memory only — used to render the live BuildProgressCard
  // while a generation is streaming. Never round-trips to the database.
  buildEvents?: BuildEvent[];
  buildStatus?: "running" | "done" | "error";
  buildStartedAt?: number;
  buildEndedAt?: number;
  // Snapshot of the agent's tool-call timeline for THIS turn. Attached to the
  // final "done" assistant message so the user can scroll back and re-expand
  // any step (e.g. "Built the project to verify compilation") and see the raw
  // tool args/output. Persisted in chat_messages.metadata.timelineSteps so
  // the timeline survives reloads / navigation away from the project.
  // Type kept as `any[]` to avoid a circular store→component import.
  timelineSteps?: any[];
};

export type ProjectFile = {
  path: string;
  content: string;
  updatedAt: number;
};

export type ProjectPlan = {
  appName: string;
  description: string;
  features: string[];
  screens: { name: string; description: string }[];
  dataModels: { name: string; fields: string[] }[];
  approved: boolean;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  messages: ChatMessage[];
  files: ProjectFile[];
  plan: ProjectPlan | null;
};

export const listProjects = async (): Promise<Project[]> => {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    description: p.description || "",
    createdAt: new Date(p.created_at).getTime(),
    updatedAt: new Date(p.updated_at).getTime(),
    pinned: !!p.pinned,
    messages: [],
    files: [],
    plan: null,
  }));
};

/** Toggle the pinned/favorite flag for a project. */
export const setProjectPinned = async (id: string, pinned: boolean): Promise<void> => {
  const { error } = await supabase.from("projects").update({ pinned }).eq("id", id);
  if (error) throw error;
};

/**
 * Branch (fork) a project at a given message point. Creates a new project,
 * copies all messages up to and including `uptoMessageId`, snapshots the
 * current files, and copies the plan if any. Returns the new project id.
 */
export const branchProject = async (
  sourceId: string,
  uptoMessageId: string,
  newName?: string,
): Promise<string> => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");

  const src = await loadProject(sourceId);
  if (!src) throw new Error("Source project not found");

  const cutIdx = src.messages.findIndex((m) => m.id === uptoMessageId);
  const keep = cutIdx === -1 ? src.messages : src.messages.slice(0, cutIdx + 1);

  const baseName = (newName ?? `${src.name} (branch)`).slice(0, 80);
  const { data: created, error: e1 } = await supabase
    .from("projects")
    .insert({ name: baseName, description: src.description, user_id: auth.user.id })
    .select()
    .single();
  if (e1) throw e1;

  if (keep.length) {
    const rows = keep.map((m) => ({
      project_id: created.id,
      user_id: auth.user!.id,
      role: m.role,
      content: m.content,
      mode: m.mode,
    }));
    const { error: e2 } = await supabase.from("chat_messages").insert(rows);
    if (e2) console.warn("[branchProject] messages copy failed:", e2.message);
  }

  if (src.files.length) {
    const fileRows = src.files.map((f) => ({
      project_id: created.id,
      user_id: auth.user!.id,
      path: f.path,
      content: f.content,
    }));
    const { error: e3 } = await supabase.from("project_files").insert(fileRows);
    if (e3) console.warn("[branchProject] files copy failed:", e3.message);
  }

  if (src.plan) {
    await supabase.from("project_plans").insert({
      project_id: created.id,
      user_id: auth.user.id,
      app_name: src.plan.appName,
      description: src.plan.description,
      features: src.plan.features,
      screens: src.plan.screens,
      data_models: src.plan.dataModels,
      approved: src.plan.approved,
    });
  }

  return created.id as string;
};

/**
 * Generate a short conversation title from the first user message via the
 * Lovable AI gateway. Falls back to a truncated client-side title if the
 * edge function is unavailable. Updates the project name in DB.
 */
export const autoTitleProject = async (projectId: string, firstMessage: string): Promise<string | null> => {
  const fallback = firstMessage.trim().split(/\s+/).slice(0, 6).join(" ").slice(0, 60) || "Untitled";
  try {
    const { data, error } = await supabase.functions.invoke("generate-title", {
      body: { message: firstMessage },
    });
    const title = (data?.title as string | undefined)?.trim();
    const finalTitle = (!error && title) ? title.slice(0, 80) : fallback;
    await updateProject(projectId, { name: finalTitle });
    return finalTitle;
  } catch (e) {
    console.warn("[autoTitleProject] failed, using fallback:", e);
    try {
      await updateProject(projectId, { name: fallback });
    } catch {/* ignore */}
    return fallback;
  }
};

export const createProject = async (name: string, description: string): Promise<Project> => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("projects")
    .insert({ name, description, user_id: auth.user.id })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    description: data.description || "",
    createdAt: new Date(data.created_at).getTime(),
    updatedAt: new Date(data.updated_at).getTime(),
    messages: [],
    files: [],
    plan: null,
  };
};

export const deleteProject = async (id: string): Promise<void> => {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
};

export const updateProject = async (
  id: string,
  patch: { name?: string; description?: string }
): Promise<void> => {
  const update: { name?: string; description?: string; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.description !== undefined) update.description = patch.description;
  const { error } = await supabase.from("projects").update(update).eq("id", id);
  if (error) throw error;
};

export const loadProject = async (id: string): Promise<Project | null> => {
  // Resilient load: each query is isolated so one slow/failing table never
  // hangs the whole workspace. Project row is required; the rest fall back
  // to empty arrays so the UI can render fast and recover gracefully.
  const safe = <T,>(p: PromiseLike<{ data: T | null; error: any }>, label: string) =>
    Promise.resolve(p).then(
      (r) => {
        if (r.error) console.warn(`[loadProject] ${label} failed:`, r.error.message);
        return r.data;
      },
      (e) => {
        console.warn(`[loadProject] ${label} threw:`, e?.message ?? e);
        return null;
      },
    );

  const [p, msgs, files, plan] = await Promise.all([
    safe(supabase.from("projects").select("*").eq("id", id).maybeSingle(), "projects"),
    safe(
      supabase
        .from("chat_messages")
        .select("id,role,content,mode,created_at,metadata")
        .eq("project_id", id)
        .order("created_at"),
      "chat_messages",
    ),
    safe(
      supabase
        .from("project_files")
        .select("path,content,updated_at")
        .eq("project_id", id)
        .order("path"),
      "project_files",
    ),
    safe(supabase.from("project_plans").select("*").eq("project_id", id).maybeSingle(), "project_plans"),
  ]);

  if (!p) return null;
  // Lazy-import to avoid a circular dep with hooks/useBuilderResume.
  const { isBuildLogMessage } = await import("@/hooks/useBuilderResume");
  return {
    id: (p as any).id,
    name: (p as any).name,
    description: (p as any).description || "",
    createdAt: new Date((p as any).created_at).getTime(),
    updatedAt: new Date((p as any).updated_at).getTime(),
    pinned: !!(p as any).pinned,
    messages: ((msgs as any[]) || [])
      // Filter legacy build-log rows ("Will create…", "Writing…", "Chunk 2/4 done", etc.)
      // saved by older versions of the builder. Keeps chat history clean and prevents
      // context bloat on auto-resume — see useBuilderResume.isBuildLogMessage.
      .filter((m: any) => !isBuildLogMessage({ role: m.role, content: m.content }))
      .map((m: any) => {
        const meta = (m.metadata && typeof m.metadata === "object") ? m.metadata : {};
        const out: ChatMessage = {
          id: m.id,
          role: m.role,
          content: m.content,
          mode: m.mode,
          createdAt: new Date(m.created_at).getTime(),
        };
        // Hydrate persisted timeline so re-expanding a previous run's tool
        // rows works after reload / navigating back into the project.
        if (Array.isArray(meta.timelineSteps) && meta.timelineSteps.length > 0) {
          out.timelineSteps = meta.timelineSteps;
        }
        return out;
      }),
    files: ((files as any[]) || []).map((f: any) => ({
      path: f.path,
      content: f.content,
      updatedAt: new Date(f.updated_at).getTime(),
    })),
    plan: plan
      ? {
          appName: (plan as any).app_name,
          description: (plan as any).description,
          features: ((plan as any).features as string[]) || [],
          screens: ((plan as any).screens as any[]) || [],
          dataModels: ((plan as any).data_models as any[]) || [],
          approved: (plan as any).approved,
        }
      : null,
  };
};


export const addMessage = async (
  projectId: string,
  msg: Omit<ChatMessage, "id" | "createdAt"> & { metadata?: Record<string, any> },
) => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");
  const { metadata, ...rest } = msg as any;
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      project_id: projectId,
      user_id: auth.user.id,
      role: rest.role,
      content: rest.content,
      mode: rest.mode,
      metadata: metadata && typeof metadata === "object" ? metadata : {},
    })
    .select()
    .single();
  if (error) throw error;
  await supabase.from("projects").update({ updated_at: new Date().toISOString() }).eq("id", projectId);
  const out: ChatMessage = {
    id: data.id,
    role: data.role as ChatMessage["role"],
    content: data.content,
    mode: data.mode as ChatMessage["mode"],
    createdAt: new Date(data.created_at).getTime(),
  };
  const meta = (data as any).metadata;
  if (meta && typeof meta === "object" && Array.isArray(meta.timelineSteps) && meta.timelineSteps.length > 0) {
    out.timelineSteps = meta.timelineSteps;
  }
  return out;
};

/**
 * Patch metadata on an existing chat message — used to attach the agent
 * timeline to an assistant message AFTER the run finishes (so reloading
 * the project shows the same tool-call rows).
 */
export const updateMessageMetadata = async (
  messageId: string,
  metadata: Record<string, any>,
) => {
  const { error } = await supabase
    .from("chat_messages")
    .update({ metadata })
    .eq("id", messageId);
  if (error) throw error;
};

/** Delete a single chat message by id. RLS scopes it to the current user. */
export const deleteMessage = async (messageId: string) => {
  const { error } = await supabase.from("chat_messages").delete().eq("id", messageId);
  if (error) throw error;
};

export const upsertFiles = async (projectId: string, files: ProjectFile[]) => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");
  const rows = files.map((f) => ({
    project_id: projectId,
    user_id: auth.user!.id,
    path: f.path,
    content: f.content,
  }));
  const { error } = await supabase.from("project_files").upsert(rows, { onConflict: "project_id,path" });
  if (error) throw error;
};

export const updateFileContent = async (projectId: string, path: string, content: string) => {
  const { error } = await supabase
    .from("project_files")
    .update({ content })
    .eq("project_id", projectId)
    .eq("path", path);
  if (error) throw error;
};

export const renameFile = async (projectId: string, oldPath: string, newPath: string) => {
  const { error } = await supabase
    .from("project_files")
    .update({ path: newPath })
    .eq("project_id", projectId)
    .eq("path", oldPath);
  if (error) throw error;
};

export const deleteFile = async (projectId: string, path: string) => {
  const { error } = await supabase
    .from("project_files")
    .delete()
    .eq("project_id", projectId)
    .eq("path", path);
  if (error) throw error;
};

export const createFile = async (projectId: string, path: string, content = "") => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");
  const { error } = await supabase.from("project_files").insert({
    project_id: projectId,
    user_id: auth.user.id,
    path,
    content,
  });
  if (error) throw error;
};

export const upsertPlan = async (projectId: string, plan: ProjectPlan) => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");
  const { error } = await supabase.from("project_plans").upsert(
    {
      project_id: projectId,
      user_id: auth.user.id,
      app_name: plan.appName,
      description: plan.description,
      features: plan.features,
      screens: plan.screens,
      data_models: plan.dataModels,
      approved: plan.approved,
    },
    { onConflict: "project_id" }
  );
  if (error) throw error;
};
