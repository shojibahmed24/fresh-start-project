import { Link, useNavigate } from "react-router-dom";
import { LogOut, User as UserIcon, LayoutDashboard, Settings, ShoppingBag, MessageSquare, FolderKanban } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { prefetchRoute, routeForPath, type RouteName } from "@/lib/prefetch";

/**
 * Warm a route's JS chunk on hover/focus/touch so the click feels instant.
 * Spread the returned handlers onto the <Link>.
 */
const prefetchHandlers = (name: RouteName | null) => {
  if (!name) return {};
  const fire = () => prefetchRoute(name);
  return { onMouseEnter: fire, onFocus: fire, onTouchStart: fire };
};

type Props = {
  // Compact = small avatar (Builder header). Default = larger pill (Dashboard).
  variant?: "default" | "compact";
};

// Reusable user menu used in the app header. Shows the avatar (or initial)
// and opens a dropdown with quick links to the profile, dashboard, and sign out.
export const UserMenu = ({ variant = "default" }: Props) => {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();

  const initial = (profile?.display_name?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();
  const avatar = profile?.avatar_url;
  const displayName = profile?.display_name ?? user?.email?.split("@")[0] ?? "User";

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out");
      navigate("/");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const sizeCls = variant === "compact" ? "size-7" : "size-9";
  const textCls = variant === "compact" ? "text-[10px]" : "text-sm";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "rounded-full flex items-center justify-center font-semibold text-background ring-1 ring-primary/30 overflow-hidden transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            sizeCls,
            !avatar && "bg-gradient-primary",
          )}
          aria-label="Open user menu"
        >
          {avatar ? (
            <img
              src={avatar}
              alt={displayName}
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className={textCls}>{initial}</span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-60 bg-[hsl(var(--bg-elevated))] border-[hsl(0_0%_100%/0.08)]"
      >
        <DropdownMenuLabel className="flex items-center gap-2.5 py-2.5">
          <div
            className={cn(
              "size-9 rounded-full flex items-center justify-center font-semibold text-background overflow-hidden shrink-0",
              !avatar && "bg-gradient-primary",
            )}
          >
            {avatar ? (
              <img src={avatar} alt={displayName} className="size-full object-cover" />
            ) : (
              <span className="text-sm">{initial}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-foreground truncate">{displayName}</div>
            <div className="text-[11px] text-[hsl(var(--foreground-subtle))] truncate font-normal">
              {user?.email}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-[hsl(0_0%_100%/0.08)]" />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/profile" {...prefetchHandlers(routeForPath("/profile"))} className="flex items-center gap-2">
            <UserIcon size={14} />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/dashboard" {...prefetchHandlers(routeForPath("/dashboard"))} className="flex items-center gap-2">
            <LayoutDashboard size={14} />
            <span>Dashboard</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/projects" {...prefetchHandlers(routeForPath("/projects"))} className="flex items-center gap-2">
            <FolderKanban size={14} />
            <span>Projects</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/shop" {...prefetchHandlers(routeForPath("/shop"))} className="flex items-center gap-2">
            <ShoppingBag size={14} />
            <span>Shop · Buy credits</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/support" {...prefetchHandlers(routeForPath("/support"))} className="flex items-center gap-2">
            <MessageSquare size={14} />
            <span>Support</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/profile?tab=settings" {...prefetchHandlers(routeForPath("/profile"))} className="flex items-center gap-2">
            <Settings size={14} />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-[hsl(0_0%_100%/0.08)]" />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
        >
          <LogOut size={14} className="mr-2" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
