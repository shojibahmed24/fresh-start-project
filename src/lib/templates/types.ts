// Shared type for project starter templates.
export type Template = {
  id: string;
  emoji: string;
  name: string;
  tagline: string;
  gradient: string; // tailwind gradient classes
  defaultName: string;
  defaultDescription: string;
  starterPrompt: string;
};
