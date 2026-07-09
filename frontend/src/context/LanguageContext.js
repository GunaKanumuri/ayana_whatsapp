/**
 * LanguageContext.js
 *
 * Provides lang / setLang / t() to the entire app.
 *
 * Language priority (highest → lowest):
 *   1. User's saved preference in DB  (user.preferences?.language)
 *   2. Last language stored in localStorage
 *   3. "en" fallback
 *
 * LanguageProvider lives *inside* AuthProvider in App.js, so
 * useAuth() is always available here without circular deps.
 */

import { createContext, useContext, useEffect, useState } from "react";
import { translations } from "@/lib/translations";
import { useAuth } from "@/context/AuthContext";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const { user } = useAuth();

  const [lang, setLangState] = useState(
    () => localStorage.getItem("ayana_lang") || "en"
  );

  // Persist choice to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("ayana_lang", lang);
  }, [lang]);

  // Sync from user DB preference on login / user change
  useEffect(() => {
    if (user && user.preferences?.language) {
      const preferred = user.preferences.language;
      // Only switch if we actually have translations for it
      if (translations[preferred]) {
        setLangState(preferred);
      }
    }
  }, [user]);

  /** Wrapper so external callers don't bypass localStorage persistence */
  const setLang = (code) => {
    if (translations[code]) setLangState(code);
  };

  /**
   * t("some.nested.key") — returns the string for current lang,
   * falls back to English, then the raw key if nothing matches.
   */
  const t = (path) => {
    const parts = path.split(".");
    let node = translations[lang] || translations.en;
    let fallback = translations.en;
    for (const p of parts) {
      node = node?.[p];
      fallback = fallback?.[p];
    }
    return node ?? fallback ?? path;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);
