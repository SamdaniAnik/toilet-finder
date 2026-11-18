"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { MESSAGES, type Lang, type Messages } from "./messages";

const STORAGE_KEY = "tf.lang";
const CHANGE_EVENT = "tf:lang";

function readLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "bn") return saved;
  } catch {
    // storage blocked
  }
  // First visit: follow the phone's language.
  return navigator.languages?.some((l) => l.toLowerCase().startsWith("bn")) ? "bn" : "en";
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

type LanguageContext = { lang: Lang; t: Messages; setLang: (l: Lang) => void };
const Ctx = createContext<LanguageContext | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Server render uses English; the browser switches to the saved/phone language on hydration.
  const lang = useSyncExternalStore(subscribe, readLang, () => "en" as Lang);

  const setLang = useCallback((l: Lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // storage blocked: the choice lasts for this page only
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => ({ lang, t: MESSAGES[lang], setLang }), [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Current language, its messages, and a setter. */
export function useI18n(): LanguageContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used inside <LanguageProvider>");
  return ctx;
}

/** Shortcut for the current messages. */
export function useT(): Messages {
  return useI18n().t;
}
