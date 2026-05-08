// Lightweight feature flag hook — checks `feature_flags` table for the
// current user. Cached per session in memory to avoid repeated queries.
//
// Usage:
//   const { enabled, loading } = useFeatureFlag("orchestrator_v2");

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, boolean>();
const inflight = new Map<string, Promise<boolean>>();

async function fetchFlag(key: string): Promise<boolean> {
  if (cache.has(key)) return cache.get(key)!;
  if (inflight.has(key)) return inflight.get(key)!;

  const p = (async () => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user?.id;
      if (!userId) return false;

      // Admins implicitly have every flag enabled (so they can test v2, etc.)
      try {
        const { data: adminRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();
        if (adminRow) {
          cache.set(key, true);
          return true;
        }
      } catch (e) {
        console.warn(`[feature-flag] admin check failed`, e);
      }

      const { data, error } = await supabase
        .from("feature_flags")
        .select("enabled")
        .eq("user_id", userId)
        .eq("flag_key", key)
        .maybeSingle();

      if (error) {
        console.warn(`[feature-flag] ${key} query error`, error);
        return false;
      }
      const val = !!data?.enabled;
      cache.set(key, val);
      return val;
    } catch (e) {
      console.warn(`[feature-flag] ${key} fetch failed`, e);
      return false;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}

export function useFeatureFlag(key: string) {
  const [enabled, setEnabled] = useState<boolean>(() => cache.get(key) ?? false);
  const [loading, setLoading] = useState<boolean>(() => !cache.has(key));

  useEffect(() => {
    let alive = true;
    fetchFlag(key).then((v) => {
      if (!alive) return;
      setEnabled(v);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [key]);

  return { enabled, loading };
}

// Synchronous accessor for code paths that already know the flag was checked
// upstream (e.g. just inside an event handler). Returns cached value or false.
export function getFeatureFlagCached(key: string): boolean {
  return cache.get(key) ?? false;
}

// Imperative refresh (after admin toggles a flag in the UI).
export async function refreshFeatureFlag(key: string): Promise<boolean> {
  cache.delete(key);
  inflight.delete(key);
  return fetchFlag(key);
}
