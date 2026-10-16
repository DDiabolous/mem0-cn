"use client";

import * as React from "react";
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from "next-themes";
import {
  APPEARANCE_RESET_EVENT,
  TEMP_THEME_KEY,
} from "@/lib/appearance-session";

type ThemeChoice = "light" | "dark";
const TemporaryThemeContext = React.createContext<{
  setTemporaryTheme: (theme: ThemeChoice) => void;
  clearTemporaryTheme: () => void;
} | null>(null);

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [temporaryTheme, setOverride] = React.useState<ThemeChoice>();
  React.useEffect(() => {
    try {
      const saved = sessionStorage.getItem(TEMP_THEME_KEY);
      if (saved === "light" || saved === "dark") setOverride(saved);
    } catch {
      /* Storage is optional. */
    }
    const reset = () => setOverride(undefined);
    window.addEventListener(APPEARANCE_RESET_EVENT, reset);
    return () => window.removeEventListener(APPEARANCE_RESET_EVENT, reset);
  }, []);
  const setTemporaryTheme = React.useCallback((theme: ThemeChoice) => {
    setOverride(theme);
    try {
      sessionStorage.setItem(TEMP_THEME_KEY, theme);
    } catch {
      /* Storage is optional. */
    }
  }, []);
  const clearTemporaryTheme = React.useCallback(() => {
    setOverride(undefined);
    try {
      sessionStorage.removeItem(TEMP_THEME_KEY);
    } catch {
      /* Storage is optional. */
    }
  }, []);
  const value = React.useMemo(
    () => ({ setTemporaryTheme, clearTemporaryTheme }),
    [setTemporaryTheme, clearTemporaryTheme],
  );
  return (
    <TemporaryThemeContext.Provider value={value}>
      <NextThemesProvider
        {...props}
        defaultTheme="system"
        enableSystem
        storageKey="mem0.theme.preference"
        forcedTheme={temporaryTheme}
      >
        {children}
      </NextThemesProvider>
    </TemporaryThemeContext.Provider>
  );
}

export function useTemporaryTheme() {
  const context = React.useContext(TemporaryThemeContext);
  if (!context)
    throw new Error("useTemporaryTheme must be used within ThemeProvider");
  return context;
}
