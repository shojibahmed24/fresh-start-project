import { useState } from "react";
import { Check, Copy, FileCode } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "@/lib/utils";

/**
 * CodeBlock — Prism-powered syntax highlighting with filename header
 * and one-click copy button. Dark theme (oneDark) tuned to our cyan palette.
 *
 * <CodeBlock code={src} language="tsx" filename="App.tsx" />
 */
export interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  className?: string;
  showLineNumbers?: boolean;
  maxHeight?: number | string;
}

const langFor = (filename?: string, language?: string): string => {
  if (language) return language;
  if (!filename) return "tsx";
  if (filename.endsWith(".tsx") || filename.endsWith(".ts")) return "tsx";
  if (filename.endsWith(".jsx") || filename.endsWith(".js")) return "jsx";
  if (filename.endsWith(".css")) return "css";
  if (filename.endsWith(".json")) return "json";
  if (filename.endsWith(".md")) return "markdown";
  if (filename.endsWith(".html")) return "html";
  if (filename.endsWith(".py")) return "python";
  if (filename.endsWith(".sh")) return "bash";
  return "text";
};

export const CodeBlock = ({
  code,
  language,
  filename,
  className,
  showLineNumbers = true,
  maxHeight,
}: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  const lang = langFor(filename, language);
  const lineCount = code.split("\n").length;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border border-[hsl(0_0%_100%/0.08)] bg-[hsl(240_10%_4%)]",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-[hsl(0_0%_100%/0.06)] bg-[hsl(0_0%_100%/0.02)] px-3 py-1.5">
        <div className="flex items-center gap-2 min-w-0 text-xs font-mono text-[hsl(var(--foreground-muted))]">
          <FileCode className="size-3.5 shrink-0 text-primary/80" aria-hidden />
          {filename && <span className="truncate">{filename}</span>}
          {/* Language badge — always visible, distinct chip */}
          <span className="shrink-0 inline-flex items-center rounded-md border border-primary/25 bg-primary/10 px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-wider text-primary">
            {lang}
          </span>
          <span className="shrink-0 text-[10px] uppercase tracking-wider opacity-60 hidden sm:inline">
            · {lineCount} {lineCount === 1 ? "line" : "lines"}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Copied" : "Copy code"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium",
            "text-[hsl(var(--foreground-muted))] hover:text-foreground",
            "hover:bg-[hsl(0_0%_100%/0.06)] transition-colors duration-150",
            copied && "text-primary",
          )}
        >
          {copied ? (
            <>
              <Check className="size-3.5" aria-hidden />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" aria-hidden />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Code */}
      <div
        className="overflow-auto"
        style={maxHeight ? { maxHeight: typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight } : undefined}
      >
        <SyntaxHighlighter
          language={lang}
          style={oneDark}
          showLineNumbers={showLineNumbers}
          customStyle={{
            margin: 0,
            padding: "1rem 1.25rem",
            background: "transparent",
            fontSize: "12.5px",
            fontFamily: "'Geist Mono', 'JetBrains Mono', ui-monospace, monospace",
            lineHeight: 1.6,
          }}
          codeTagProps={{
            style: {
              fontFamily: "'Geist Mono', 'JetBrains Mono', ui-monospace, monospace",
            },
          }}
          lineNumberStyle={{
            minWidth: "2em",
            paddingRight: "1em",
            color: "hsl(0 0% 40%)",
            userSelect: "none",
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};
