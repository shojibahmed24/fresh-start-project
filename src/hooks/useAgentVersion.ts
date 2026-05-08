// Admin-only preference: which AI agent version (v1 or v2) to use.
// Stored in Supabase (`feature_flags` table, key = `prefer_agent_v2`).
// Non-admins always get v1 — server enforces this regardless of UI state.

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

let cachedPref: boolean | null = null;
let cachedIsAdmin: boolean | null = null;
let inflight: Promise<{ isAdmin: boolean; preferV2: boolean }> | null = null;

async function loadState(): Promise<{ isAdmin: boolean; preferV2: boolean }> {
  if (cachedIsAdmin !== null && cachedPref !== null) {
    return { isAdmin: cachedIsAdmin, preferV2: cachedPref };
  }
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user?.id;
      if (!userId) {
        cachedIsAdmin = false;
        cachedPref = false;
        return { isAdmin: false, preferV2: false };
      }

      // Admin check via user_roles (RLS lets users read their own roles)
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      const isAdmin = !!roleRow;
      cachedIsAdmin = isAdmin;

      if (!isAdmin) {
        cachedPref = false;
        return { isAdmin: false, preferV2: false };
      }

      // Read preference via RPC (always returns false for non-admins anyway)
      const { data: pref } = await supabase.rpc("get_agent_version_preference");
      cachedPref = !!pref;
      return { isAdmin: true, preferV2: !!pref };
    } catch (e) {
      console.warn("[useAgentVersion] load failed", e);
      cachedIsAdmin = cachedIsAdmin ?? false;
      cachedPref = cachedPref ?? false;
      return { isAdmin: !!cachedIsAdmin, preferV2: !!cachedPref };
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function useAgentVersion() {
  const [isAdmin, setIsAdmin] = useState<boolean>(cachedIsAdmin ?? false);
  const [preferV2, setPreferV2] = useState<boolean>(cachedPref ?? false);
  const [loading, setLoading] = useState<boolean>(cachedPref === null);

  useEffect(() => {
    let alive = true;
    loadState().then((s) => {
      if (!alive) return;
      setIsAdmin(s.isAdmin);
      setPreferV2(s.preferV2);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const setPreference = useCallback(async (useV2: boolean) => {
    const { error } = await supabase.rpc("set_agent_version_preference", {
      _use_v2: useV2,
    });
    if (error) throw error;
    cachedPref = useV2;
    setPreferV2(useV2);
  }, []);

  return { isAdmin, preferV2, loading, setPreference };
}

// Sync accessor for code paths that already warmed the cache.
export function getAgentVersionCached(): { isAdmin: boolean; preferV2: boolean } {
  return { isAdmin: !!cachedIsAdmin, preferV2: !!cachedPref };
}

export async function warmAgentVersionCache(): Promise<void> {
  await loadState();
}
