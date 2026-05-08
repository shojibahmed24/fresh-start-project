import type { Template } from "./types";

export const aiChatTemplate: Template = {
  id: "ai-chat",
  emoji: "🤖",
  name: "AI Chat",
  tagline: "ChatGPT-style assistant UI",
  gradient: "from-emerald-500 to-cyan-500",
  defaultName: "My AI Chat",
  defaultDescription: "ChatGPT-style AI chat assistant with conversation history, streaming UI and prompt library.",
  starterPrompt: `Build a COMPLETE, fully working ChatGPT-style AI chat assistant. Desktop-first with sidebar + main chat panel; collapses to mobile drawer. Requirements:
- react-router-dom routes: /chat (default), /chat/:conversationId, /library, /settings.
- Custom design system in index.css (HSL tokens — dark mode primary, refined neutrals, subtle brand accent). Theme toggle in sidebar footer.
- shadcn Sidebar (collapsible="icon") wrapping a SidebarProvider + main column. Use shadcn ScrollArea for message list.
- framer-motion: message bubble entrance (fade + slide-up), typing indicator (3 bouncing dots), sidebar item hover, modal slides.
- shadcn/ui + lucide-react + tailwind only. Use react-markdown for assistant messages so code blocks + lists render properly. Wrap code in shadcn-styled \`pre\` with copy button.
- Every button MUST work: new chat, select conversation, send message (simulate streaming response by appending tokens via setInterval), regenerate, edit prompt, copy code block, delete conversation, theme toggle, model picker, pin conversation.

📁 **MODULAR FILE RULE (STRICT):**
- No file > 300 lines.
- \`src/components/chat/\`: ChatSidebar, ConversationListItem, NewChatButton, ModelPicker, MessageList, MessageBubble, AssistantMessage, UserMessage, MessageActions, CodeBlock, TypingIndicator, ChatInput, AttachmentRow, PromptSuggestionGrid, EmptyChatState, SettingsDialog, PromptLibraryGrid, PromptCard.
- \`src/pages/Chat.tsx\` < 120 lines (just layout + routing).
- \`src/store/chatStore.ts\` (zustand) — conversations, currentId, addMessage, simulateStream, deleteConversation, pinConversation. Persist to localStorage.
- \`src/data/{prompts,models}.ts\`.

Layout & screens:
1. **ChatSidebar (left, w-72 expanded / w-14 collapsed)** — top: app logo + "New chat" button (+ icon, gradient bg). Search input. Sections: "Pinned" (with pin icon), "Today", "Previous 7 days", "Older". Each item: title (truncate), pin/menu (Rename, Pin, Delete) on hover. Footer: theme toggle, model picker dropdown ("GPT-4o", "Claude Sonnet", "Gemini Flash" — 4 models), settings icon, user avatar with dropdown.
2. **/chat (empty)** — centered EmptyChatState: large gradient logo, greeting "How can I help today?", PromptSuggestionGrid (4 cards: "Brainstorm", "Summarize", "Code review", "Translate" — clicking fills the input). ChatInput sticky at bottom.
3. **/chat/:id** — MessageList scrollable, alternating UserMessage (right-aligned bubble, plain text) and AssistantMessage (left-aligned, markdown rendered, code blocks with syntax-style background + Copy button). Each message has MessageActions on hover (Copy, Regenerate for assistant, Edit for user, Thumbs up/down). TypingIndicator shows while streaming. Auto-scroll to bottom on new message.
4. **ChatInput** — auto-grow textarea, attachment + image icons (open mock attachment row showing pill of file name with × to remove), model badge on left, send button on right (disabled when empty, gradient when ready). Enter sends, Shift+Enter newline. Show character count if > 1000.
5. **/library** — PromptLibraryGrid: 12+ PromptCards (title, description, category tag, "Use prompt" button → starts new chat with that prompt prefilled).
6. **/settings** — Tabs (General / Personalization / Data). General: theme, language, default model. Personalization: custom system prompt textarea, name, role. Data: export conversations JSON, clear all.

Streaming simulation: when user sends, push user msg → push empty assistant msg → setInterval(40ms) appending one word from a realistic seeded response (3-6 sentences, sometimes a code block) → on done, set isStreaming=false. Stop button replaces send while streaming.

Seed: 8 sample conversations across time buckets (each with 6+ realistic exchanges including at least one with a markdown code block), 12 library prompts across 4 categories, 4 models.`,
};
