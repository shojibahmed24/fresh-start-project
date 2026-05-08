import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users as UsersIcon,
  Clock,
  CheckCircle2,
  XCircle,
  Trophy,
  Wallet,
  Target,
  Activity,
  RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Analytics = {
  revenue: { today: number; week: number; month: number; all_time: number };
  orders: { pending: number; approved: number; rejected: number; avg_order_value: number };
  users: { total: number; paying: number; banned: number; admins: number; conversion_rate: number };
  daily_trend: { day: string; revenue: number; orders: number }[];
  top_packages: { name: string; orders: number; revenue: number; credits_sold: number }[];
  by_payment_method: { method: string; orders: number; revenue: number }[];
};

const METHOD_COLORS: Record<string, string> = {
  bkash: "hsl(330 80% 60%)",
  nagad: "hsl(20 90% 60%)",
  rocket: "hsl(270 70% 65%)",
  crypto: "hsl(40 90% 60%)",
};

const METHOD_LABELS: Record<string, string> = {
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
  crypto: "Crypto",
};

const fmtBDT = (n: number) =>
  "৳" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);

export const AnalyticsDashboard = () => {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartRange, setChartRange] = useState<7 | 14 | 30>(30);

  const refresh = async () => {
    setLoading(true);
    const { data: d, error } = await supabase.rpc("admin_get_analytics");
    if (error) toast.error(error.message);
    else setData(d as unknown as Analytics);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const trendSlice = useMemo(() => {
    if (!data) return [];
    return data.daily_trend.slice(-chartRange).map((d) => ({
      ...d,
      label: new Date(d.day).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }));
  }, [data, chartRange]);

  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-2xl bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.06)] animate-pulse"
          />
        ))}
      </div>
    );
  }

  const totalOrders = data.orders.pending + data.orders.approved + data.orders.rejected;
  const bestPkg = data.top_packages[0];

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Analytics</h2>
          <p className="text-xs text-muted-foreground">Live metrics theke updated</p>
        </div>
        <Button variant="ghost" size="sm" onClick={refresh} leftIcon={<RefreshCw size={14} />}>
          Refresh
        </Button>
      </div>

      {/* Revenue cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<DollarSign size={16} />}
          label="Today"
          value={fmtBDT(data.revenue.today)}
          gradient="from-emerald-500/20 via-emerald-500/5"
          accent="text-emerald-300"
        />
        <KpiCard
          icon={<TrendingUp size={16} />}
          label="This week"
          value={fmtBDT(data.revenue.week)}
          gradient="from-sky-500/20 via-sky-500/5"
          accent="text-sky-300"
        />
        <KpiCard
          icon={<Activity size={16} />}
          label="This month"
          value={fmtBDT(data.revenue.month)}
          gradient="from-violet-500/20 via-violet-500/5"
          accent="text-violet-300"
        />
        <KpiCard
          icon={<Wallet size={16} />}
          label="All-time"
          value={fmtBDT(data.revenue.all_time)}
          gradient="from-amber-500/20 via-amber-500/5"
          accent="text-amber-300"
        />
      </div>

      {/* Order breakdown + AOV + Conversion */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat
          icon={<Clock size={14} />}
          label="Pending"
          value={data.orders.pending}
          tone="amber"
        />
        <MiniStat
          icon={<CheckCircle2 size={14} />}
          label="Approved"
          value={data.orders.approved}
          tone="emerald"
        />
        <MiniStat
          icon={<XCircle size={14} />}
          label="Rejected"
          value={data.orders.rejected}
          tone="red"
        />
        <MiniStat
          icon={<ShoppingCart size={14} />}
          label="Avg order"
          value={fmtBDT(data.orders.avg_order_value)}
          tone="primary"
        />
      </div>

      {/* Revenue trend chart */}
      <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-[hsl(var(--bg-elevated))] to-background border border-[hsl(0_0%_100%/0.08)]">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <TrendingUp size={15} className="text-primary" /> Revenue trend
            </h3>
            <p className="text-xs text-muted-foreground">Last {chartRange} days</p>
          </div>
          <div className="inline-flex rounded-lg p-0.5 bg-background/60 border border-[hsl(0_0%_100%/0.08)]">
            {([7, 14, 30] as const).map((d) => (
              <button
                key={d}
                onClick={() => setChartRange(d)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  chartRange === d
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        <div className="h-56 sm:h-72 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendSlice} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "hsl(0 0% 70%)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval={chartRange === 30 ? 4 : chartRange === 14 ? 1 : 0}
              />
              <YAxis
                tick={{ fill: "hsl(0 0% 70%)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
                width={40}
              />
              <RTooltip
                contentStyle={{
                  background: "hsl(var(--bg-elevated))",
                  border: "1px solid hsl(0 0% 100% / 0.1)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "hsl(0 0% 90%)" }}
                formatter={(v: number, name) =>
                  name === "revenue" ? [fmtBDT(v), "Revenue"] : [v, "Orders"]
                }
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#revFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two-column: Top packages + Payment methods */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Best-selling packages */}
        <div className="rounded-2xl p-5 bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.08)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Trophy size={15} className="text-amber-300" /> Best-selling packages
            </h3>
            {bestPkg && (
              <Badge variant="outline" className="bg-amber-500/15 text-amber-300 border-amber-500/30">
                #{1} {bestPkg.name}
              </Badge>
            )}
          </div>
          {data.top_packages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No sales yet</p>
          ) : (
            <div className="space-y-3">
              {data.top_packages.map((p, i) => {
                const max = data.top_packages[0].revenue || 1;
                const pct = (p.revenue / max) * 100;
                return (
                  <div key={p.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-5 h-5 rounded-full grid place-items-center text-[10px] font-bold ${
                            i === 0
                              ? "bg-amber-500/20 text-amber-300"
                              : i === 1
                                ? "bg-zinc-400/20 text-zinc-300"
                                : i === 2
                                  ? "bg-orange-700/20 text-orange-300"
                                  : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <span className="font-medium truncate">{p.name}</span>
                      </div>
                      <span className="font-semibold shrink-0">{fmtBDT(p.revenue)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-background/60 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-primary/40 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[11px] text-muted-foreground">
                      <span>{p.orders} orders</span>
                      <span>{p.credits_sold.toLocaleString()} credits</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Payment methods */}
        <div className="rounded-2xl p-5 bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.08)]">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <Wallet size={15} className="text-primary" /> Revenue by payment method
          </h3>
          {data.by_payment_method.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No payments yet</p>
          ) : (
            <>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.by_payment_method} margin={{ top: 5, right: 0, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" vertical={false} />
                    <XAxis
                      dataKey="method"
                      tick={{ fill: "hsl(0 0% 70%)", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => METHOD_LABELS[v] ?? v}
                    />
                    <YAxis
                      tick={{ fill: "hsl(0 0% 70%)", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
                    />
                    <RTooltip
                      contentStyle={{
                        background: "hsl(var(--bg-elevated))",
                        border: "1px solid hsl(0 0% 100% / 0.1)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: number) => fmtBDT(v)}
                    />
                    <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                      {data.by_payment_method.map((m) => (
                        <Cell key={m.method} fill={METHOD_COLORS[m.method] ?? "hsl(var(--primary))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {data.by_payment_method.map((m) => (
                  <div
                    key={m.method}
                    className="flex items-center justify-between p-2 rounded-lg bg-background/40"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: METHOD_COLORS[m.method] }}
                      />
                      <span className="text-sm font-medium">{METHOD_LABELS[m.method] ?? m.method}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{fmtBDT(m.revenue)}</div>
                      <div className="text-[10px] text-muted-foreground">{m.orders} orders</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* User funnel */}
      <div className="rounded-2xl p-5 bg-gradient-to-br from-primary/5 to-transparent border border-[hsl(0_0%_100%/0.08)]">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <Target size={15} className="text-primary" /> Conversion funnel
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <FunnelStep
            icon={<UsersIcon size={14} />}
            label="Total signups"
            value={data.users.total}
            sub={`${data.users.banned} banned · ${data.users.admins} admins`}
          />
          <FunnelStep
            icon={<ShoppingCart size={14} />}
            label="Paying users"
            value={data.users.paying}
            sub={`${totalOrders} total orders`}
          />
          <FunnelStep
            icon={<Target size={14} />}
            label="Conversion"
            value={`${data.users.conversion_rate}%`}
            sub="visitor → buyer"
            highlight
          />
        </div>
      </div>
    </div>
  );
};

const KpiCard = ({
  icon,
  label,
  value,
  gradient,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  gradient: string;
  accent: string;
}) => (
  <div
    className={`relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br ${gradient} to-transparent border border-[hsl(0_0%_100%/0.08)]`}
  >
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className={`${accent}`}>{icon}</span>
    </div>
    <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
  </div>
);

const MiniStat = ({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone: "amber" | "emerald" | "red" | "primary";
}) => {
  const tones = {
    amber: "text-amber-300 bg-amber-500/10",
    emerald: "text-emerald-300 bg-emerald-500/10",
    red: "text-red-300 bg-red-500/10",
    primary: "text-primary bg-primary/10",
  };
  return (
    <div className="rounded-xl p-3 bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.08)]">
      <div className="flex items-center gap-2">
        <span className={`w-7 h-7 rounded-lg grid place-items-center ${tones[tone]}`}>{icon}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="mt-1.5 text-xl font-bold">{value}</div>
    </div>
  );
};

const FunnelStep = ({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  highlight?: boolean;
}) => (
  <div
    className={`rounded-xl p-3 sm:p-4 border ${
      highlight
        ? "bg-primary/10 border-primary/30"
        : "bg-[hsl(var(--bg-elevated))] border-[hsl(0_0%_100%/0.08)]"
    }`}
  >
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
    <div className={`mt-1.5 text-xl sm:text-2xl font-bold ${highlight ? "text-primary" : ""}`}>
      {value}
    </div>
    {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
  </div>
);
