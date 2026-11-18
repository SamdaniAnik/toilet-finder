"use client";

import { useT } from "@/i18n/LanguageProvider";

/** Read-only star display, e.g. ★★★★☆ */
export function Stars({ value, size = "text-base" }: { value: number; size?: string }) {
  const t = useT();
  const full = Math.round(value);
  return (
    <span className={`${size} tracking-tight text-amber-500`} aria-label={t.reviews.outOf5(value)}>
      {"★".repeat(full)}
      <span className="text-zinc-300">{"★".repeat(5 - full)}</span>
    </span>
  );
}

/** Tappable 1–5 star input. */
export function StarInput({
  value,
  onChange,
  label,
  size = "text-3xl",
}: {
  value: number | null;
  onChange: (v: number) => void;
  label: string;
  size?: string;
}) {
  const t = useT();
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={t.reviews.stars(n)}
          onClick={() => onChange(n)}
          className={`${size} leading-none transition active:scale-90 ${value != null && n <= value ? "text-amber-500" : "text-zinc-300"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
