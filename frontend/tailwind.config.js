// Preserve Tailwind opacity modifiers while reading the canonical colour tokens.
const tokenColor = (name) =>
  `color-mix(in srgb, var(${name}) calc(<alpha-value> * 100%), transparent)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
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
        sc: {
          page: tokenColor("--sc-bg-page"),
          panel: tokenColor("--sc-bg-panel"),
          card: tokenColor("--sc-bg-card"),
          raised: tokenColor("--sc-bg-raised"),
          border: tokenColor("--sc-border"),
          "border-strong": tokenColor("--sc-border-strong"),
          text: tokenColor("--sc-text"),
          "text-soft": tokenColor("--sc-text-soft"),
          "text-muted": tokenColor("--sc-text-muted"),
          "text-faint": tokenColor("--sc-text-faint"),
          primary: tokenColor("--sc-primary"),
          "primary-soft": tokenColor("--sc-primary-soft"),
          "on-primary": tokenColor("--sc-on-primary"),
          accent: tokenColor("--sc-accent"),
          "accent-soft": tokenColor("--sc-accent-soft"),
          danger: tokenColor("--sc-danger"),
          "danger-soft": tokenColor("--sc-danger-soft"),
          stamina: tokenColor("--sc-stamina"),
          warn: tokenColor("--sc-warn"),
          "warn-soft": tokenColor("--sc-warn-soft"),
          lore: tokenColor("--sc-lore"),
          "lore-soft": tokenColor("--sc-lore-soft"),
          faction: tokenColor("--sc-faction"),
          focus: tokenColor("--sc-focus"),
          "ent-npc": tokenColor("--sc-ent-npc"),
          "ent-unknown": tokenColor("--sc-ent-unknown"),
          "ent-place": tokenColor("--sc-ent-place"),
          "ent-item": tokenColor("--sc-ent-item"),
          "ent-lore": tokenColor("--sc-ent-lore"),
          "ent-faction": tokenColor("--sc-ent-faction"),
          scrim: tokenColor("--sc-scrim"),
        },
        // Legacy stone utilities follow the nearest Stonecaster neutral roles.
        stone: {
          50: tokenColor("--sc-text"),
          100: tokenColor("--sc-text"),
          200: tokenColor("--sc-text"),
          300: tokenColor("--sc-text-soft"),
          400: tokenColor("--sc-text-muted"),
          500: tokenColor("--sc-text-muted"),
          600: tokenColor("--sc-text-faint"),
          700: tokenColor("--sc-border-strong"),
          800: tokenColor("--sc-bg-raised"),
          900: tokenColor("--sc-bg-card"),
          950: tokenColor("--sc-bg-page"),
        },
      },
      fontFamily: {
        display: ["var(--sc-font-display)"],
        prose: ["var(--sc-font-prose)"],
        ui: ["var(--sc-font-ui)"],
        mono: ["var(--sc-font-mono)"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "sc-control": "var(--sc-radius-control)",
        "sc-card": "var(--sc-radius-card)",
        "sc-chip": "var(--sc-radius-chip)",
        "sc-sheet": "var(--sc-radius-sheet)",
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
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-out": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "slide-in-from-top": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "slide-in-from-bottom": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "slide-in-from-left": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "slide-in-from-right": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "fade-out": "fade-out 0.2s ease-out",
        "slide-in-from-top": "slide-in-from-top 0.3s ease-out",
        "slide-in-from-bottom": "slide-in-from-bottom 0.3s ease-out",
        "slide-in-from-left": "slide-in-from-left 0.3s ease-out",
        "slide-in-from-right": "slide-in-from-right 0.3s ease-out",
      },
      screens: {
        // Mobile-first responsive breakpoints
        xs: "375px", // iPhone X baseline
        sm: "640px", // Small tablets
        md: "768px", // Tablets
        lg: "1024px", // Laptops
        xl: "1280px", // Desktops
        "2xl": "1536px", // Large desktops
      },
      spacing: {
        18: "4.5rem",
        88: "22rem",
        128: "32rem",
        "sc-1": "var(--sc-space-1)",
        "sc-2": "var(--sc-space-2)",
        "sc-3": "var(--sc-space-3)",
        "sc-4": "var(--sc-space-4)",
        "sc-5": "var(--sc-space-5)",
        "sc-6": "var(--sc-space-6)",
        "sc-7": "var(--sc-space-7)",
        "sc-tap": "var(--sc-tap)",
        "sc-header": "var(--sc-header-h)",
        "sc-rail-left": "var(--sc-rail-left)",
        "sc-rail-right": "var(--sc-rail-right)",
        "sc-rail-slim": "var(--sc-rail-slim)",
        "sc-measure": "var(--sc-measure)",
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: "none",
            color: "hsl(var(--foreground))",
            a: {
              color: "hsl(var(--primary))",
              textDecoration: "underline",
              fontWeight: "500",
            },
            strong: {
              color: "hsl(var(--foreground))",
              fontWeight: "600",
            },
            "h1, h2, h3, h4": {
              color: "hsl(var(--foreground))",
            },
            code: {
              color: "hsl(var(--foreground))",
              backgroundColor: "hsl(var(--muted))",
              padding: "0.25rem 0.375rem",
              borderRadius: "0.25rem",
              fontSize: "0.875em",
            },
            "code::before": {
              content: '""',
            },
            "code::after": {
              content: '""',
            },
          },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
};
