// ═══════════════════════════════════════════════════════════════════════════
// BACKEND SNIPPETS — auth, profiles, roles, Supabase client
// ───────────────────────────────────────────────────────────────────────────
// These are the canonical, production-grade patterns the agent MUST use
// whenever an app needs persistence, auth, or admin roles. They assume the
// user has connected their own Supabase project (project_supabase_links).
//
// IMPORTANT placeholder convention:
//   __SUPABASE_URL__   → replaced server-side with link.api_url
//   __SUPABASE_ANON__  → replaced server-side with the decrypted anon key
// The agent should write these placeholders verbatim — the inject_files
// pipeline (or supabase-link-project response) substitutes the real values
// before saving the file. NEVER paste the platform's shared anon key into
// generated code.
// ═══════════════════════════════════════════════════════════════════════════

import type { Snippet } from "./types.ts";

export const SUPABASE_CLIENT: Snippet = {
  name: "SupabaseClient",
  why:
    "The ONE correct way to instantiate a Supabase client in a generated app. " +
    "Uses the placeholders __SUPABASE_URL__ / __SUPABASE_ANON__ which the build " +
    "pipeline replaces with the user's linked Supabase project credentials. " +
    "NEVER hardcode the platform's shared keys here — that would route the " +
    "user's data into the wrong database.",
  uses: ["@supabase/supabase-js"],
  code: `// src/integrations/supabase/client.ts
import { createClient } from "@supabase/supabase-js";

// Placeholders are substituted at save-time with the user's linked Supabase
// project credentials. Do NOT replace these by hand.
const SUPABASE_URL = "__SUPABASE_URL__";
const SUPABASE_ANON_KEY = "__SUPABASE_ANON__";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
`,
};

export const USE_AUTH_HOOK: Snippet = {
  name: "useAuthHook",
  why:
    "Production-grade auth context: subscribes to onAuthStateChange BEFORE " +
    "calling getSession (Supabase docs requirement to avoid race conditions), " +
    "exposes user/session/loading/signOut, and is the single source of truth " +
    "for auth state across the app.",
  uses: ["@supabase/supabase-js", "react"],
  code: `// src/hooks/useAuth.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1) Subscribe FIRST so we never miss an event.
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    // 2) Then hydrate the initial session.
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider value={{ user, session, loading, signOut }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);
`,
};

export const AUTH_PAGE: Snippet = {
  name: "AuthPage",
  why:
    "Complete email+password sign-in / sign-up screen with the correct " +
    "emailRedirectTo (window.location.origin) so confirmation links land " +
    "back in the app, plus error/loading toasts and form validation.",
  uses: ["sonner", "@/integrations/supabase/client"],
  code: `// src/pages/Auth.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function Auth() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: \`\${window.location.origin}/\` },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav("/");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Auth failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] grid place-items-center bg-background p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xl">
        <h1 className="text-2xl font-bold text-foreground">
          {mode === "signin" ? "Welcome back" : "Create account"}
        </h1>
        <input
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground"
          type="email" placeholder="you@example.com" value={email}
          onChange={(e) => setEmail(e.target.value)} required
        />
        <input
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground"
          type="password" placeholder="Password" minLength={6} value={password}
          onChange={(e) => setPassword(e.target.value)} required
        />
        <button
          type="submit" disabled={busy}
          className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
        <button
          type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="w-full text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "No account? Sign up" : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
`,
};

export const PROFILES_MIGRATION: Snippet = {
  name: "ProfilesMigration",
  why:
    "Canonical profiles pattern: a public.profiles table linked to auth.users " +
    "via user_id (NEVER FK directly to auth.users in app schemas), RLS so " +
    "users only edit their own row, and a SECURITY DEFINER trigger that " +
    "auto-creates a profile on signup. Prevents the 'I signed up but my " +
    "profile is missing' bug.",
  uses: ["db_migration"],
  code: `-- profiles + auto-create trigger
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL UNIQUE,
  display_name text,
  avatar_url  text,
  bio         text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
`,
};

export const ROLES_MIGRATION: Snippet = {
  name: "UserRolesMigration",
  why:
    "The ONLY safe way to do roles in Supabase. Roles MUST live in a " +
    "separate user_roles table — NEVER on profiles (privilege escalation). " +
    "has_role() is SECURITY DEFINER so RLS policies can call it without " +
    "infinite recursion. First user automatically becomes admin.",
  uses: ["db_migration"],
  code: `-- role enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- roles table (separate from profiles!)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role    public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role: SECURITY DEFINER + STABLE so it can be used inside RLS policies
-- without recursion. ALWAYS use this — never inline a subquery against
-- user_roles inside another table's RLS policy.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users view own roles"
  ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- First user becomes admin, the rest become 'user' by default.
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing_count int;
BEGIN
  SELECT count(*) INTO existing_count FROM public.user_roles;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN existing_count = 0 THEN 'admin'::public.app_role
                       ELSE 'user'::public.app_role END);
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_default_role();
`,
};

export const USE_USER_ROLE_HOOK: Snippet = {
  name: "useUserRoleHook",
  why:
    "Client-side admin/role check that reads from public.user_roles via RLS. " +
    "RLS does the real enforcement on the server — this hook is only for UI " +
    "gating (showing/hiding admin links, redirecting non-admins).",
  uses: ["@/integrations/supabase/client"],
  code: `// src/hooks/useUserRole.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

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
        setIsAdmin((data ?? []).some((r: any) => r.role === "admin"));
        setLoading(false);
      });
    return () => { cancel = true; };
  }, [user]);

  return { isAdmin, loading };
};
`,
};

