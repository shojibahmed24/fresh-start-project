import ReactMarkdown from "react-markdown";
import { CodeBlock } from "@/components/ui/code-block";

// Strip status emoji lines like "✅ `src/App.tsx`" once we render diff cards.
export const STATUS_LINE_RE = /^\s*(?:✅|📝|📄|✏️|🚀)\s*`?[\w./-]+`?\s*$/gm;

// Heuristic: a "long" assistant message (worth collapsing) is >280 chars or >4 paragraphs.
export const isLongContent = (s: string) => s.length > 280 || s.split(/\n\s*\n/).length > 4;

// Pull a short 1-line headline from the first non-empty line (strip markdown).
export const extractHeadline = (s: string): string => {
  const first = s
    .split("\n")
    .map((l) => l.replace(/\[\[supabase-connect\]\]/g, "").trim())
    .find((l) => l.length > 0) ?? "";
  const clean = first
    .replace(/^#+\s*/, "")
    .replace(/[*_`]/g, "")
    .replace(/^\s*[-•]\s*/, "")
    .trim();
  return clean.length > 120 ? clean.slice(0, 117) + "…" : clean;
};

// Markdown renderer with our CodeBlock for fenced blocks + refined styling
// for inline code, tables, links, blockquotes, kbd, etc. The actual visual
// rules live in the `.chat-prose` class in `index.css`.
export const markdownComponents = {
  code({ inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || "");
    const code = String(children).replace(/\n$/, "");
    if (!inline && (match || code.includes("\n"))) {
      return <CodeBlock code={code} language={match?.[1]} className="my-2 not-prose" />;
    }
    return <code {...props}>{children}</code>;
  },
  table({ children, ...props }: any) {
    return (
      <div className="chat-table-wrap">
        <table {...props}>{children}</table>
      </div>
    );
  },
  a({ href, children, ...props }: any) {
    const isExternal = typeof href === "string" && /^https?:\/\//.test(href);
    return (
      <a
        href={href}
        {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        {...props}
      >
        {children}
      </a>
    );
  },
};

export { ReactMarkdown };
