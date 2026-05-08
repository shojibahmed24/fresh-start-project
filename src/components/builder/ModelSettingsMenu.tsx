// Model selector dropdown — lets the user paste an OpenRouter model ID
// (e.g. "qwen/qwen3.6-flash") that the agent will use for the next run.
// Persists to localStorage under `lovable_agent_model`. Empty value means
// "use backend default" (google/gemini-2.5-flash).
import { useEffect, useState } from "react";
import { Settings2, Check, RotateCcw, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAgentVersion } from "@/hooks/useAgentVersion";

const STORAGE_KEY = "lovable_agent_model";
const DEFAULT_LABEL = "Default (google/gemini-2.5-flash)";

const PRESETS = [
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
  "qwen/qwen3.5-plus-20260420",
  "anthropic/claude-3.5-sonnet",
  "openai/gpt-5-mini",
];

export function getActiveModel(): string | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v && v.trim() ? v.trim() : null;
}

export const ModelSettingsMenu = () => {
  const [value, setValue] = useState<string>("");
  const [open, setOpen] = useState(false);
  const { isAdmin, preferV2, loading: versionLoading, setPreference } = useAgentVersion();
  const [savingVersion, setSavingVersion] = useState(false);

  useEffect(() => {
    setValue(getActiveModel() ?? "");
  }, [open]);

  const toggleVersion = async (next: boolean) => {
    setSavingVersion(true);
    try {
      await setPreference(next);
      toast.success(next ? "Switched to Agent v2" : "Switched to Agent v1", {
        description: next
          ? "Planner-based orchestrator (experimental)"
          : "Single-pass executor (stable)",
      });
    } catch (e: any) {
      toast.error("Failed to save preference", {
        description: e?.message || "Try again",
      });
    } finally {
      setSavingVersion(false);
    }
  };

  const apply = (next: string) => {
    const trimmed = next.trim();
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY, trimmed);
      toast.success("Model updated", { description: trimmed });
    } else {
      localStorage.removeItem(STORAGE_KEY);
      toast.success("Reverted to default model");
    }
    setValue(trimmed);
    setOpen(false);
  };

  const active = getActiveModel();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="text-[hsl(var(--foreground-muted))] hover:text-foreground p-1.5 rounded-md hover:bg-[hsl(0_0%_100%/0.06)] transition-colors shrink-0"
          aria-label="Model settings"
          title={active ? `Active model: ${active}` : DEFAULT_LABEL}
        >
          <Settings2 size={15} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[320px] p-3">
        <DropdownMenuLabel className="px-0 pt-0 pb-1 text-xs font-semibold">
          AI Model (OpenRouter ID)
        </DropdownMenuLabel>
        <p className="text-[11px] text-[hsl(var(--foreground-muted))] mb-2 leading-snug">
          Paste any OpenRouter model ID. Leave empty to use the default.
        </p>
        <div className="flex gap-1.5">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="qwen/qwen3.6-flash"
            className="h-8 text-xs font-mono"
            onKeyDown={(e) => {
              if (e.key === "Enter") apply(value);
            }}
          />
          <Button size="sm" className="h-8 px-2" onClick={() => apply(value)}>
            <Check size={13} />
          </Button>
        </div>

        <DropdownMenuSeparator className="my-2" />
        <div className="text-[11px] text-[hsl(var(--foreground-muted))] mb-1.5">
          Quick picks
        </div>
        <div className="flex flex-col gap-0.5">
          {PRESETS.map((m) => (
            <button
              key={m}
              onClick={() => apply(m)}
              className={`text-left text-[11px] font-mono px-2 py-1 rounded hover:bg-[hsl(0_0%_100%/0.06)] transition-colors flex items-center justify-between ${
                active === m ? "text-foreground" : "text-[hsl(var(--foreground-muted))]"
              }`}
            >
              <span className="truncate">{m}</span>
              {active === m && <Check size={11} className="shrink-0 ml-2" />}
            </button>
          ))}
        </div>

        <DropdownMenuSeparator className="my-2" />
        <button
          onClick={() => apply("")}
          className="w-full text-left text-[11px] px-2 py-1 rounded hover:bg-[hsl(0_0%_100%/0.06)] transition-colors flex items-center gap-1.5 text-[hsl(var(--foreground-muted))]"
        >
          <RotateCcw size={11} />
          Reset to default
        </button>
        {active && (
          <div className="mt-2 px-2 py-1.5 rounded bg-[hsl(var(--bg-muted))] text-[10px] font-mono text-[hsl(var(--foreground-muted))] truncate">
            Active: {active}
          </div>
        )}

        {isAdmin && (
          <>
            <DropdownMenuSeparator className="my-2" />
            <DropdownMenuLabel className="px-0 pt-0 pb-1 text-xs font-semibold flex items-center gap-1.5">
              <Sparkles size={12} />
              Agent version
              <span className="ml-auto text-[9px] font-normal text-[hsl(var(--foreground-muted))] uppercase tracking-wide">
                Admin
              </span>
            </DropdownMenuLabel>
            <p className="text-[11px] text-[hsl(var(--foreground-muted))] mb-2 leading-snug">
              v1 = stable single-pass. v2 = planner-based, experimental.
            </p>
            <div className="flex items-center justify-between px-2 py-1.5 rounded bg-[hsl(var(--bg-muted))]">
              <div className="flex flex-col">
                <span className="text-[11px] font-medium">
                  {preferV2 ? "Agent v2" : "Agent v1"}
                </span>
                <span className="text-[10px] text-[hsl(var(--foreground-muted))]">
                  {preferV2 ? "Planner orchestrator" : "Single-pass executor"}
                </span>
              </div>
              <Switch
                checked={preferV2}
                disabled={versionLoading || savingVersion}
                onCheckedChange={toggleVersion}
                aria-label="Toggle agent version"
              />
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
