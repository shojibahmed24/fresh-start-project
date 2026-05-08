import type { Template } from "./types";
import { baseRules } from "./baseRules";

export const fitnessTemplate: Template = {
  id: "fitness",
  emoji: "💪",
  name: "Fitness",
  tagline: "Workout & training tracker",
  gradient: "from-orange-500 to-red-500",
  defaultName: "My Fitness",
  defaultDescription: "Mobile fitness / workout tracker app with exercises and history.",
  starterPrompt: `${baseRules("fitness / workout tracker app")}
Screens & routes:
1. /home — today's workout card, weekly streak, quick stats (calories, minutes, workouts), upcoming sessions.
2. /workouts — list grouped by muscle group (Chest, Back, Legs, etc.) with difficulty badges.
3. /workout/:id — header image, exercises list with sets×reps, "Start" → /workout/:id/run with rest timer (working countdown), set completion checkboxes, finish summary.
4. /history — calendar heatmap (intensity by day), list of past workouts.
5. /profile — body stats, goals progress bars, settings.
Seed: 5 muscle groups, 12 workouts each with 5–8 exercises and realistic sets/reps.`,
};
