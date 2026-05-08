import type { Snippet } from "../types.ts";

export const KOKO_SEARCH_BAR: Snippet = {
  name: "Premium search bar with filter chips",
  why: "Search/discover screens need a pill input + horizontally scrolling filter chips below it.",
  uses: ["lucide-react: Search, SlidersHorizontal"],
  code: `function SearchBar({ value, onChange, chips, active, onChip }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2.5
        focus-within:ring-2 focus-within:ring-primary/40 transition">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input value={value} onChange={(e) => onChange(e.target.value)}
          placeholder="Search…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        <button className="grid h-7 w-7 place-items-center rounded-full bg-background">
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
        {chips.map((c) => {
          const on = active === c;
          return (
            <button key={c} onClick={() => onChip(c)}
              className={\`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition
                \${on
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border hover:border-primary/40"}\`}>
              {c}
            </button>
          );
        })}
      </div>
    </div>
  );
}`,
};

export const KOKO_OTP_INPUT: Snippet = {
  name: "OTP / verification code input row",
  why: "Auth/2FA flows need 6 individual code boxes that auto-advance, not one long input.",
  code: `function OtpInput({ length = 6, value, onChange }) {
  const refs = React.useRef([]);
  const handle = (i, v) => {
    const next = value.split("");
    next[i] = v.slice(-1);
    onChange(next.join(""));
    if (v && i < length - 1) refs.current[i + 1]?.focus();
  };
  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length }).map((_, i) => (
        <input key={i} ref={(el) => (refs.current[i] = el)}
          inputMode="numeric" maxLength={1}
          value={value[i] || ""} onChange={(e) => handle(i, e.target.value)}
          className="h-12 w-10 rounded-xl border-2 border-border bg-card text-center text-lg font-bold
            tabular-nums outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 transition" />
      ))}
    </div>
  );
}`,
};

export const KOKO_PASSWORD_ENTRY: Snippet = {
  name: "Password manager vault entry",
  why: "Password apps need entry rows with site icon, masked password reveal, copy button.",
  uses: ["lucide-react: Eye, EyeOff, Copy, Globe"],
  code: `function VaultEntry({ entry }) {
  const [show, setShow] = React.useState(false);
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-card border border-border/60 p-3">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
        <Globe className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{entry.site}</p>
        <p className="text-xs text-muted-foreground">{entry.username}</p>
      </div>
      <p className="font-mono text-xs tabular-nums tracking-wider w-24 text-right">
        {show ? entry.password : "••••••••"}
      </p>
      <button onClick={() => setShow(!show)} className="text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      <button className="text-muted-foreground hover:text-primary">
        <Copy className="h-4 w-4" />
      </button>
    </li>
  );
}`,
};

export const KOKO_FILE_UPLOAD: Snippet = {
  name: "Drag-and-drop file upload zone with progress list",
  why: "Upload UIs need a dashed dropzone + active uploading list with per-file progress bars.",
  uses: ["lucide-react: UploadCloud, File, X, Check"],
  code: `function UploadZone({ uploads, onPick }) {
  // uploads: [{ id, name, size, progress, done? }]
  return (
    <div className="space-y-3">
      <label className="block rounded-2xl border-2 border-dashed border-border bg-muted/30
        hover:bg-muted/50 hover:border-primary/40 transition p-8 text-center cursor-pointer">
        <input type="file" className="sr-only" multiple onChange={onPick} />
        <UploadCloud className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">Drop files here or <span className="text-primary">browse</span></p>
        <p className="text-xs text-muted-foreground">PNG, JPG, PDF up to 10 MB</p>
      </label>
      {uploads.length > 0 && (
        <ul className="rounded-2xl bg-card border border-border/60 divide-y divide-border/60 overflow-hidden">
          {uploads.map((u) => (
            <li key={u.id} className="flex items-center gap-3 p-3">
              <File className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium">{u.name}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">{u.size}</p>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                  <div className={\`h-full transition-all duration-300 \${u.done ? "bg-emerald-500" : "bg-primary"}\`}
                    style={{ width: \`\${u.progress}%\` }} />
                </div>
              </div>
              {u.done
                ? <Check className="h-4 w-4 text-emerald-500" strokeWidth={3} />
                : <button><X className="h-4 w-4 text-muted-foreground" /></button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}`,
};

