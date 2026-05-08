import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type TicketStatus = "open" | "pending" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type SenderType = "user" | "admin" | "system";

export type SupportTicket = {
  id: string;
  user_id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  last_message_at: string;
  last_message_preview: string;
  last_sender: SenderType;
  user_unread_count: number;
  admin_unread_count: number;
  message_count: number;
  created_at: string;
};

export type SupportMessage = {
  id: string;
  ticket_id: string;
  sender_id: string | null;
  sender_type: SenderType;
  sender_email: string | null;
  body: string;
  attachment_url: string | null;
  created_at: string;
};

/** Hook for the signed-in user's own tickets list. */
export const useMyTickets = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setTickets([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", user.id)
      .order("last_message_at", { ascending: false });
    setTickets((data ?? []) as SupportTicket[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
    if (!user) return;
    const ch = supabase
      .channel(`my-tickets-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets", filter: `user_id=eq.${user.id}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, refresh]);

  const totalUnread = tickets.reduce((acc, t) => acc + (t.user_unread_count || 0), 0);
  return { tickets, loading, totalUnread, refresh };
};

/** Hook for messages inside a single ticket — works for user & admin. */
export const useTicketMessages = (ticketId: string | null) => {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!ticketId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    setMessages((data ?? []) as SupportMessage[]);
    setLoading(false);
  }, [ticketId]);

  useEffect(() => {
    refresh();
    if (!ticketId) return;
    const ch = supabase
      .channel(`ticket-${ticketId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${ticketId}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [ticketId, refresh]);

  return { messages, loading, refresh };
};

export const supportApi = {
  createTicket: async (subject: string, body: string, priority: TicketPriority = "normal") => {
    const { data, error } = await supabase.rpc("create_support_ticket", {
      _subject: subject,
      _body: body,
      _priority: priority,
    });
    if (error) throw error;
    return data as string;
  },
  postMessage: async (ticketId: string, body: string) => {
    const { error } = await supabase.rpc("post_support_message", {
      _ticket_id: ticketId,
      _body: body,
    });
    if (error) throw error;
  },
  markRead: async (ticketId: string) => {
    await supabase.rpc("mark_ticket_read", { _ticket_id: ticketId });
  },
  setStatus: async (ticketId: string, status: TicketStatus) => {
    const { error } = await supabase.rpc("set_ticket_status", {
      _ticket_id: ticketId,
      _status: status,
    });
    if (error) throw error;
  },
};
