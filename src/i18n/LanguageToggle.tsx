"use client";

import { useI18n } from "./LanguageProvider";

/** Switches between English and Bangla. Shows the *other* language's name. */
export default function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, t, setLang } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === "en" ? "bn" : "en")}
      aria-label={t.switchLabel}
      title={t.switchLabel}
      lang={lang === "en" ? "bn" : "en"}
      className={`shrink-0 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-800 ${className}`}
    >
      {t.switchTo}
    </button>
  );
}
