import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1.5rem", md: "2rem", lg: "3rem" },
      screens: { sm: "640px", md: "768px", lg: "1024px", xl: "1280px", "2xl": "1440px" },
    },
    screens: {
      xs: "400px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1440px",
    },
    extend: {
      fontFamily: {
        sans: ['Geist', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Geist', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Tech-app tuned scale — body 14px, dense info hierarchy
        'xs': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0' }],
        'sm': ['0.8125rem', { lineHeight: '1.25rem', letterSpacing: '0' }],
        'base': ['0.875rem', { lineHeight: '1.5rem', letterSpacing: '-0.005em' }],
        'md': ['0.9375rem', { lineHeight: '1.5rem', letterSpacing: '-0.005em' }],
        'lg': ['1rem', { lineHeight: '1.5rem', letterSpacing: '-0.01em' }],
        'xl': ['1.125rem', { lineHeight: '1.625rem', letterSpacing: '-0.015em' }],
        '2xl': ['1.375rem', { lineHeight: '1.75rem', letterSpacing: '-0.02em' }],
        '3xl': ['1.75rem', { lineHeight: '2rem', letterSpacing: '-0.025em' }],
        '4xl': ['2.25rem', { lineHeight: '2.375rem', letterSpacing: '-0.03em' }],
        '5xl': ['2.875rem', { lineHeight: '2.875rem', letterSpacing: '-0.035em' }],
        '6xl': ['3.5rem', { lineHeight: '3.5rem', letterSpacing: '-0.04em' }],
        '7xl': ['4.5rem', { lineHeight: '4.5rem', letterSpacing: '-0.04em' }],
      },
      letterSpacing: {
        tightest: '-0.04em',
        tighter: '-0.03em',
        tight: '-0.02em',
        snug: '-0.01em',
      },
      colors: {
        border: "hsl(0 0% 100% / 0.08)",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        // Surface tier system (4-step elevation)
        surface: {
          DEFAULT: "hsl(var(--background))",
          subtle: "hsl(var(--bg-subtle))",
          muted: "hsl(var(--bg-muted))",
          elevated: "hsl(var(--bg-elevated))",
        },
        // Text tier system (3-tier hierarchy)
        text: {
          primary: "hsl(var(--foreground))",
          secondary: "hsl(var(--foreground-muted))",
          tertiary: "hsl(var(--foreground-subtle))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
        },
        violet: {
          DEFAULT: "hsl(var(--accent-violet))",
        },
        cyan: {
          DEFAULT: "hsl(var(--accent-cyan))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      backgroundImage: {
        "gradient-primary": "var(--gradient-primary)",
        "gradient-primary-soft": "var(--gradient-primary-soft)",
        "gradient-hero": "var(--gradient-hero)",
        "gradient-text": "var(--gradient-text)",
        "gradient-accent-text": "var(--gradient-accent-text)",
        "gradient-border": "var(--gradient-border)",
        "gradient-border-accent": "var(--gradient-border-accent)",
        "gradient-mesh": "var(--gradient-mesh)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        "2xl": "var(--shadow-2xl)",
        glow: "var(--shadow-glow)",
        "glow-lg": "var(--shadow-glow-lg)",
        "glow-violet": "var(--shadow-glow-violet)",
        "glow-cyan": "var(--shadow-glow-cyan)",
        elegant: "var(--shadow-elegant)",
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
      },
      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-out": {
          "0%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(10px)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(20px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "slide-in-up": {
          "0%": { transform: "translateY(16px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        ripple: {
          "0%": { transform: "scale(0)", opacity: "0.45" },
          "100%": { transform: "scale(1)", opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "fade-out": "fade-out 0.2s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "slide-in-up": "slide-in-up 0.35s ease-out",
        shimmer: "shimmer 1.6s linear infinite",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        blink: "blink 1s step-end infinite",
        enter: "fade-in 0.3s ease-out, scale-in 0.2s ease-out",
      },
      transitionTimingFunction: {
        "out-smooth": "cubic-bezier(0.4, 0, 0.2, 1)",
        "out-bounce": "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
      },
      transitionDuration: {
        "150": "150ms",
        "180": "180ms",
        "220": "220ms",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
