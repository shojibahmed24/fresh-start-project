import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, ShieldCheck, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/UserMenu";
import { NotificationBell } from "@/components/NotificationBell";

type Props = {
  balance: number;
  isAdmin: boolean;
};

export const ShopHeader = ({ balance, isAdmin }: Props) => {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-[hsl(0_0%_100%/0.06)]">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="shrink-0"
          >
            <ArrowLeft size={16} />
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles size={16} className="text-primary shrink-0" />
            <span className="font-semibold tracking-tight truncate">Shop</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 h-8 rounded-full bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.08)]">
            <Coins size={13} className="text-primary" />
            <span className="text-xs sm:text-sm font-medium tabular-nums">{balance}</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground hidden xs:inline">credits</span>
          </div>
          {isAdmin && (
            <Button asChild variant="secondary" size="sm" className="hidden sm:inline-flex">
              <Link to="/admin">
                <ShieldCheck size={14} />
                Admin
              </Link>
            </Button>
          )}
          {isAdmin && (
            <Button asChild variant="ghost" size="icon-sm" className="sm:hidden" aria-label="Admin">
              <Link to="/admin">
                <ShieldCheck size={16} />
              </Link>
            </Button>
          )}
          <NotificationBell />
          <UserMenu variant="compact" />
        </div>
      </div>
    </header>
  );
};
