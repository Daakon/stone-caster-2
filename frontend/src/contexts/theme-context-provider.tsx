import React, { useEffect, useState } from "react";
import { ThemeProviderContext } from "./theme-context";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  forcedTheme?: Theme;
  storageKey?: string;
};

export function ThemeProvider({
  children,
  defaultTheme = "system",
  forcedTheme,
  storageKey = "stonecaster-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme,
  );
  const activeTheme = forcedTheme ?? theme;

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    if (activeTheme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(activeTheme);
  }, [activeTheme]);

  const value = {
    theme: activeTheme,
    setTheme: (nextTheme: Theme) => {
      if (forcedTheme) return;
      localStorage.setItem(storageKey, nextTheme);
      setTheme(nextTheme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}
