import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { LazyMotion, domAnimation } from "framer-motion";
import { lazy, Suspense, useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
// Auth loads eagerly — tiny and on the critical path for sign-in.
// Landing (Index) is lazy: pulls framer-motion + many landing sections.
// Signed-in users redirect to /dashboard, so they don't pay for it.
import Auth from "./pages/Auth.tsx";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { PageTransition } from "./components/motion/PageTransition";
import { useViewportHeight } from "./hooks/useViewportHeight";
import { BuilderSkeleton } from "./components/builder/Skeletons";
import { MaintenanceGate } from "./components/MaintenanceGate";
import { Logo } from "./components/Logo";
import { CommandPalette } from "./components/CommandPalette";
import { ThemeProvider } from "./components/ThemeProvider";
import { InstallBanner } from "./components/InstallBanner";
import { routeImporters, prefetchLikelyRoutes } from "./lib/prefetch";

// Heavy pages get lazy-loaded — Builder ships Monaco, framer animations, etc.
// We share importers with src/lib/prefetch.ts so a hover-prefetched chunk and
// the actual navigation hit the same in-flight promise (no double download).
const Index = lazy(() => import("./pages/Index.tsx"));
const Projects = lazy(routeImporters.projects); // formerly /dashboard, now /projects
const Builder = lazy(routeImporters.builder); // mounted at /dashboard
const Profile = lazy(routeImporters.profile);
const Shop = lazy(routeImporters.shop);
const Admin = lazy(routeImporters.admin); // mounted at /admin
const AdminActivity = lazy(routeImporters.adminActivity);
const Support = lazy(routeImporters.support);
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

/**
 * Once auth resolves, idle-prefetch the heavy signed-in pages so subsequent
 * navigation feels instant. Runs once per session.
 */
const RoutePrefetcher = () => {
  const { loading, user } = useAuth();
  useEffect(() => {
    if (loading) return;
    if (!user) return;
    prefetchLikelyRoutes();
  }, [loading, user]);
  return null;
};

const queryClient = new QueryClient();

const ViewportSetup = ({ children }: { children: React.ReactNode }) => {
  useViewportHeight();
  return <>{children}</>;
};

// Lightweight fallback for most routes — instant, no heavy gradients/animations.
const RouteLoading = () => (
  <div className="min-h-[100dvh] grid place-items-center bg-background">
    <div className="flex flex-col items-center gap-3 opacity-80">
      <Logo size="sm" />
      <div className="h-1 w-24 rounded-full bg-muted overflow-hidden">
        <div className="h-full w-1/2 bg-primary animate-[shimmer_1.2s_linear_infinite]" />
      </div>
    </div>
  </div>
);

// Heavy branded fallback — only for the Builder route (Monaco etc.)
const BuilderLoading = () => <BuilderSkeleton />;

// Legacy redirect: /builder/:id → /dashboard/:id (and /builder → /dashboard).
const BuilderRedirect = () => {
  const { id } = useParams();
  return <Navigate to={id ? `/dashboard/${id}` : "/dashboard"} replace />;
};

// Wraps a lazy element in its own Suspense boundary so siblings don't share a heavy fallback.
const Lazy = ({ children, heavy = false }: { children: React.ReactNode; heavy?: boolean }) => (
  <Suspense fallback={heavy ? <BuilderLoading /> : <RouteLoading />}>{children}</Suspense>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LazyMotion features={domAnimation} strict={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <AuthProvider>
          <RoutePrefetcher />
          <ViewportSetup>
          <PageTransition>
            <MaintenanceGate>
              <CommandPalette />
              <InstallBanner />
              <Routes>
                <Route path="/" element={<Lazy><Index /></Lazy>} />
                <Route path="/auth" element={<Auth />} />

                {/* Dashboard = the AI chat workspace (formerly /builder) — heavy */}
                <Route path="/dashboard" element={<Lazy heavy><Builder /></Lazy>} />
                <Route path="/dashboard/:id" element={<Lazy heavy><Builder /></Lazy>} />

                {/* Projects = the project list (formerly /dashboard) */}
                <Route path="/projects" element={<Lazy><Projects /></Lazy>} />

                <Route path="/profile" element={<Lazy><Profile /></Lazy>} />
                <Route path="/shop" element={<Lazy><Shop /></Lazy>} />

                {/* Admin = main admin control center (formerly /admin/shop) */}
                <Route path="/admin" element={<Lazy><Admin /></Lazy>} />
                <Route path="/admin/activity" element={<Lazy><AdminActivity /></Lazy>} />

                <Route path="/support" element={<Lazy><Support /></Lazy>} />

                {/* ── Legacy redirects (keep old links/bookmarks/notifications working) ── */}
                <Route path="/builder" element={<BuilderRedirect />} />
                <Route path="/builder/:id" element={<BuilderRedirect />} />
                <Route path="/admin/shop" element={<Navigate to="/admin" replace />} />

                <Route path="*" element={<Lazy><NotFound /></Lazy>} />
              </Routes>
            </MaintenanceGate>
          </PageTransition>
          </ViewportSetup>
        </AuthProvider>
      </BrowserRouter>
      </TooltipProvider>
      </LazyMotion>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
