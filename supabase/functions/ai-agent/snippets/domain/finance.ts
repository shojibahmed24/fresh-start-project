import type { Snippet } from "../types.ts";

export const BANKING_BALANCE: Snippet = {
  name: "Glassmorphic balance card with quick actions",
  why: "Hero of any banking/wallet app — big balance, mini chart, send/receive/topup buttons.",
  uses: ["lucide-react: ArrowUpRight, ArrowDownLeft, Plus, Eye"],
  code: `function BalanceCard({ balance, currency = "$", onSend, onReceive, onTopup }) {
  return (
    <div className="relative overflow-hidden rounded-3xl p-5
      bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-700 text-white
      shadow-[0_20px_60px_-20px_rgba(79,70,229,0.6)]">
      <div className="absolute -right-10 -bottom-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] opacity-70">Total balance</p>
        <Eye className="h-4 w-4 opacity-70" />
      </div>
      <p className="mt-2 text-4xl font-bold tabular-nums">
        {currency}{balance.toLocaleString()}
      </p>
      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          { Icon: ArrowUpRight, label: "Send", on: onSend },
          { Icon: ArrowDownLeft, label: "Receive", on: onReceive },
          { Icon: Plus, label: "Top up", on: onTopup },
        ].map((a) => (
          <button key={a.label} onClick={a.on}
            className="flex flex-col items-center gap-1 rounded-xl bg-white/15 backdrop-blur py-2.5
              hover:bg-white/25 transition">
            <a.Icon className="h-4 w-4" />
            <span className="text-[11px] font-medium">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}`,
};

export const BANKING_TX: Snippet = {
  name: "Transaction row with category icon",
  why: "Transactions list with avatar/icon + amount sign + category — never plain rows of strings.",
  uses: ["lucide-react: any category icon e.g. Coffee, ShoppingBag"],
  code: `function TxRow({ tx }) {
  // tx: { id, name, category, amount, when, Icon, incoming? }
  return (
    <li className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-muted/50 transition">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-muted">
        <tx.Icon className="h-4 w-4 text-foreground/70" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{tx.name}</p>
        <p className="text-xs text-muted-foreground">{tx.category} · {tx.when}</p>
      </div>
      <span className={\`text-sm font-bold tabular-nums \${tx.incoming ? "text-emerald-500" : "text-foreground"}\`}>
        {tx.incoming ? "+" : "-"}\${Math.abs(tx.amount).toFixed(2)}
      </span>
    </li>
  );
}`,
};

export const CRYPTO_TICKER: Snippet = {
  name: "Crypto ticker row with sparkline + change %",
  why: "Crypto/finance apps need monospaced numerals, color-coded change, mini sparkline.",
  code: `function CoinRow({ coin }) {
  // coin: { id, symbol, name, price, change, sparkline: number[] }
  const up = coin.change >= 0;
  const max = Math.max(...coin.sparkline), min = Math.min(...coin.sparkline);
  const points = coin.sparkline.map((v, i) =>
    \`\${(i / (coin.sparkline.length - 1)) * 60},\${20 - ((v - min) / (max - min || 1)) * 18}\`
  ).join(" ");
  return (
    <li className="flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-muted/50">
      <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary text-xs font-bold">
        {coin.symbol.slice(0, 3)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{coin.name}</p>
        <p className="text-xs text-muted-foreground">{coin.symbol.toUpperCase()}</p>
      </div>
      <svg width="60" height="20" className={up ? "text-emerald-500" : "text-rose-500"}>
        <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={points} />
      </svg>
      <div className="text-right tabular-nums">
        <p className="text-sm font-bold">\${coin.price.toLocaleString()}</p>
        <p className={\`text-xs font-medium \${up ? "text-emerald-500" : "text-rose-500"}\`}>
          {up ? "+" : ""}{coin.change.toFixed(2)}%
        </p>
      </div>
    </li>
  );
}`,
};

