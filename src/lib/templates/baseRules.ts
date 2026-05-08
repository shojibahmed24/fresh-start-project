// Shared mobile-first scaffold rules used by most mobile-app templates.
// Kept in its own file so each template module stays small and only imports
// what it needs.

export const baseRules = (appName: string) =>
  `Build a COMPLETE, fully working mobile-first ${appName}. Requirements:
- Use react-router-dom with proper routes for every screen and a fixed bottom navigation bar (icons + labels) that highlights the active tab.
- Every button, link, tab, filter chip, and card MUST be wired up — no dead UI. State is shared via React context or zustand so navigation between screens preserves data.
- Use a custom design system in index.css and tailwind.config.ts (HSL semantic tokens, gradient brand color, rounded-2xl cards, soft shadows, smooth framer-motion page transitions).
- Seed all screens with rich, realistic mock data (names, images via picsum / unsplash style placeholders, prices, dates).
- Use lucide-react icons, shadcn/ui components, and tailwind only — no extra UI libs.
- **NEVER let lucide-react icon names collide with your own types, interfaces, variables, or imports.** Common collisions: \`User\`, \`Image\`, \`Mail\`, \`Bell\`, \`Map\`, \`File\`, \`Search\`, \`Link\`, \`Heart\`, \`Menu\`, \`Filter\`, \`Tag\`, \`Calendar\`, \`Clock\`, \`Home\`, \`Settings\`, \`Star\`, \`Check\`, \`Message\`. If you need a type/interface/variable with one of these names, EITHER (a) rename your type (e.g. \`AppUser\`, \`AppMessage\`, \`MediaImage\`) OR (b) alias the icon import: \`import { User as UserIcon } from 'lucide-react'\`. Duplicate identifiers across \`import\` and \`import type\` cause "X is read-only" runtime crashes in the preview sandbox.
- Include empty states, loading skeletons, and toast feedback for actions.

📱 **MOBILE LAYOUT & INTERACTION RULES (STRICT — must hold on EVERY screen, no exceptions):**
- **Scroll containers MUST scroll.** Root layout: \`min-h-[100dvh] flex flex-col\`. Main content: \`flex-1 overflow-y-auto overscroll-contain\`. NEVER nest \`h-screen\` inside another \`h-screen\` — it kills scrolling. Use \`100dvh\` not \`100vh\` (iOS Safari address-bar bug).
- **Bottom nav must NEVER overlap content.** Bottom nav has a fixed height (e.g. 64px). The scrollable content area MUST end with \`pb-[calc(64px+env(safe-area-inset-bottom)+16px)]\` (or a spacer div of equal height). The last list item, heading, or button must be fully visible above the nav — never half-hidden, never visually merged with the nav text.
- **Bottom nav itself respects the home indicator:** \`pb-[env(safe-area-inset-bottom)]\`, has a SOLID-ish background (\`bg-background/90 backdrop-blur-xl border-t border-border\`) so content scrolling underneath is NOT visible through it.
- **Sticky headers** use \`sticky top-0 z-40 backdrop-blur-xl bg-background/85 border-b border-border\` — NEVER fully transparent over scrolling content. Two stacked text lines must never visually merge with content scrolling behind.
- **Every interactive element MUST visibly respond to tap/click:** \`active:scale-[0.97] transition-transform\` on buttons/cards, hover states on desktop, minimum tap target 44×44px. No "dead" cards — if it looks tappable, wire \`onClick\` + \`cursor-pointer\` + active state. Test every button.
- **Color contrast MUST be correct in BOTH light AND dark mode.** Use ONLY semantic tokens (\`text-foreground\`, \`text-muted-foreground\`, \`bg-card\`, \`bg-background\`, \`border-border\`, \`text-primary\`). NEVER hardcode \`text-white\`, \`text-black\`, \`bg-white\`, \`bg-gray-XXX\`, \`text-gray-XXX\` — they break theme switching and produce invisible text.
- **Text legibility:** body min \`text-sm\` (14px), headings clear weight contrast (\`font-bold\` vs \`font-medium\`), line-height ≥ 1.4 (\`leading-relaxed\`). Stacked labels need vertical spacing (\`space-y-1\` minimum) so two lines never merge into an unreadable blob.
- **Z-index hierarchy (strict):** modals/sheets \`z-50\`, sticky header \`z-40\`, bottom nav \`z-40\`, FAB \`z-30\`, content \`z-0\`. Header and nav never visually fight with modals.
- **Self-check before declaring a screen done:** (1) Can the user scroll to the very last item? (2) Is that last item fully visible above the bottom nav (not clipped)? (3) Does every button/card visibly react on tap? (4) Does it look correct in BOTH light and dark theme? (5) Are all colors from semantic tokens? If any answer is no, FIX IT before moving on. The output must feel professional — never amateur.

📁 **MODULAR FILE RULE (STRICT — applies to every file you generate from this template):**
- NO file may exceed **300 lines**. Target ~150-220 lines per file.
- If any component approaches 250 lines, split it into sub-components in a sibling folder (e.g. \`components/cart/CartItem.tsx\`, \`CartSummary.tsx\`, \`CartPromoInput.tsx\`).
- Each screen lives in \`src/pages/\` and ONLY composes components — pages should be thin (under 120 lines).
- Reusable UI primitives (Button variants, Card, Badge) → \`src/components/ui/\`.
- Feature components grouped by domain: \`src/components/<feature>/<Name>.tsx\` (e.g. \`components/product/\`, \`components/cart/\`).
- Hooks in \`src/hooks/\`, types in \`src/types.ts\`, mock data in \`src/data/<feature>.ts\`.
- Before writing any file >250 lines, STOP and split it. Maximum component nesting is fine — prefer many small files over few large ones.

Now build the following structure:`;
