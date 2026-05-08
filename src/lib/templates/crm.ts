import type { Template } from "./types";

export const crmTemplate: Template = {
  id: "crm",
  emoji: "📇",
  name: "CRM / Contacts",
  tagline: "Table, detail panel & pipeline",
  gradient: "from-fuchsia-600 to-pink-600",
  defaultName: "My CRM",
  defaultDescription: "Sales CRM with contacts table, contact detail panel, pipeline kanban and activities.",
  starterPrompt: `Build a COMPLETE, fully working DESKTOP-FIRST sales CRM (think HubSpot × Pipedrive × Attio). Requirements:
- react-router-dom routes: /contacts, /contact/:id, /pipeline, /deals, /deal/:id, /companies, /activities, /reports, /settings.
- Custom design system in index.css + tailwind.config.ts (HSL tokens, refined SaaS — neutral slate base + single bold accent, light mode primary with dark toggle, dense data UI). shadcn Sidebar (collapsible="icon") + SidebarProvider + SidebarTrigger always visible in TopBar. shadcn Table for all lists with sort, multi-select, search, column show/hide, page size 10/25/50. shadcn Sheet for right detail panel. recharts for dashboard. framer-motion for sheet slide, kanban drag, page transitions. shadcn/ui + lucide-react + tailwind only.
- Every button, sort, filter, search, page size, multi-select bulk action (Email/Tag/Delete), inline edit (click cell → input), sheet open/close, kanban drag-and-drop between stages (use @dnd-kit/core), add note, log activity, theme toggle MUST work.

📁 **MODULAR FILE RULE (STRICT):**
- No file > 300 lines (target 150-220).
- \`src/components/crm/layout/\`: AppSidebar, TopBar, PageHeader, RequireAuth.
- \`src/components/crm/contacts/\`: ContactsTable, ContactRow, ContactsToolbar, BulkActionBar, ContactSheet, ContactSheetHeader, ContactSheetTabs, ContactInfoPanel, ContactActivityFeed, ContactDealsList, ContactNotesList, AddContactDialog, ImportContactsDialog.
- \`src/components/crm/pipeline/\`: PipelineBoard, PipelineColumn, DealCard, DealDragOverlay, AddDealDialog, StageBadge.
- \`src/components/crm/deals/\`: DealsTable, DealDetailHeader, DealStageStepper, DealActivityFeed.
- \`src/components/crm/activities/\`: ActivityRow, ActivityFilters, LogActivityDialog (Call/Email/Meeting/Task tabs), TaskCheckbox.
- \`src/components/crm/reports/\`: KpiCard, RevenueChart, PipelineFunnelChart, ActivityHeatmap, TopRepsLeaderboard.
- \`src/pages/crm/Contacts.tsx\` < 130 lines (just composes).
- \`src/store/crmStore.ts\` (zustand + persist) — contacts, companies, deals, activities, notes, selectedContactId, sheetOpen, addContact, updateContact, deleteContacts, moveDealStage, logActivity, addNote.
- \`src/data/{contacts,companies,deals,activities}.ts\`.

Layout: SidebarProvider wrapping AppSidebar (logo, nav: Contacts / Companies / Pipeline / Deals / Activities / Reports / Settings — collapsible to icons) + main column (TopBar with SidebarTrigger + global search + create dropdown "+ New" → Contact/Company/Deal/Activity + notification bell + theme toggle + avatar menu) + <Outlet />.

Routes & screens:
1. **/contacts** — ContactsToolbar (search + filter chips Owner/Tag/Company/Lifecycle stage + view tabs All/Mine/Recent + sort + columns toggle + Import + "+ New contact"). ContactsTable (checkbox column for multi-select, columns: avatar+name (clickable → opens ContactSheet), email, phone, company (linked), title, lifecycle stage badge, owner avatar, last activity ago, tags chips, actions menu). When rows selected: BulkActionBar slides up from bottom (selected count + Email / Add tag / Change owner / Export / Delete). Pagination footer.
2. **/contact/:id** OR ContactSheet (right slide-in 540px wide): header (large avatar, name, title @ company linked, email/phone copy buttons, social links, owner badge, "..." menu). ContactSheetTabs (Overview / Activity / Deals / Notes / Files / Tasks). Overview = ContactInfoPanel (editable inline fields: name, email, phone, company, title, lifecycle, source, address, custom fields). Activity = ContactActivityFeed (timeline of calls/emails/meetings/notes/stage changes with icons + "Log activity" button → LogActivityDialog with type tabs). Deals = list of associated DealCards with stage + amount + close date + "+ Associate deal". Notes = AddNote inline composer + notes list with author/timestamp.
3. **/pipeline** — PipelineBoard: 5 PipelineColumns (Lead / Qualified / Proposal / Negotiation / Won — last column also Lost variant), each with column header (stage name + count + sum value), column body of DealCards (deal name, company, amount, contact avatar, close date, probability bar, drag handle), "+ Add deal" at bottom. Cards drag between columns via @dnd-kit, updates store + shows toast "Moved to Qualified". Filter bar above (owner, date range, value range).
4. **/deals** — DealsTable (columns: deal name link, company, amount, stage badge, close date, probability %, owner, last activity, actions). Filters + bulk actions same pattern as Contacts.
5. **/deal/:id** — DealDetailHeader (name, value, close date, owner) + DealStageStepper (visual horizontal stage progress with click-to-move) + tabs (Overview / Activities / Contacts / Files / Quotes).
6. **/companies** — same table pattern (logo, name, industry, size, deals count, total value, owner).
7. **/activities** — ActivityFilters (type tabs Call/Email/Meeting/Task/Note + date range + owner) + ActivityRow list with TaskCheckbox for tasks, "Log activity" CTA top right.
8. **/reports** — 4 KpiCards (New deals this month, Closed-won revenue, Pipeline value, Win rate %), RevenueChart (recharts AreaChart last 6 months), PipelineFunnelChart (BarChart by stage), ActivityHeatmap (calendar of activity counts), TopRepsLeaderboard.
9. **/settings** — Tabs (Profile / Team / Pipelines / Custom fields / Integrations / Notifications) with shadcn Forms + toast on save.

Seed: 80 contacts (varied names + emails + phones + companies + tags + lifecycle stages + last-activity dates spread over 90 days), 30 companies (industry/size/deals count), 40 deals across 5 stages with varied amounts $5k-$250k + close dates, 200 activities (mix types) over 90 days, 15 sample notes.`,
};
