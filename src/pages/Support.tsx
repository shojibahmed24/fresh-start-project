import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, MessageSquarePlus, Inbox, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useMyTickets, supportApi, type SupportTicket, type TicketPriority, type TicketStatus } from "@/hooks/useSupportTickets";
import { SupportChat } from "@/components/SupportChat";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const statusColor: Record<TicketStatus, string> = {
  open: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  resolved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  closed: "bg-muted text-muted-foreground border-border",
};

const Support = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { tickets, loading } = useMyTickets();
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth", { replace: true });
  }, [authLoading, user, navigate]);

  // keep selected in sync when list updates
  useEffect(() => {
    if (selected) {
      const fresh = tickets.find((t) => t.id === selected.id);
      if (fresh && fresh.last_message_at !== selected.last_message_at) setSelected(fresh);
    }
  }, [tickets, selected]);

  const submit = async () => {
    if (subject.trim().length < 2) return toast.error("Subject too short");
    if (body.trim().length < 1) return toast.error("Write a message");
    setSubmitting(true);
    try {
      const id = await supportApi.createTicket(subject.trim(), body.trim(), priority);
      toast.success("Ticket created");
      setCreating(false);
      setSubject("");
      setBody("");
      setPriority("normal");
      // pick the new ticket once it shows up in the list
      setTimeout(() => {
        const t = tickets.find((x) => x.id === id);
        if (t) setSelected(t);
        else setSelected({
          id, user_id: user!.id, subject: subject.trim(), status: "open", priority,
          last_message_at: new Date().toISOString(), last_message_preview: body.trim(),
          last_sender: "user", user_unread_count: 0, admin_unread_count: 1, message_count: 1,
          created_at: new Date().toISOString(),
        });
      }, 200);
    } catch (e: any) {
      toast.error(e.message || "Failed to create ticket");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-[100dvh] grid place-items-center text-muted-foreground">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-background/70 border-b border-[hsl(0_0%_100%/0.06)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link to="/dashboard" className="p-1.5 rounded-md hover:bg-[hsl(0_0%_100%/0.06)]">
              <ArrowLeft size={16} />
            </Link>
            <h1 className="font-semibold tracking-tight">Support</h1>
          </div>
          <Button size="sm" onClick={() => setCreating(true)} leftIcon={<MessageSquarePlus size={14} />}>
            New ticket
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-6 py-6">
        <div className="grid md:grid-cols-[320px_1fr] gap-4 min-h-[calc(100dvh-8rem)]">
          {/* List */}
          <aside className={cn(
            "rounded-xl border border-[hsl(0_0%_100%/0.06)] bg-[hsl(var(--bg-elevated))] overflow-hidden",
            selected && "hidden md:block"
          )}>
            <div className="p-3 border-b border-[hsl(0_0%_100%/0.06)] flex items-center gap-2">
              <Inbox size={14} className="text-muted-foreground" />
              <span className="text-sm font-medium">My tickets</span>
              <span className="ml-auto text-[11px] text-muted-foreground">{tickets.length}</span>
            </div>
            <div className="max-h-[calc(100dvh-13rem)] overflow-y-auto divide-y divide-[hsl(0_0%_100%/0.05)]">
              {loading && tickets.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
              ) : tickets.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No tickets yet. Open one to get help.
                </div>
              ) : (
                tickets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className={cn(
                      "w-full text-left p-3 hover:bg-[hsl(0_0%_100%/0.04)] transition-colors",
                      selected?.id === t.id && "bg-primary/10",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="font-medium text-sm truncate flex-1">{t.subject}</div>
                      {t.user_unread_count > 0 && (
                        <span className="shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-primary text-primary-foreground">
                          {t.user_unread_count}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate mb-1.5">
                      {t.last_message_preview || "—"}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className={cn("text-[9px] capitalize px-1.5 py-0", statusColor[t.status])}>
                        {t.status}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(t.last_message_at).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          {/* Conversation */}
          <section className={cn(
            "rounded-xl border border-[hsl(0_0%_100%/0.06)] bg-[hsl(var(--bg-elevated))] overflow-hidden flex flex-col min-h-[60dvh]",
            !selected && "hidden md:flex"
          )}>
            {selected ? (
              <SupportChat
                ticket={selected}
                viewerType="user"
                viewerId={user.id}
                onClose={() => setSelected(null)}
              />
            ) : (
              <div className="flex-1 grid place-items-center text-sm text-muted-foreground p-8 text-center">
                Select a ticket to view the conversation, or open a new one.
              </div>
            )}
          </section>
        </div>
      </main>

      <Dialog open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New support ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary"
                maxLength={200}
              />
            </div>
            <div>
              <Label className="text-xs">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Message</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="Describe your issue in detail…"
                maxLength={4000}
              />
            </div>
            <Button className="w-full" onClick={submit} loading={submitting} disabled={submitting}>
              Send
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Support;
