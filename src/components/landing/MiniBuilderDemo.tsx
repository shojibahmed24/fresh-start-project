import { m } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Smartphone } from "lucide-react";

/**
 * Marketing-only animation. Loops through:
 *   1. fake user prompt typing
 *   2. AI streaming a code block
 *   3. phone preview rendering the result
 * Pure CSS/JS — no real builder calls.
 */
const PROMPT = "Build a recipe app with favorites";
const CODE_LINES = [
  "export default function RecipeApp() {",
  "  const [favs, setFavs] = useState([]);",
  "  return (",
  "    <Stack>",
  "      <Header title=\"Recipes\" />",
  "      <RecipeGrid onSave={setFavs} />",
  "    </Stack>",
  "  );",
  "}",
];

export const MiniBuilderDemo = () => {
  const [phase, setPhase] = useState<"typing" | "thinking" | "coding" | "rendered">("typing");
  const [typed, setTyped] = useState("");
  const [codeIdx, setCodeIdx] = useState(0);
  const cycleRef = useRef(0);

  // Loop the demo
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      while (!cancelled) {
        cycleRef.current += 1;
        // 1. Type prompt
        setPhase("typing");
        setTyped("");
        for (let i = 1; i <= PROMPT.length; i++) {
          if (cancelled) return;
          await new Promise((r) => setTimeout(r, 38));
          setTyped(PROMPT.slice(0, i));
        }
        // 2. Brief thinking pause
        setPhase("thinking");
        await new Promise((r) => setTimeout(r, 700));
        // 3. Stream code
        setPhase("coding");
        setCodeIdx(0);
        for (let i = 1; i <= CODE_LINES.length; i++) {
          if (cancelled) return;
          await new Promise((r) => setTimeout(r, 220));
          setCodeIdx(i);
        }
        // 4. Show rendered phone
        setPhase("rendered");
        await new Promise((r) => setTimeout(r, 3200));
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 rounded-3xl glass-strong p-3 sm:p-4 shadow-elegant overflow-hidden">
      {/* gradient border accent */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-primary/20" />

      {/* Chat panel */}
      <div className="lg:col-span-4 rounded-2xl bg-surface-muted/80 border border-border/60 p-4 flex flex-col min-h-[280px]">
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold mb-3">
          <Sparkles size={14} className="text-primary" />
          AI CHAT
        </div>
        <div className="flex-1 space-y-2.5">
          {/* User bubble */}
          <div className="flex justify-end">
            <div className="max-w-[90%] rounded-2xl rounded-br-md bg-primary/15 border border-primary/30 px-3 py-2 text-xs">
              {typed}
              {phase === "typing" && (
                <span className="inline-block w-[2px] h-3 bg-primary ml-0.5 align-middle animate-blink" />
              )}
            </div>
          </div>
          {/* AI bubble */}
          {phase !== "typing" && (
            <m.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex"
            >
              <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-card border border-border/60 px-3 py-2 text-xs text-muted-foreground">
                {phase === "thinking" && (
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse [animation-delay:120ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse [animation-delay:240ms]" />
                  </span>
                )}
                {phase === "coding" && <>Generating <span className="text-primary font-mono">RecipeApp.tsx</span>…</>}
                {phase === "rendered" && (
                  <span className="text-foreground">
                    ✓ App ready · 1 file, 9 lines
                  </span>
                )}
              </div>
            </m.div>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground/60">
          <span className="flex-1 truncate">Describe your next app…</span>
          <Send size={14} className="text-primary" />
        </div>
      </div>

      {/* Code panel */}
      <div className="lg:col-span-5 rounded-2xl bg-[hsl(240_8%_4%)] border border-border/60 overflow-hidden min-h-[280px]">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/60 bg-surface-elevated/60">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-warning/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-success/60" />
          </div>
          <span className="text-[11px] text-muted-foreground font-mono ml-2">RecipeApp.tsx</span>
        </div>
        <pre className="p-4 text-[11.5px] leading-relaxed font-mono text-foreground/90 min-h-[220px]">
          {CODE_LINES.slice(0, codeIdx).map((line, i) => (
            <m.div
              key={`${cycleRef.current}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.18 }}
            >
              <span className="text-muted-foreground/60 mr-3 select-none">{String(i + 1).padStart(2, "0")}</span>
              <span dangerouslySetInnerHTML={{ __html: highlight(line) }} />
            </m.div>
          ))}
          {phase === "coding" && codeIdx < CODE_LINES.length && (
            <span className="inline-block w-2 h-3.5 bg-primary align-middle animate-blink ml-8" />
          )}
        </pre>
      </div>

      {/* Phone preview */}
      <div className="lg:col-span-3 flex items-center justify-center min-h-[280px] py-3">
        <div className="relative w-[180px] h-[360px] rounded-[2.2rem] bg-[hsl(240_8%_4%)] border border-border/80 shadow-2xl overflow-hidden">
          {/* notch */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-4 rounded-full bg-background z-20" />
          {/* screen */}
          <div className="absolute inset-1.5 rounded-[1.9rem] overflow-hidden bg-gradient-to-b from-surface-elevated to-surface-muted">
            {phase === "rendered" ? (
              <m.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="h-full p-3 pt-7 flex flex-col gap-2"
              >
                <div className="text-[11px] font-bold text-foreground">Recipes</div>
                {[1, 2, 3].map((i) => (
                  <m.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="rounded-lg bg-card border border-border/50 p-2 flex gap-2"
                  >
                    <div className="w-8 h-8 rounded-md bg-gradient-primary opacity-80" />
                    <div className="flex-1">
                      <div className="h-1.5 w-3/4 bg-foreground/70 rounded-full mb-1" />
                      <div className="h-1 w-1/2 bg-muted-foreground/50 rounded-full" />
                    </div>
                  </m.div>
                ))}
              </m.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground/60">
                <Smartphone size={26} />
                <span className="text-[10px]">Building preview…</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Tiny syntax highlighter — keyword/string/JSX colorization only.
function highlight(line: string): string {
  return line
    .replace(/("[^"]*")/g, '<span style="color:hsl(var(--accent-cyan))">$1</span>')
    .replace(/\b(export|default|function|return|const|useState)\b/g, '<span style="color:hsl(var(--primary))">$1</span>')
    .replace(/(&lt;[A-Z][a-zA-Z]*|<\/?[A-Z][a-zA-Z]*\s?\/?>)/g, '<span style="color:hsl(280 100% 78%)">$1</span>');
}
