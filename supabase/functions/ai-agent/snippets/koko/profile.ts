import type { Snippet } from "../types.ts";

export const KOKO_PROFILE_HEADER: Snippet = {
  name: "Profile header with cover + avatar + stats",
  why: "Profile screens need cover image, big circular avatar overlap, name, and 3-stat row.",
  uses: ["lucide-react: Settings, MoreHorizontal"],
  code: `function ProfileHeader({ user }) {
  // user: { name, handle, bio, cover, avatar, stats: [{label,value}] }
  return (
    <section className="rounded-3xl overflow-hidden bg-card border border-border/60">
      <div className="relative h-28 bg-gradient-to-br from-fuchsia-400 via-pink-500 to-amber-400">
        <img src={user.cover} alt="" className="h-full w-full object-cover mix-blend-overlay opacity-90" />
        <button className="absolute top-3 right-3 grid h-8 w-8 place-items-center rounded-full bg-black/30 backdrop-blur text-white">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
      <div className="px-5 pb-5">
        <img src={user.avatar} alt="" className="-mt-10 h-20 w-20 rounded-full ring-4 ring-card object-cover" />
        <h2 className="mt-3 text-xl font-bold">{user.name}</h2>
        <p className="text-sm text-muted-foreground">@{user.handle}</p>
        <p className="mt-2 text-sm leading-relaxed">{user.bio}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-muted/50 p-3">
          {user.stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-lg font-bold tabular-nums">{s.value}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}`,
};

export const KOKO_ACTION_LIST: Snippet = {
  name: "Action list with icon tiles + chevron",
  why: "Settings/profile/menu screens need iconed-tile action rows, never plain links.",
  uses: ["lucide-react: ChevronRight, any tile icons"],
  code: `function ActionList({ items }) {
  // items: [{ id, label, sub?, Icon, tone?: 'primary'|'rose'|'emerald'|'amber'|'violet', onClick }]
  const tones = {
    primary: "bg-primary/10 text-primary",
    rose:    "bg-rose-500/10 text-rose-500",
    emerald: "bg-emerald-500/10 text-emerald-500",
    amber:   "bg-amber-500/10 text-amber-500",
    violet:  "bg-violet-500/10 text-violet-500",
  };
  return (
    <ul className="rounded-2xl bg-card border border-border/60 divide-y divide-border/60 overflow-hidden">
      {items.map((it) => (
        <li key={it.id}>
          <button onClick={it.onClick}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition text-left">
            <div className={\`grid h-9 w-9 place-items-center rounded-xl \${tones[it.tone || "primary"]}\`}>
              <it.Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{it.label}</p>
              {it.sub && <p className="text-xs text-muted-foreground">{it.sub}</p>}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </li>
      ))}
    </ul>
  );
}`,
};

export const KOKO_ONBOARDING_STEP: Snippet = {
  name: "Onboarding hero with progress dots + skip",
  why: "First-launch onboarding needs full-bleed illustration, headline, dots indicator, primary CTA + skip.",
  uses: ["framer-motion", "lucide-react: ArrowRight"],
  code: `function OnboardingStep({ step, total, illustration, title, body, onNext, onSkip }) {
  return (
    <motion.section
      initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
      className="flex h-full flex-col p-6">
      <button onClick={onSkip} className="self-end text-sm text-muted-foreground hover:text-foreground">Skip</button>
      <div className="my-6 grid place-items-center">
        <img src={illustration} alt="" className="max-h-72" />
      </div>
      <h1 className="text-3xl font-bold leading-tight tracking-tight">{title}</h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-auto pt-6">
        <div className="flex items-center justify-center gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className={\`h-1.5 rounded-full transition-all
              \${i === step ? "w-6 bg-primary" : "w-1.5 bg-muted"}\`} />
          ))}
        </div>
        <button onClick={onNext}
          className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full
            bg-primary text-primary-foreground py-3.5 text-sm font-semibold hover:scale-[1.01] transition">
          {step === total - 1 ? "Get started" : "Continue"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </motion.section>
  );
}`,
};

export const KOKO_INTEGRATION_CARD: Snippet = {
  name: "Integration / connected-app tile with status",
  why: "Settings → Integrations needs logo + name + connected/disconnected pill + manage button.",
  uses: ["lucide-react: any service icon"],
  code: `function IntegrationCard({ app, connected, onToggle }) {
  return (
    <article className="flex items-center gap-3 rounded-2xl bg-card border border-border/60 p-4">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-muted">
        <app.Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{app.name}</p>
        <p className="text-xs text-muted-foreground line-clamp-1">{app.description}</p>
      </div>
      <button onClick={onToggle}
        className={\`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition
          \${connected
            ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
            : "bg-primary text-primary-foreground hover:scale-105"}\`}>
        {connected ? "Connected" : "Connect"}
      </button>
    </article>
  );
}`,
};

export const KOKO_DOC_CARD: Snippet = {
  name: "Document/file card with type icon + meta",
  why: "Storage/drive apps need file cards with extension-tinted icon + size + modified date.",
  uses: ["lucide-react: FileText, MoreVertical"],
  code: `function DocCard({ doc }) {
  // doc: { id, name, ext, size, modified, color: 'rose'|'sky'|'emerald'|'amber' }
  const tones = {
    rose: "bg-rose-500/10 text-rose-500",
    sky: "bg-sky-500/10 text-sky-500",
    emerald: "bg-emerald-500/10 text-emerald-500",
    amber: "bg-amber-500/10 text-amber-500",
  };
  return (
    <article className="group rounded-2xl bg-card border border-border/60 p-4 hover:shadow-md transition">
      <div className="flex items-start gap-3">
        <div className={\`grid h-12 w-12 place-items-center rounded-xl \${tones[doc.color] || tones.sky}\`}>
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{doc.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground uppercase font-medium">{doc.ext}</p>
        </div>
        <button className="opacity-0 group-hover:opacity-100 transition">
          <MoreVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{doc.size}</span>
        <span>{doc.modified}</span>
      </div>
    </article>
  );
}`,
};