export const REQUIRE_ADMIN: Snippet = {
  name: "RequireAdminGuard",
  why:
    "Route guard that does REAL admin check via user_roles RLS — NEVER falls " +
    "back to a mock 'isAdmin=true'. Non-admins are redirected to /. Loading " +
    "state shows a skeleton, never lets unauth users flash the protected UI.",
  uses: ["react-router-dom", "useAuth", "useUserRole"],
  code: `// src/components/RequireAdmin.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-background">
        <div className="h-6 w-32 animate-pulse rounded-full bg-muted" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
`,
};

export const ADMIN_CRUD_PAGE: Snippet = {
  name: "AdminCrudPage",
  why:
    "Generic per-table admin CRUD page template. Use this as the BLUEPRINT " +
    "when generating an admin panel tailored to an existing app: introspect " +
    "the linked Supabase schema with `list_tables` / `introspect_schema`, " +
    "then create one of these per user-facing table (products, orders, " +
    "posts, bookings, whatever the app actually has). Reads via RLS, edits " +
    "gated by has_role(auth.uid(),'admin'). Never lists tables the admin " +
    "shouldn't touch (auth.*, storage.*, internal log tables).",
  uses: ["@/integrations/supabase/client", "react-router-dom", "sonner"],
  code: `// src/pages/admin/<TableName>Admin.tsx — duplicate per table
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Replace TABLE + Row to match the actual table.
const TABLE = "products";
type Row = { id: string; name: string; price: number; created_at: string };

export default function ProductsAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Row> | null>(null);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from(TABLE).select("*").order("created_at", { ascending: false }).limit(200);
    if (error) toast.error(error.message); else setRows((data ?? []) as Row[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    const payload = { ...editing };
    const { error } = editing.id
      ? await supabase.from(TABLE).update(payload).eq("id", editing.id)
      : await supabase.from(TABLE).insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Saved"); setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this row?")) return;
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };

  const filtered = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Button onClick={() => setEditing({})}>New</Button>
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Price</TableHead><TableHead>Created</TableHead><TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={4}>Loading…</TableCell></TableRow>
              : filtered.length === 0 ? <TableRow><TableCell colSpan={4} className="text-muted-foreground">No rows</TableCell></TableRow>
              : filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.price}</TableCell>
                  <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(r)}>Edit</Button>
                    <Button size="sm" variant="destructive" onClick={() => remove(r.id)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "New"} row</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Input placeholder="Name" value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <Input placeholder="Price" type="number" value={editing.price ?? 0} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} />
              <Button className="w-full" onClick={save}>Save</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
`,
};

export const ADMIN_LAYOUT: Snippet = {
  name: "AdminLayout",
  why:
    "Sidebar + RequireAdmin wrapper for /admin/* routes in an EXISTING app. " +
    "Use this when the user adds an admin panel on top of a project that " +
    "already has its own design — it slots the admin section under /admin " +
    "without disrupting the public app. Sidebar items are generated per " +
    "table the admin should manage (passed via a simple array).",
  uses: ["react-router-dom", "@/components/RequireAdmin", "lucide-react"],
  code: `// src/pages/admin/AdminLayout.tsx
import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, LogOut } from "lucide-react";
import { RequireAdmin } from "@/components/RequireAdmin";
import { useAuth } from "@/hooks/useAuth";

// One entry per table you want to manage. Generate this list from the
// linked Supabase schema (skip auth.*, storage.*, role/log tables).
const NAV: { to: string; label: string }[] = [
  { to: "/admin", label: "Overview" },
  // { to: "/admin/products", label: "Products" },
  // { to: "/admin/orders", label: "Orders" },
];

export default function AdminLayout() {
  const { signOut } = useAuth();
  return (
    <RequireAdmin>
      <div className="min-h-[100dvh] flex w-full bg-background text-foreground">
        <aside className="w-60 shrink-0 border-r border-border bg-card flex flex-col">
          <div className="px-4 py-4 font-bold tracking-tight flex items-center gap-2">
            <LayoutDashboard size={18} className="text-primary" /> Admin
          </div>
          <nav className="flex-1 px-2 space-y-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to} to={n.to} end={n.to === "/admin"}
                className={({ isActive }) =>
                  \`block rounded-lg px-3 py-2 text-sm \${isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"}\`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <button
            onClick={signOut}
            className="m-2 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted text-foreground"
          >
            <LogOut size={14} /> Sign out
          </button>
        </aside>
        <main className="flex-1 p-6 overflow-auto"><Outlet /></main>
      </div>
    </RequireAdmin>
  );
}
`,
};

export const BACKEND_SNIPPETS: Snippet[] = [
  SUPABASE_CLIENT,
  USE_AUTH_HOOK,
  AUTH_PAGE,
  PROFILES_MIGRATION,
  ROLES_MIGRATION,
  USE_USER_ROLE_HOOK,
  REQUIRE_ADMIN,
  ADMIN_CRUD_PAGE,
  ADMIN_LAYOUT,
];
