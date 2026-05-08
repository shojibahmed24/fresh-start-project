import { useEffect, useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  ShoppingBag,
  User as UserIcon,
  MessageSquare,
  Sparkles,
  FolderKanban,
  Settings,
  Home,
  LogOut,
  ExternalLink,
  Eye,
} from "lucide-react";
import { listProjects, type Project } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";

/**
 * Tiny external store so any component anywhere in the tree can pop the
 * palette without prop drilling or a context provider.
 */
let _open = false;
const _listeners = new Set<() => void>();
const _emit = () => _listeners.forEach((l) => l());

export const commandPalette = {
  open: () => { _open = true; _emit(); },
  close: () => { _open = false; _emit(); },
  toggle: () => { _open = !_open; _emit(); },
  set: (v: boolean) => { _open = v; _emit(); },
};

export const useCommandPalette = () => {
  const open = useSyncExternalStore(
    (cb) => { _listeners.add(cb); return () => _listeners.delete(cb); },
    () => _open,
    () => false,
  );
  return { open, setOpen: commandPalette.set };
};

export const CommandPalette = () => {
  const { open, setOpen } = useCommandPalette();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);

  // ⌘K / Ctrl+K toggle anywhere in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        commandPalette.toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Lazy-load the user's projects the first time the palette opens.
  useEffect(() => {
    if (open && user && projects.length === 0) {
      listProjects().then(setProjects).catch(() => {});
    }
  }, [open, user, projects.length]);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search projects, pages, actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => go("/")}>
            <Home className="mr-2 size-4" /> Home
          </CommandItem>
          <CommandItem onSelect={() => go("/projects")}>
            <FolderKanban className="mr-2 size-4" /> Projects
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard")}>
            <LayoutDashboard className="mr-2 size-4" /> Builder workspace
          </CommandItem>
          <CommandItem onSelect={() => go("/shop")}>
            <ShoppingBag className="mr-2 size-4" /> Shop · Buy credits
          </CommandItem>
          <CommandItem onSelect={() => go("/profile")}>
            <UserIcon className="mr-2 size-4" /> Profile
          </CommandItem>
          <CommandItem onSelect={() => go("/profile?tab=settings")}>
            <Settings className="mr-2 size-4" /> Settings
          </CommandItem>
          <CommandItem onSelect={() => go("/support")}>
            <MessageSquare className="mr-2 size-4" /> Support
          </CommandItem>
        </CommandGroup>

        {projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Your projects">
              {projects.slice(0, 8).map((p) => (
                <CommandItem
                  key={p.id}
                  value={`project ${p.name} ${p.description}`}
                  onSelect={() => go(`/dashboard/${p.id}`)}
                >
                  <Sparkles className="mr-2 size-4 text-primary" />
                  <span className="truncate">{p.name}</span>
                  <ExternalLink className="ml-auto size-3 text-muted-foreground" />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/projects")}>
            <Sparkles className="mr-2 size-4" /> New project
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setOpen(false);
              // Dispatch a global event — PreviewPanel listens and runs the
              // review on the currently-mounted preview iframe.
              window.dispatchEvent(new CustomEvent("oneclick:run-visual-review"));
            }}
          >
            <Eye className="mr-2 size-4" /> Run AI visual review
          </CommandItem>
          {user && (
            <CommandItem
              onSelect={async () => {
                setOpen(false);
                await signOut();
                navigate("/");
              }}
              className="text-destructive"
            >
              <LogOut className="mr-2 size-4" /> Sign out
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};
