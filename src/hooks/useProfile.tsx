import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

// Shape of the public.profiles row we expose to the UI.
export type Profile = {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  /** "agent" (build code) or "plan" (discuss only) — drives chat input toggle. */
  chat_mode: "agent" | "plan";
  created_at: string;
  updated_at: string;
};

// Loads the current user's profile + exposes update/upload helpers.
// A profile row is created automatically by the `handle_new_user` trigger
// the first time a user signs up, so by the time this hook runs the row
// always exists.
export const useProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      console.error("profile fetch", error);
    }
    setProfile((data as Profile) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Patch a subset of profile fields. Returns the updated row.
  const update = useCallback(
    async (patch: Partial<Pick<Profile, "display_name" | "bio" | "avatar_url" | "chat_mode">>) => {
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("user_id", user.id)
        .select()
        .single();
      if (error) throw error;
      setProfile(data as Profile);
      return data as Profile;
    },
    [user],
  );

  // Upload a new avatar to the `avatars` bucket under <user_id>/<timestamp>.<ext>
  // and persist the public URL on the profile row.
  const uploadAvatar = useCallback(
    async (file: File) => {
      if (!user) throw new Error("Not signed in");
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      await update({ avatar_url: publicUrl });
      return publicUrl;
    },
    [user, update],
  );

  // Remove avatar reference from the profile (file stays in storage; cheap to leave).
  const removeAvatar = useCallback(async () => {
    await update({ avatar_url: null });
  }, [update]);

  return { profile, loading, refresh, update, uploadAvatar, removeAvatar };
};
