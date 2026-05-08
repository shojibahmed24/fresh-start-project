import type { Template } from "./types";

export const adminDashboardTemplate: Template = {
  id: "admin-dashboard",
  emoji: "📊",
  name: "Admin Dashboard",
  tagline: "Analytics, users & orders panel",
  gradient: "from-slate-700 to-slate-900",
  defaultName: "My Admin Panel",
  defaultDescription: "Desktop-first admin dashboard with analytics, user management, orders and role-based access.",
  starterPrompt: `Build a COMPLETE, fully working DESKTOP-FIRST admin dashboard. This is NOT a mobile app — optimize for laptop / large screens with a collapsible sidebar layout. Requirements:
- Use react-router-dom with nested routes under /dashboard. Use shadcn Sidebar (collapsible="icon") wrapped in SidebarProvider in a DashboardLayout — sidebar must collapse to a narrow icon strip and a SidebarTrigger lives in the top bar so it is ALWAYS visible.
- Use a custom design system in index.css and tailwind.config.ts (HSL semantic tokens — neutral slate/zinc base + a single brand accent, subtle borders, soft shadows, rounded-xl cards, refined typography). Support dark mode via next-themes with a toggle in the top bar.
- Use recharts for ALL graphs (LineChart, BarChart, PieChart, AreaChart) — never raw SVG. Use shadcn Table for ALL data lists with manual pagination (10/25/50 per page selector), column header sort, and search Input + Select filters above the table.
- Use lucide-react icons, shadcn/ui components, tailwind only. Include skeleton loaders (NOT spinners), empty states with helpful CTAs, and toast feedback for every mutation.

🔐 **REAL ADMIN AUTH — NO MOCKS, EVER:**
- Check the SUPABASE LINK STATUS banner. If NOT CONNECTED: **DO NOT WRITE ANY FILES AT ALL**. Do not scaffold a placeholder screen, do not modify App.tsx, do not create any component. Reply ONLY with the literal token \`[[supabase-connect]]\` on its own line in chat, followed by one short sentence: "Connect a Supabase project from the Cloud panel (top-right) and I'll build the full admin dashboard with real auth, role checks, and database wiring in the next turn." That is the entire response — no tool calls, no file writes, no preview changes.
- If CONNECTED: you MUST run the canonical migrations BEFORE writing any UI. Call \`get_snippet({ name: "ProfilesMigration" })\` then \`db_migration\`, then \`get_snippet({ name: "UserRolesMigration" })\` then \`db_migration\`. Then \`get_snippet\` for SupabaseClient, useAuthHook, AuthPage, useUserRoleHook, RequireAdminGuard and write them via \`bulk_write_files\`.
- Protect /dashboard with the real \`<RequireAdmin>\` from the snippet — it queries \`public.user_roles\` via RLS. NEVER write \`const isAdmin = true\` or any localStorage-based admin flag — that is a privilege escalation hole and the validator will reject it.
- The first user who signs up automatically becomes admin (the UserRolesMigration trigger handles it). Mention this in your final summary so the user knows who their admin is.

- Every button, filter, pagination control, sidebar item, search box MUST be wired up — no dead UI. Sidebar active route is highlighted via NavLink with activeClassName.
- The SidebarProvider wrapper div must use min-h-screen flex w-full so the layout stretches correctly.

📁 **MODULAR FILE RULE (STRICT):**
- NO file may exceed 300 lines (target 150-220).
- Each route screen lives in \`src/pages/dashboard/\` and only composes components (under 120 lines).
- Feature components grouped: \`src/components/dashboard/{stats,users,orders,analytics,settings,layout}/\`. StatCard, DataTable, PageHeader, RequireAdmin all separate files.
- Seed/demo data lives in \`src/data/\` ONLY when Supabase is not yet connected — the moment it IS connected, replace mock arrays with real \`supabase.from(...).select(...)\` queries.

Layout:
- DashboardLayout: SidebarProvider → AppSidebar (left) + main column (TopBar sticky on top + <Outlet />).
- AppSidebar: brand logo at top, 5 nav items using NavLink (Overview, Users, Orders, Analytics, Settings), collapses to icon-only mode preserving icons.
- TopBar: SidebarTrigger on the left, global search Input (with Cmd+K hint), notification bell with unread badge DropdownMenu, theme toggle, user avatar DropdownMenu (Profile / Settings / Logout — Logout calls \`supabase.auth.signOut()\`).

Routes & screens:
1. /dashboard (Overview) — 4 StatCards in a grid (Total Revenue, Active Users, Orders Today, Growth %) each with icon, big number, % delta vs last period, and a tiny inline sparkline. Below: 2-column grid with a recharts LineChart "Revenue — last 30 days" and a recharts BarChart "Top 5 Products by sales". Below that: "Recent Orders" mini table.
2. /dashboard/users — Card containing search Input + role Select filter + status Select filter + "Add user" Button. shadcn Table with columns: avatar+name, email, role badge, status badge, joined date, last login, actions DropdownMenu. Pagination footer.
3. /dashboard/orders — Same table pattern. Status tabs (All / Pending / Approved / Rejected) + date range picker + search.
4. /dashboard/analytics — Tabs (Revenue / Users / Traffic). Each tab has a recharts chart + 3 supporting metric cards. Date range selector controls all charts.
5. /dashboard/settings — Tabbed form (General / Appearance / Notifications / Security) using shadcn Form components, with save buttons and toast confirmation.

Reusable components:
- <StatCard title value delta icon trend />
- <DataTable columns data /> — wraps shadcn Table with sort, search, pagination.
- <PageHeader title description action />
- <RequireAdmin> — REAL guard from the RequireAdminGuard snippet, never a mock.

When Supabase IS connected, every list (Users, Orders, etc.) reads from real tables via RLS-protected \`supabase.from(...)\` queries with proper loading + empty + error states. NEVER ship a localStorage-backed admin panel as the final delivery.`,
};
