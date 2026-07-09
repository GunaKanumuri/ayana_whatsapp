import { createContext, useContext, useEffect, useState } from "react";
import { translations } from "@/lib/translations";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("ayana_lang") || "en");
  useEffect(() => { localStorage.setItem("ayana_lang", lang); }, [lang]);
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
