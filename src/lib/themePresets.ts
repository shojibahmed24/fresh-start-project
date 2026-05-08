// 12 curated theme presets — randomized per scratch build to avoid
// every template-generated app looking identical. Each preset gives the agent
// a specific HSL palette + font pair + radius/shadow personality.

export type ThemePreset = {
  id: string;
  name: string;
  mood: string;
  primary: string; // HSL triplet "240 80% 60%"
  accent: string;
  bg: string;
  surface: string;
  fontDisplay: string; // CSS family stack
  fontBody: string;
  radius: string; // tailwind class
  shadowStyle: string; // short hint
  vibe: string; // one-line for prompt
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "midnight-neon",
    name: "Midnight Neon",
    mood: "premium / energetic",
    primary: "270 95% 65%",
    accent: "190 100% 55%",
    bg: "240 15% 6%",
    surface: "240 12% 10%",
    fontDisplay: "'Space Grotesk', system-ui",
    fontBody: "Inter, system-ui",
    radius: "rounded-2xl",
    shadowStyle: "neon glow shadows (shadow-[0_0_40px_-10px_hsl(var(--primary))])",
    vibe: "Dark canvas, electric violet→cyan gradients, glowing CTAs, glassmorphism panels.",
  },
  {
    id: "warm-editorial",
    name: "Warm Editorial",
    mood: "calm / luxurious",
    primary: "16 80% 55%",
    accent: "30 70% 50%",
    bg: "30 25% 96%",
    surface: "0 0% 100%",
    fontDisplay: "'Fraunces', 'DM Serif Display', Georgia, serif",
    fontBody: "'Inter', system-ui",
    radius: "rounded-xl",
    shadowStyle: "soft long shadows (shadow-lg shadow-orange-900/5)",
    vibe: "Magazine-style serif headlines, terracotta accents, generous whitespace, ivory paper background.",
  },
  {
    id: "fresh-mint",
    name: "Fresh Mint",
    mood: "playful / friendly",
    primary: "160 70% 45%",
    accent: "180 60% 50%",
    bg: "150 30% 97%",
    surface: "0 0% 100%",
    fontDisplay: "'Plus Jakarta Sans', system-ui",
    fontBody: "'Plus Jakarta Sans', system-ui",
    radius: "rounded-3xl",
    shadowStyle: "soft mint-tinted shadows",
    vibe: "Light pastel mint/teal, very rounded shapes, friendly buttons, cheerful empty-state illustrations.",
  },
  {
    id: "brutalist-mono",
    name: "Brutalist Mono",
    mood: "bold / opinionated",
    primary: "0 0% 8%",
    accent: "60 100% 55%",
    bg: "0 0% 100%",
    surface: "0 0% 96%",
    fontDisplay: "'JetBrains Mono', 'IBM Plex Mono', monospace",
    fontBody: "'IBM Plex Sans', system-ui",
    radius: "rounded-none",
    shadowStyle: "hard offset shadows (shadow-[6px_6px_0_0_#000])",
    vibe: "Black borders, hard 6px offset shadows, yellow highlights, mono headings, zero blur, anti-soft.",
  },
  {
    id: "sunset-gradient",
    name: "Sunset Gradient",
    mood: "energetic / vibrant",
    primary: "350 90% 60%",
    accent: "30 100% 60%",
    bg: "260 35% 8%",
    surface: "260 25% 14%",
    fontDisplay: "'Outfit', system-ui",
    fontBody: "'Outfit', system-ui",
    radius: "rounded-2xl",
    shadowStyle: "warm pink/orange glow",
    vibe: "Pink→orange gradient hero, dark plum background, high-energy CTAs, glassy cards.",
  },
  {
    id: "nordic-calm",
    name: "Nordic Calm",
    mood: "minimal / calm",
    primary: "210 40% 30%",
    accent: "180 25% 45%",
    bg: "210 20% 97%",
    surface: "0 0% 100%",
    fontDisplay: "'Inter', system-ui",
    fontBody: "'Inter', system-ui",
    radius: "rounded-lg",
    shadowStyle: "barely-there shadows (shadow-sm)",
    vibe: "Muted slate blues, lots of whitespace, hairline borders, restrained typography, Notion-like.",
  },
  {
    id: "candy-pop",
    name: "Candy Pop",
    mood: "playful / youthful",
    primary: "320 90% 65%",
    accent: "260 90% 70%",
    bg: "320 100% 98%",
    surface: "0 0% 100%",
    fontDisplay: "'Sora', system-ui",
    fontBody: "'Sora', system-ui",
    radius: "rounded-3xl",
    shadowStyle: "colorful bouncy shadows",
    vibe: "Magenta + lavender pastels, very rounded, sticker-like badges, playful micro-bounces.",
  },
  {
    id: "deep-ocean",
    name: "Deep Ocean",
    mood: "premium / trustworthy",
    primary: "215 85% 55%",
    accent: "195 80% 60%",
    bg: "215 30% 8%",
    surface: "215 25% 12%",
    fontDisplay: "'Manrope', system-ui",
    fontBody: "'Manrope', system-ui",
    radius: "rounded-xl",
    shadowStyle: "subtle blue glow on focus",
    vibe: "Navy + ice-blue accents, clean dashboard energy, fintech-grade restraint, crisp data viz.",
  },
  {
    id: "forest-organic",
    name: "Forest Organic",
    mood: "calm / natural",
    primary: "140 50% 30%",
    accent: "80 60% 45%",
    bg: "60 20% 96%",
    surface: "0 0% 100%",
    fontDisplay: "'Fraunces', Georgia, serif",
    fontBody: "'Inter', system-ui",
    radius: "rounded-2xl",
    shadowStyle: "earthy soft shadows",
    vibe: "Forest greens + cream, organic curves, serif headers, wellness/sustainable brand feel.",
  },
  {
    id: "retro-y2k",
    name: "Retro Y2K",
    mood: "playful / nostalgic",
    primary: "280 85% 60%",
    accent: "180 90% 55%",
    bg: "240 60% 96%",
    surface: "0 0% 100%",
    fontDisplay: "'Bricolage Grotesque', system-ui",
    fontBody: "'DM Sans', system-ui",
    radius: "rounded-[28px]",
    shadowStyle: "chunky purple/cyan shadows",
    vibe: "Holographic gradients, blob shapes, chunky sans, lavender-mint base, Web 1.0 sticker energy.",
  },
  {
    id: "monochrome-luxe",
    name: "Monochrome Luxe",
    mood: "luxurious / restrained",
    primary: "0 0% 12%",
    accent: "40 60% 55%",
    bg: "0 0% 99%",
    surface: "0 0% 100%",
    fontDisplay: "'Playfair Display', Georgia, serif",
    fontBody: "'Inter', system-ui",
    radius: "rounded-md",
    shadowStyle: "razor-thin shadows + gold accents",
    vibe: "Black/white base with single gold accent, editorial serif display, luxury fashion vibe.",
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk",
    mood: "bold / futuristic",
    primary: "320 100% 60%",
    accent: "60 100% 55%",
    bg: "240 30% 5%",
    surface: "240 25% 9%",
    fontDisplay: "'JetBrains Mono', monospace",
    fontBody: "'Space Grotesk', system-ui",
    radius: "rounded-sm",
    shadowStyle: "neon pink/yellow shadow with scanline overlays",
    vibe: "Magenta + acid yellow on near-black, mono accents, glitch micro-effects, terminal grid backdrops.",
  },
];

