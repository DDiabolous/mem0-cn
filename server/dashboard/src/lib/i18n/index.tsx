"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  LOCALE_STORAGE_KEY,
  resolveLocale,
  translate,
  type Locale,
} from "./messages";
import {
  APPEARANCE_RESET_EVENT,
  TEMP_LOCALE_KEY,
} from "@/lib/appearance-session";

export type LanguagePreference = Locale | "system";
type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  preference: LanguagePreference;
  setPreference: (preference: LanguagePreference) => void;
  t: (message: string, values?: Record<string, string | number>) => string;
};
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [preference, updatePreference] = useState<LanguagePreference>("system");
  const [temporaryLocale, updateTemporary] = useState<Locale | null>(null);
  const [browserLanguage, setBrowserLanguage] = useState("en");
  useEffect(() => {
    const readPreference = () => {
      let saved = null;
      try {
        saved = localStorage.getItem(LOCALE_STORAGE_KEY);
      } catch {
        /* Storage is optional. */
      }
      updatePreference(saved === "en" || saved === "zh-CN" ? saved : "system");
    };
    readPreference();
    try {
      const saved = sessionStorage.getItem(TEMP_LOCALE_KEY);
      if (saved === "en" || saved === "zh-CN") updateTemporary(saved);
    } catch {
      /* Storage is optional. */
    }
    const languageChanged = () => setBrowserLanguage(navigator.language);
    languageChanged();
    const sync = (event: StorageEvent) => {
      if (event.key === LOCALE_STORAGE_KEY || event.key === null)
        readPreference();
    };
    const reset = () => {
      updateTemporary(null);
      readPreference();
    };
    window.addEventListener("storage", sync);
    window.addEventListener("languagechange", languageChanged);
    window.addEventListener(APPEARANCE_RESET_EVENT, reset);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("languagechange", languageChanged);
      window.removeEventListener(APPEARANCE_RESET_EVENT, reset);
    };
  }, []);
  const locale = temporaryLocale || resolveLocale(preference, browserLanguage);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const setLocale = useCallback((next: Locale) => {
    updateTemporary(next);
    try {
      sessionStorage.setItem(TEMP_LOCALE_KEY, next);
    } catch {
      /* Storage is optional. */
    }
  }, []);
  const setPreference = useCallback((next: LanguagePreference) => {
    updatePreference(next);
    updateTemporary(null);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
      sessionStorage.removeItem(TEMP_LOCALE_KEY);
    } catch {
      /* Preference changes still work in memory. */
    }
  }, []);
  const t = useCallback(
    (message: string, values?: Record<string, string | number>) =>
      translate(locale, message, values),
    [locale],
  );
  const value = useMemo(
    () => ({ locale, setLocale, preference, setPreference, t }),
    [locale, setLocale, preference, setPreference, t],
  );
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context)
    throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
