import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { m, AnimatePresence } from "framer-motion";
import { Menu, X, Command } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { commandPalette } from "@/components/CommandPalette";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { InstallAppButton } from "@/components/InstallAppButton";

export const Navbar = () => {
  const location = useLocation();
  const onLanding = location.pathname === "/";
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = () => setOpen(false);

  return (
    <m.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={[
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        scrolled
          ? "backdrop-blur-xl bg-background/70 border-b border-border/60 shadow-[0_2px_24px_-12px_hsl(var(--primary)/0.35)]"
          : "backdrop-blur-md bg-background/30 border-b border-transparent",
      ].join(" ")}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link to="/" onClick={close} className="shrink-0">
          <Logo size="sm" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
          <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
        </nav>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-2">
          <ThemeSwitcher variant="compact" />
          <button
            onClick={() => commandPalette.open()}
            className="hidden lg:flex items-center gap-2 h-9 px-3 rounded-lg border border-border/60 bg-background/50 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition"
            aria-label="Open command palette"
          >
            <Command size={12} />
            <span>Quick jump</span>
            <kbd className="ml-2 px-1.5 py-0.5 rounded bg-muted/60 text-[10px] font-mono">⌘K</kbd>
          </button>
          <InstallAppButton variant="outline" size="sm" label="Install" />
          {onLanding ? (
            <>
              <Link to="/auth">
                <Button variant="ghost" size="sm">Sign in</Button>
              </Link>
              <Link to="/dashboard">
                <Button size="sm" className="bg-gradient-primary hover:opacity-90 text-primary-foreground font-semibold shadow-glow">
                  Start building
                </Button>
              </Link>
            </>
          ) : (
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">Dashboard</Button>
            </Link>
          )}
        </div>

        {/* Mobile: primary CTA + hamburger only (theme switcher moved into menu) */}
        <div className="flex md:hidden items-center gap-1.5">
          {onLanding && (
            <Link to="/dashboard" onClick={close}>
              <Button size="sm" className="h-9 px-3.5 text-xs bg-gradient-primary text-primary-foreground font-semibold shadow-glow">
                Start
              </Button>
            </Link>
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="grid place-items-center w-11 h-11 rounded-md text-foreground hover:bg-[hsl(0_0%_100%/0.06)] transition-colors active:scale-95"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown panel */}
      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden border-t border-border/50 bg-background/95 backdrop-blur-xl"
          >
            <div className="px-4 py-3 flex flex-col gap-1">
              <a href="#features" onClick={close} className="px-3 py-2.5 rounded-lg text-[15px] text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_100%/0.05)] transition-colors">Features</a>
              <a href="#how" onClick={close} className="px-3 py-2.5 rounded-lg text-[15px] text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_100%/0.05)] transition-colors">How it works</a>
              <a href="#pricing" onClick={close} className="px-3 py-2.5 rounded-lg text-[15px] text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_100%/0.05)] transition-colors">Pricing</a>
              <a href="#faq" onClick={close} className="px-3 py-2.5 rounded-lg text-[15px] text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_100%/0.05)] transition-colors">FAQ</a>
              <button
                onClick={() => { close(); commandPalette.open(); }}
                className="px-3 py-2.5 rounded-lg text-[15px] text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_100%/0.05)] transition-colors text-left flex items-center gap-2"
              >
                <Command size={14} /> Quick jump
              </button>

              <div className="h-px bg-border/50 my-2" />

              {/* Theme switcher inside menu — clears navbar visual noise */}
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[13px] font-medium text-muted-foreground">Theme</span>
                <ThemeSwitcher variant="compact" />
              </div>

              <div className="h-px bg-border/50 my-2" />

              <InstallAppButton variant="outline" size="default" className="w-full h-11" label="Install app" />
              {onLanding ? (
                <Link to="/auth" onClick={close}>
                  <Button variant="outline" size="default" className="w-full h-11">Sign in</Button>
                </Link>
              ) : (
                <Link to="/dashboard" onClick={close}>
                  <Button variant="outline" size="default" className="w-full h-11">Dashboard</Button>
                </Link>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </m.header>
  );
};
