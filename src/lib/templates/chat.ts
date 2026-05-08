import type { Template } from "./types";
import { baseRules } from "./baseRules";

export const chatTemplate: Template = {
  id: "chat",
  emoji: "💬",
  name: "Chat",
  tagline: "WhatsApp-style messaging",
  gradient: "from-emerald-500 to-teal-500",
  defaultName: "My Chat",
  defaultDescription: "Mobile chat / messaging app with conversations and message bubbles.",
  starterPrompt: `${baseRules("WhatsApp-style messaging app")}
Screens & routes:
1. /chats — search, list of conversations (avatar, name, last message preview, time, unread badge), pull-to-refresh.
2. /chat/:id — header with avatar + online status, message bubbles (sent right / received left, timestamps, read ticks), typing indicator, input with emoji/attach buttons, working send (appends to state).
3. /calls — recent calls list with incoming/outgoing/missed icons, video & voice call buttons.
4. /contacts — searchable contact list, tap → start chat.
5. /profile — avatar, name, status, settings (theme, notifications), logout.
Seed: 10 conversations each with 15+ realistic alternating messages, 8 call entries, 20 contacts.`,
};
