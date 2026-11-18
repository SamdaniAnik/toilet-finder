"use client";

import { useT } from "@/i18n/LanguageProvider";
import { DEFAULT_FILTERS, activeFilterCount, type Filters, type GenderFilter } from "@/lib/filters";

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium shadow-sm transition ${on ? "border-blue-600 bg-blue-600 text-white" : "border-zinc-200 bg-white text-zinc-800"}`}
    >
      {children}
    </button>
  );
}

const GENDER_CHIPS: { value: Exclude<GenderFilter, "any">; key: "women" | "men" | "accessible" }[] = [
  { value: "female", key: "women" },
  { value: "male", key: "men" },
  { value: "accessible", key: "accessible" },
];

/** Horizontally scrolling filter chips. */
export default function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const t = useT();
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  return (
    <div className="flex w-full max-w-xl gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
      <Chip on={filters.openNow} onClick={() => set({ openNow: !filters.openNow })}>{t.filters.openNow}</Chip>
      <Chip on={filters.freeOnly} onClick={() => set({ freeOnly: !filters.freeOnly })}>{t.filters.free}</Chip>
      {GENDER_CHIPS.map((g) => (
        <Chip key={g.value} on={filters.gender === g.value} onClick={() => set({ gender: filters.gender === g.value ? "any" : g.value })}>
          {t.filters[g.key]}
        </Chip>
      ))}
      <Chip on={filters.minRating === 4} onClick={() => set({ minRating: filters.minRating === 4 ? 0 : 4 })}>{t.filters.rating4}</Chip>
      <Chip on={filters.verifiedOnly} onClick={() => set({ verifiedOnly: !filters.verifiedOnly })}>{t.filters.verified}</Chip>
      {activeFilterCount(filters) > 0 && (
        <Chip on={false} onClick={() => onChange(DEFAULT_FILTERS)}>{t.filters.clear}</Chip>
      )}
    </div>
  );
}
