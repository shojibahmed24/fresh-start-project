import type { Template } from "./types";
import { baseRules } from "./baseRules";

export const todoTemplate: Template = {
  id: "todo",
  emoji: "📋",
  name: "Todo / Notes",
  tagline: "Task & productivity tracker",
  gradient: "from-indigo-500 to-blue-500",
  defaultName: "My Tasks",
  defaultDescription: "Mobile todo / notes / productivity app with categories.",
  starterPrompt: `${baseRules("todo / productivity app")}
Screens & routes:
1. /today — greeting, progress ring (% done), today's tasks grouped by time of day, swipe to complete.
2. /tasks — all tasks with filter chips (All, Today, Upcoming, Done), search, sort.
3. /add — task form (title, notes, category, due date picker, priority, reminder), save → returns to list.
4. /categories — colored category cards with count, tap → filtered list, add new category.
5. /profile — streak counter, weekly chart of completed tasks, settings.
Seed: 6 categories with distinct HSL colors, 24+ tasks across categories with mixed due dates and priorities.
Tasks must persist in localStorage so reload keeps state.`,
};
