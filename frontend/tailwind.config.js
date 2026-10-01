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
          page: "var(--sc-bg-page)",
          panel: "var(--sc-bg-panel)",
          card: "var(--sc-bg-card)",
          raised: "var(--sc-bg-raised)",
          border: "var(--sc-border)",
          "border-strong": "var(--sc-border-strong)",
          text: "var(--sc-text)",
          "text-soft": "var(--sc-text-soft)",
          "text-muted": "var(--sc-text-muted)",
          "text-faint": "var(--sc-text-faint)",
          primary: "var(--sc-primary)",
          "primary-soft": "var(--sc-primary-soft)",
          "on-primary": "var(--sc-on-primary)",
          accent: "var(--sc-accent)",
          "accent-soft": "var(--sc-accent-soft)",
          danger: "var(--sc-danger)",
          "danger-soft": "var(--sc-danger-soft)",
          stamina: "var(--sc-stamina)",
          warn: "var(--sc-warn)",
          "warn-soft": "var(--sc-warn-soft)",
          lore: "var(--sc-lore)",
          "lore-soft": "var(--sc-lore-soft)",
          faction: "var(--sc-faction)",
          focus: "var(--sc-focus)",
          "ent-npc": "var(--sc-ent-npc)",
          "ent-unknown": "var(--sc-ent-unknown)",
          "ent-place": "var(--sc-ent-place)",
          "ent-item": "var(--sc-ent-item)",
          "ent-lore": "var(--sc-ent-lore)",
          "ent-faction": "var(--sc-ent-faction)",
          scrim: "var(--sc-scrim)",
        },
        // Legacy stone utilities follow the nearest Stonecaster neutral roles.
        stone: {
          50: "var(--sc-text)",
          100: "var(--sc-text)",
          200: "var(--sc-text)",
          300: "var(--sc-text-soft)",
          400: "var(--sc-text-muted)",
          500: "var(--sc-text-muted)",
          600: "var(--sc-text-faint)",
          700: "var(--sc-border-strong)",
          800: "var(--sc-bg-raised)",
          900: "var(--sc-bg-card)",
          950: "var(--sc-bg-page)",
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