export function pickRandomPreset(seed?: string): ThemePreset {
  if (!seed) {
    return THEME_PRESETS[Math.floor(Math.random() * THEME_PRESETS.length)];
  }
  // Deterministic-ish: hash the seed string so same template id yields same
  // preset on consecutive picks — use a small offset of Date for variety.
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  h = (h + Math.floor(Date.now() / (1000 * 60 * 5))) >>> 0; // rotate every 5 min
  return THEME_PRESETS[h % THEME_PRESETS.length];
}

export function renderPresetForPrompt(p: ThemePreset): string {
  return [
    `## Theme preset (USE THIS — do not invent another palette)`,
    ``,
    `- **Preset:** ${p.name} (${p.mood})`,
    `- **Vibe:** ${p.vibe}`,
    `- **Primary HSL:** ${p.primary}`,
    `- **Accent HSL:** ${p.accent}`,
    `- **Background HSL:** ${p.bg}`,
    `- **Surface/Card HSL:** ${p.surface}`,
    `- **Display font:** ${p.fontDisplay}`,
    `- **Body font:** ${p.fontBody}`,
    `- **Border radius default:** ${p.radius}`,
    `- **Shadow style:** ${p.shadowStyle}`,
    ``,
    `Wire these into \`src/index.css\` (\`:root\` HSL tokens) and \`tailwind.config.ts\`. Import the display + body fonts via Google Fonts in \`index.html\`. Every card/button must use these tokens via semantic classes (\`bg-primary\`, \`text-accent-foreground\`, etc.) — never hardcode hex/colors in components.`,
  ].join("\n");
}
