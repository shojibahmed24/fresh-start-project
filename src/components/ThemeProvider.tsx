import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Theme provider — wraps next-themes with our preferred defaults.
 * - Class strategy (`.light` is opt-in, dark is the default / no class).
 * - System detection on by default.
 * - Persisted to localStorage under `oneclick-theme`.
 */
export const ThemeProvider = (props: ComponentProps<typeof NextThemesProvider>) => (
  <NextThemesProvider
    attribute="class"
    defaultTheme="dark"
    enableSystem={false}
    storageKey="oneclick-theme"
    disableTransitionOnChange={false}
    {...props}
  />
);
