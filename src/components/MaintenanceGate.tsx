import { Wrench } from "lucide-react";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";

// Wrap protected routes. If maintenance mode is on and the viewer is not an
// admin, render a friendly full-screen notice instead of the children.
export const MaintenanceGate = ({ children }: { children: React.ReactNode }) => {
  const { settings, loading } = useAppSettings();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { user } = useAuth();

  if (loading || roleLoading) return <>{children}</>;
  if (!settings.maintenance_mode) return <>{children}</>;
  if (isAdmin) return <>{children}</>;

  return (
    <div className="min-h-[100dvh] grid place-items-center bg-background text-foreground p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/15 grid place-items-center">
          <Wrench className="text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{settings.site_name} is under maintenance</h1>
        <p className="text-muted-foreground text-sm whitespace-pre-line">
          {settings.maintenance_message || "We'll be back shortly."}
        </p>
        {user && (
          <p className="text-[11px] text-muted-foreground">Signed in as {user.email}</p>
        )}
      </div>
    </div>
  );
};
