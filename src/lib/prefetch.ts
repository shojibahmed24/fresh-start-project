// Centralized lazy-route imports + prefetch helpers.
//
// Why this file exists:
// Heavy pages (Builder, Projects, Profile, Shop, Admin) are code-split via
// React.lazy(). By default their JS chunk only starts downloading when the
// user navigates — so the first click feels slow ("Loading…" for a beat).
//
// Here we:
//   1) Export the same dynamic import() factories used by App.tsx, so React
//      and the prefetcher share one promise (no duplicate downloads).
//   2) Provide `prefetchRoute(name)` to warm a chunk on hover/focus/touch.
//   3) Provide `prefetchLikelyRoutes()` to warm common destinations during
//      browser idle time after auth is ready.

export const routeImporters = {
  projects: () => import("@/pages/Dashboard.tsx"),
  builder: () => import("@/pages/Builder.tsx"),
  profile: () => import("@/pages/Profile.tsx"),
  shop: () => import("@/pages/Shop.tsx"),
  admin: () => import("@/pages/AdminShop.tsx"),
  adminActivity: () => import("@/pages/AdminActivity.tsx"),
  support: () => import("@/pages/Support.tsx"),
} as const;

export type RouteName = keyof typeof routeImporters;

const started = new Set<RouteName>();

/** Kick off a chunk download once. Safe to call repeatedly (hover spam OK). */
export const prefetchRoute = (name: RouteName) => {
  if (started.has(name)) return;
  started.add(name);
  // Errors are fine — the real navigation will surface them properly.
  routeImporters[name]().catch(() => started.delete(name));
};

/**
 * Warm the most common signed-in destinations when the browser is idle.
 *
 * NOTE: We deliberately exclude `builder` here — it pulls in Monaco (~2 MB)
 * and only a fraction of sessions actually open the editor. Builder is still
 * hover/touch-prefetched the moment a user points at a project card via
 * `prefetchRoute("builder")`, so the click→navigation feel stays instant
 * without burning bandwidth on first paint.
 */
export const prefetchLikelyRoutes = () => {
  const run = () => {
    prefetchRoute("projects");
    prefetchRoute("profile");
    prefetchRoute("shop");
  };
  const ric = (window as any).requestIdleCallback as
    | ((cb: () => void, opts?: { timeout: number }) => number)
    | undefined;
  if (ric) ric(run, { timeout: 2500 });
  else setTimeout(run, 1200);
};

/** Map a path prefix to a route name — used by generic <Link> hover prefetching. */
export const routeForPath = (path: string): RouteName | null => {
  if (path.startsWith("/dashboard")) return "builder";
  if (path.startsWith("/projects")) return "projects";
  if (path.startsWith("/profile")) return "profile";
  if (path.startsWith("/shop")) return "shop";
  if (path === "/admin/activity") return "adminActivity";
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/support")) return "support";
  return null;
};
