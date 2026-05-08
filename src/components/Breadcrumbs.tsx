import { Link, useLocation, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { ChevronRight, Home } from "lucide-react";
import { loadProject } from "@/lib/store";

/**
 * Auto breadcrumbs. Reads the current pathname and renders a minimal
 * Home → Section → (Project name) trail. Stays out of the way on the
 * landing page, auth, and any unknown routes.
 */
export const Breadcrumbs = ({ className = "" }: { className?: string }) => {
  const location = useLocation();
  const params = useParams<{ id?: string }>();
  const [projectName, setProjectName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (params.id) {
      loadProject(params.id)
        .then((p) => { if (!cancelled) setProjectName(p?.name ?? null); })
        .catch(() => {});
    } else {
      setProjectName(null);
    }
    return () => { cancelled = true; };
  }, [params.id]);

  const path = location.pathname;
  const crumbs: { label: string; to?: string }[] = [];

  if (path.startsWith("/dashboard")) {
    crumbs.push({ label: "Dashboard", to: "/dashboard" });
    if (params.id) crumbs.push({ label: projectName ?? "Project" });
  } else if (path.startsWith("/projects")) {
    crumbs.push({ label: "Projects" });
  } else if (path.startsWith("/shop")) {
    crumbs.push({ label: "Shop" });
  } else if (path.startsWith("/profile")) {
    crumbs.push({ label: "Profile" });
  } else if (path.startsWith("/support")) {
    crumbs.push({ label: "Support" });
  } else if (path.startsWith("/admin")) {
    crumbs.push({ label: "Admin" });
    if (path.includes("/activity")) crumbs.push({ label: "Activity" });
  } else {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-1 text-xs text-muted-foreground min-w-0 ${className}`}
    >
      <Link
        to="/"
        className="inline-flex items-center hover:text-foreground transition-colors p-1 -m-1 rounded"
        aria-label="Home"
      >
        <Home size={12} />
      </Link>
      {crumbs.map((c, i) => (
        <span key={i} className="inline-flex items-center gap-1 min-w-0">
          <ChevronRight size={12} className="opacity-50 shrink-0" />
          {c.to ? (
            <Link to={c.to} className="hover:text-foreground transition-colors truncate max-w-[140px]">
              {c.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium truncate max-w-[200px]">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
};
