import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Activity } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { ActivityLog } from "@/components/admin/ActivityLog";
import { NotificationBell } from "@/components/NotificationBell";
import { toast } from "sonner";

const AdminActivity = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth", { replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!roleLoading && !isAdmin && user) {
      toast.error("Admins only");
      navigate("/shop", { replace: true });
    }
  }, [roleLoading, isAdmin, user, navigate]);

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-background text-muted-foreground">
        Checking access…
      </div>
    );
  }
  if (!isAdmin) return null;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[420px] -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(60% 60% at 30% 0%, hsl(var(--primary)/0.18), transparent 60%), radial-gradient(50% 50% at 80% 10%, hsl(280 90% 60% / 0.12), transparent 70%)",
        }}
      />

      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-[hsl(0_0%_100%/0.06)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon-sm" onClick={() => navigate("/admin")} aria-label="Back">
              <ArrowLeft size={16} />
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/40 grid place-items-center shrink-0">
                <Activity size={14} className="text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold tracking-tight leading-none truncate">Activity Log</div>
                <div className="text-[10px] text-muted-foreground hidden sm:block">Audit trail & alerts</div>
              </div>
            </div>
          </div>
          <NotificationBell />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
        <ActivityLog />
      </main>
    </div>
  );
};

export default AdminActivity;
