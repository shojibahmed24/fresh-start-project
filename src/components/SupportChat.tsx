import { useEffect, useRef, useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTicketMessages, supportApi, type SupportTicket, type TicketStatus } from "@/hooks/useSupportTickets";
import { toast } from "sonner";

const statusColor: Record<TicketStatus, string> = {
  open: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  resolved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  closed: "bg-muted text-muted-foreground border-border",
};

type Props = {
  ticket: SupportTicket & { user_email?: string | null; display_name?: string | null };
  viewerType: "user" | "admin";
  viewerId: string;
  onClose?: () => void;
};

/** Conversation thread used by both user and admin. */
export const SupportChat = ({ ticket, viewerType, viewerId, onClose }: Props) => {
  const { messages, loading } = useTicketMessages(ticket.id);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // mark read on open & when new messages arrive
  useEffect(() => {
    supportApi.markRead(ticket.id).catch(() => {});
  }, [ticket.id, messages.length]);

  // scroll to bottom on new message
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const isClosed = ticket.status === "closed";
  const canSend = !isClosed && body.trim().length > 0 && !sending;

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      await supportApi.postMessage(ticket.id, body.trim());
      setBody("");
    } catch (e: any) {
      toast.error(e.message || "Could not send");
    } finally {
      setSending(false);
    }
  };

  const setStatus = async (s: TicketStatus) => {
    try {
      await supportApi.setStatus(ticket.id, s);
      toast.success(`Marked ${s}`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4 border-b border-[hsl(0_0%_100%/0.08)]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm truncate">{ticket.subject}</h3>
            <Badge variant="outline" className={cn("text-[10px] capitalize", statusColor[ticket.status])}>
              {ticket.status}
            </Badge>
            {ticket.priority !== "normal" && (
              <Badge variant="outline" className="text-[10px] capitalize">{ticket.priority}</Badge>
            )}
          </div>
          {viewerType === "admin" && (
            <div className="text-[11px] text-muted-foreground mt-1 truncate">
              {ticket.display_name || ticket.user_email || ticket.user_id}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!isClosed && (
            <>
              {viewerType === "admin" && ticket.status !== "resolved" && (
                <Button size="sm" variant="outline" onClick={() => setStatus("resolved")}>
                  Resolve
                </Button>
              )}
              {viewerType === "admin" && (
                <Button size="sm" variant="ghost" onClick={() => setStatus("closed")}>
                  Close
                </Button>
              )}
              {viewerType === "user" && ticket.status !== "resolved" && (
                <Button size="sm" variant="outline" onClick={() => setStatus("resolved")}>
                  Mark resolved
                </Button>
              )}
            </>
          )}
          {isClosed && viewerType === "admin" && (
            <Button size="sm" variant="outline" onClick={() => setStatus("open")}>Reopen</Button>
          )}
          {onClose && (
            <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close">
              <X size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground text-sm gap-2">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-10">No messages yet.</div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === viewerId;
            const isAdminMsg = m.sender_type === "admin";
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words",
                    mine
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : isAdminMsg
                      ? "bg-[hsl(var(--bg-elevated))] border border-primary/30 rounded-bl-sm"
                      : "bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.08)] rounded-bl-sm",
                  )}
                >
                  {!mine && (
                    <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70 mb-0.5">
                      {isAdminMsg ? "Support" : m.sender_email?.split("@")[0] || "User"}
                    </div>
                  )}
                  <div>{m.body}</div>
                  <div className={cn("text-[10px] mt-1 opacity-60", mine ? "text-right" : "")}>
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-[hsl(0_0%_100%/0.08)] p-3">
        {isClosed ? (
          <div className="text-center text-xs text-muted-foreground py-2">
            This ticket is closed.
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={viewerType === "admin" ? "Reply to user…" : "Type your message…"}
              rows={2}
              maxLength={4000}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  send();
                }
              }}
              className="resize-none"
            />
            <Button onClick={send} disabled={!canSend} loading={sending} size="icon" aria-label="Send">
              <Send size={14} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
