/**
 * Generate a short, presentable project name.
 *
 * - If the user typed something short and clean (≤ 4 words, no filler) → keep it
 *   (just title-case it).
 * - If the user pasted a long prompt like "I want to build a modern emotional
 *   social media app using React" → strip the boilerplate, pick the meaningful
 *   nouns, and pair with a friendly adjective so each project gets a unique,
 *   memorable name. Example → "Emotional Social Hub".
 * - Empty input → randomized fallback like "Twilight Studio".
 */

const STOPWORDS = new Set([
  "i", "want", "to", "build", "create", "make", "develop", "design",
  "a", "an", "the", "for", "with", "using", "based", "on", "of", "and",
  "or", "in", "into", "it", "that", "which", "be", "is", "are", "will",
  "would", "should", "can", "my", "our", "your", "this", "these", "those",
  "app", "application", "website", "site", "web", "platform", "system",
  "project", "tool", "service", "product", "solution", "page", "react",
  "nextjs", "next", "vite", "tailwind", "modern", "simple", "basic",
  "powerful", "awesome", "nice", "beautiful", "ai", "ai-powered",
]);

const ADJECTIVES = [
  "Aurora", "Nimbus", "Echo", "Lumen", "Vivid", "Cobalt", "Solar", "Nova",
  "Polar", "Pulse", "Quartz", "Ember", "Drift", "Halo", "Mosaic", "Stellar",
  "Twilight", "Velvet", "Zen", "Orbit",
];

const SUFFIXES = ["Studio", "Hub", "Lab", "Works", "Forge", "Space", "Loop"];

const titleCase = (s: string) =>
  s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

const tokenize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

const pick = <T>(arr: T[], seed: number) => arr[Math.abs(seed) % arr.length];

const seedFrom = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h || Date.now();
};

export const generateProjectName = (raw: string): string => {
  const input = (raw ?? "").trim();
  const words = tokenize(input);
  const seed = seedFrom(input || String(Date.now()));

  // Empty → friendly random.
  if (words.length === 0) {
    return `${pick(ADJECTIVES, seed)} ${pick(SUFFIXES, seed >> 3)}`;
  }

  // Short & already presentable → just clean it up.
  if (words.length <= 4 && !words.some((w) => STOPWORDS.has(w))) {
    return titleCase(input).slice(0, 40);
  }

  // Long prompt → extract meaningful keywords.
  const keywords = words.filter((w) => !STOPWORDS.has(w) && w.length > 2);
  const top = Array.from(new Set(keywords)).slice(0, 2);

  if (top.length === 0) {
    return `${pick(ADJECTIVES, seed)} ${pick(SUFFIXES, seed >> 3)}`;
  }

  const suffix = pick(SUFFIXES, seed >> 5);
  const name = `${top.map(titleCase).join(" ")} ${suffix}`;
  return name.slice(0, 40);
};
