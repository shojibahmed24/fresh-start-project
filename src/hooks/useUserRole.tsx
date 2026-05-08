import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

// Returns the current user's role flags. Roles are stored in the
// dedicated `user_roles` table — never trust a client-side claim alone,
// but for routing/UX gating this hook is sufficient (RLS protects writes).
export const useUserRole = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (cancel) return;
        setIsAdmin((data ?? []).some((r) => r.role === "admin"));
        setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [user]);

  return { isAdmin, loading };
};
