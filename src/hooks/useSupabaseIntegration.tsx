import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SupabaseConnection = {
  id: string;
  user_id: string;
  supabase_email: string | null;
  supabase_user_id: string | null;
  scopes: string[];
  connected_at: string;
  last_refreshed_at: string;
  revoked: boolean;
};

export type SupabaseProjectInfo = {
  id: string;
  name: string;
  organization_id: string;
  region: string;
  status?: string;
  created_at?: string;
};

export type SupabaseOrgInfo = {
  id: string;
  name: string;
};

export type ProjectSupabaseLink = {
  id: string;
  project_id: string;
  supabase_project_ref: string;
  supabase_project_name: string;
  supabase_org_id: string | null;
  supabase_region: string | null;
  api_url: string | null;
  schema_cache: { tables?: Array<{ name: string; schema: string; rows?: number; columns: Array<{ name: string; type: string; nullable: string | boolean; default: string | null }> }> };
  schema_cached_at: string | null;
};

export const useSupabaseIntegration = (projectId?: string) => {
  const [connection, setConnection] = useState<SupabaseConnection | null>(null);
  const [link, setLink] = useState<ProjectSupabaseLink | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data: conn } = await supabase
        .from("user_supabase_connections")
        .select("*")
        .maybeSingle();
      setConnection(conn as SupabaseConnection | null);

      if (projectId) {
        const { data: lk } = await supabase
          .from("project_supabase_links")
          .select("*")
          .eq("project_id", projectId)
          .maybeSingle();
        setLink(lk as ProjectSupabaseLink | null);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startConnect = async (returnTo: string) => {
    const normalizedReturnTo = /^https?:\/\//i.test(returnTo)
      ? returnTo
      : `${window.location.origin}${returnTo.startsWith("/") ? returnTo : `/${returnTo}`}`;

    const { data, error } = await supabase.functions.invoke("supabase-oauth-start", {
      body: { return_to: normalizedReturnTo },
    });
    if (error) throw error;
    if (!data?.url) throw new Error("Failed to start OAuth");

    const popup = window.open(data.url, "sboauth", "width=620,height=720");
    if (!popup) throw new Error("Popup blocked — allow popups and retry");
    popup.focus?.();

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let checking = false;
      let popupClosedAt: number | null = null;

      const resolveConnected = async () => {
        if (settled) return;
        settled = true;
        cleanup();
        await refresh();
        window.focus();
        resolve();
      };

      const rejectWith = (message: string) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(message));
      };

      const checkConnection = async () => {
        const { data: conn, error: connError } = await supabase
          .from("user_supabase_connections")
          .select("id, revoked")
          .maybeSingle();

        if (connError) return;
        if (conn && !conn.revoked) {
          await resolveConnected();
          return;
        }

        if (popup.closed) {
          popupClosedAt ??= Date.now();
          if (Date.now() - popupClosedAt > 6000) {
            rejectWith("Connection window closed before the app could confirm success");
          }
        }
      };

      const cleanup = () => {
        window.removeEventListener("message", handler);
        window.clearTimeout(timeoutId);
        window.clearInterval(pollId);
        if (!popup.closed) popup.close();
      };

      const handler = (ev: MessageEvent) => {
        if (settled) return;
        if (ev.data?.type === "sboauth_success") {
          void resolveConnected().catch((err) => {
            rejectWith(err instanceof Error ? err.message : "OAuth refresh failed");
          });
        } else if (ev.data?.type === "sboauth_error") {
          rejectWith(ev.data.message || "OAuth failed");
        }
      };
      window.addEventListener("message", handler);

      const pollId = window.setInterval(() => {
        if (settled || checking) return;
        checking = true;
        void checkConnection().finally(() => {
          checking = false;
        });
      }, 1200);

      void checkConnection();

      // Timeout after 5 min
      const timeoutId = window.setTimeout(() => {
        if (settled) return;
        rejectWith("Connection timed out");
      }, 5 * 60 * 1000);
    });
  };

  const disconnect = async () => {
    await supabase.from("user_supabase_connections").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await refresh();
  };

  const listSupabaseProjects = async (): Promise<{
    organizations: SupabaseOrgInfo[];
    projects: SupabaseProjectInfo[];
  }> => {
    const { data, error } = await supabase.functions.invoke("supabase-list-projects");
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const linkProject = async (input: {
    supabase_project_ref: string;
    supabase_project_name: string;
    supabase_org_id?: string;
    supabase_region?: string;
  }) => {
    if (!projectId) throw new Error("No project selected");
    const { data, error } = await supabase.functions.invoke("supabase-link-project", {
      body: { project_id: projectId, ...input },
    });
    if (error) throw error;
    if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Link failed");
    await refresh();
    return data;
  };

  const unlinkProject = async () => {
    if (!projectId) return;
    await supabase.from("project_supabase_links").delete().eq("project_id", projectId);
    await refresh();
  };

  return {
    connection,
    link,
    loading,
    refresh,
    startConnect,
    disconnect,
    listSupabaseProjects,
    linkProject,
    unlinkProject,
  };
};
