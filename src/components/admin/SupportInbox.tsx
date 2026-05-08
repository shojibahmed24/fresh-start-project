import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Inbox, RefreshCw } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SupportChat } from "@/components/SupportChat";
import type { TicketStatus, SupportTicket } from "@/hooks/useSupportTickets";
import { cn } from "@/lib/utils";

type AdminTicket = SupportTicket & {
  user_email: string | null;
  display_name: string | null;
};

const statusColor: Record<TicketStatus, string> = {
  open: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  resolved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  closed: "bg-muted text-muted-foreground border-border",
};

export const SupportInbox = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<TicketStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_tickets", {
      _status: filter === "all" ? null : filter,
      _limit: 200,
    });
    if (!error) setTickets((data ?? []) as AdminTicket[]);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("admin-tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refresh]);

  const filtered = tickets.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.subject.toLowerCase().includes(q) ||
      t.user_email?.toLowerCase().includes(q) ||
      t.display_name?.toLowerCase().includes(q) ||
      t.last_message_preview.toLowerCase().includes(q)
    );
  });

  const selected = tickets.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
            <TabsTrigger value="closed">Closed</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex-1 min-w-[200px]">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject, email, message…"
            leftIcon={<Search size={14} />}
          />
        </div>
        <Button variant="outline" size="sm" onClick={refresh} leftIcon={<RefreshCw size={14} />}>
          Refresh
        </Button>
      </div>

      <div className="grid md:grid-cols-[360px_1fr] gap-3 min-h-[60dvh]">
        {/* List */}
        <div className={cn(
          "rounded-xl border border-[hsl(0_0%_100%/0.06)] bg-[hsl(var(--bg-elevated))] overflow-hidden",
          selectedId && "hidden md:block"
        )}>
          <div className="p-3 border-b border-[hsl(0_0%_100%/0.06)] flex items-center gap-2">
            <Inbox size={14} className="text-muted-foreground" />
            <span className="text-sm font-medium">Tickets</span>
            <span className="ml-auto text-[11px] text-muted-foreground">{filtered.length}</span>
          </div>
          <div className="max-h-[60dvh] overflow-y-auto divide-y divide-[hsl(0_0%_100%/0.05)]">
            {loading && tickets.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No tickets.</div>
            ) : (
              filtered.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={cn(
                    "w-full text-left p-3 hover:bg-[hsl(0_0%_100%/0.04)] transition-colors",
                    selectedId === t.id && "bg-primary/10",
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="font-medium text-sm truncate flex-1">{t.subject}</div>
                    {t.admin_unread_count > 0 && (
                      <span className="shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-red-500 text-white">
                        {t.admin_unread_count}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate mb-1">
                    {t.display_name || t.user_email || t.user_id}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate mb-1.5">
                    {t.last_sender === "admin" ? "↪ " : ""}{t.last_message_preview || "—"}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className={cn("text-[9px] capitalize px-1.5 py-0", statusColor[t.status])}>
                      {t.status}
                    </Badge>
                    {t.priority !== "normal" && (
                      <Badge variant="outline" className="text-[9px] capitalize px-1.5 py-0">
                        {t.priority}
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {new Date(t.last_message_at).toLocaleString()}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Conversation */}
        <div className={cn(
          "rounded-xl border border-[hsl(0_0%_100%/0.06)] bg-[hsl(var(--bg-elevated))] overflow-hidden flex flex-col",
          !selectedId && "hidden md:flex"
        )}>
          {selected && user ? (
            <SupportChat
              ticket={selected}
              viewerType="admin"
              viewerId={user.id}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <div className="flex-1 grid place-items-center text-sm text-muted-foreground p-8 text-center">
              Select a ticket to start replying.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
