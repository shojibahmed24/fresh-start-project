import type { Snippet } from "../types.ts";

export const KOKO_GAME_HUD: Snippet = {
  name: "Game HUD bar (lives / coins / level)",
  why: "Casual game apps need a top HUD with hearts, coin count, and level pill.",
  uses: ["lucide-react: Heart, Coins"],
  code: `function GameHUD({ lives, coins, level }) {
  return (
    <header className="flex items-center justify-between gap-3 rounded-2xl
      bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 text-white px-4 py-2.5 shadow-lg">
      <div className="inline-flex items-center gap-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <Heart key={i} className={\`h-5 w-5 \${i < lives ? "fill-rose-400 text-rose-400" : "text-white/30"}\`} />
        ))}
      </div>
      <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1">
        <Coins className="h-4 w-4 text-amber-300" />
        <span className="text-sm font-bold tabular-nums">{coins.toLocaleString()}</span>
      </div>
      <div className="rounded-full bg-white text-indigo-700 px-3 py-1 text-xs font-bold uppercase tracking-wide">
        Lv {level}
      </div>
    </header>
  );
}`,
};

export const KOKO_RIDE_DRIVER_CARD: Snippet = {
  name: "Ride-share driver-arriving card (map snippet feel)",
  why: "Ride/delivery apps need a driver card: avatar, vehicle, plate, ETA, call/message buttons.",
  uses: ["lucide-react: Phone, MessageCircle, Star"],
  code: `function DriverCard({ driver, eta }) {
  return (
    <section className="rounded-3xl bg-card border border-border/60 p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Arriving in</p>
        <p className="text-2xl font-bold tabular-nums">{eta} <span className="text-sm font-medium">min</span></p>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <img src={driver.avatar} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-primary/30" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{driver.name}</p>
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {driver.rating} · {driver.trips} trips
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold">{driver.plate}</p>
          <p className="text-xs text-muted-foreground">{driver.vehicle}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-muted py-2.5 text-sm font-semibold hover:bg-muted/70">
          <MessageCircle className="h-4 w-4" /> Message
        </button>
        <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:scale-[1.02] transition">
          <Phone className="h-4 w-4" /> Call
        </button>
      </div>
    </section>
  );
}`,
};

export const KOKO_QUIZ_CARD: Snippet = {
  name: "Quiz question card with multi-choice + progress",
  why: "Quiz/learning apps need a big question + 4 selectable answer cards + progress bar above.",
  code: `function QuizCard({ question, choices, selected, onSelect, step, total }) {
  return (
    <section className="rounded-3xl bg-card border border-border/60 p-5">
      <div className="mb-4 flex items-center gap-2 text-xs">
        <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 font-bold">
          {step}/{total}
        </span>
        <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all duration-500"
            style={{ width: \`\${(step / total) * 100}%\` }} />
        </div>
      </div>
      <h2 className="text-xl font-bold leading-snug">{question}</h2>
      <ul className="mt-5 space-y-2.5">
        {choices.map((c, i) => {
          const on = selected === c.id;
          const letter = String.fromCharCode(65 + i);
          return (
            <li key={c.id}>
              <button onClick={() => onSelect(c.id)}
                className={\`w-full flex items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition
                  \${on
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/40"}\`}>
                <span className={\`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold
                  \${on ? "bg-primary text-primary-foreground" : "bg-muted"}\`}>
                  {letter}
                </span>
                <span className="text-sm font-medium">{c.text}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}`,
};

