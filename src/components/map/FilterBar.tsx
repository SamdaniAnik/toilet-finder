"use client";

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

const GENDER_CHIPS: { value: Exclude<GenderFilter, "any">; label: string }[] = [
  { value: "female", label: "🚺 Women" },
  { value: "male", label: "🚹 Men" },
  { value: "accessible", label: "♿ Accessible" },
];

/** Horizontally scrolling filter chips. */
export default function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  return (
    <div className="flex w-full max-w-xl gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
      <Chip on={filters.openNow} onClick={() => set({ openNow: !filters.openNow })}>🟢 Open now</Chip>
      <Chip on={filters.freeOnly} onClick={() => set({ freeOnly: !filters.freeOnly })}>Free</Chip>
      {GENDER_CHIPS.map((g) => (
        <Chip key={g.value} on={filters.gender === g.value} onClick={() => set({ gender: filters.gender === g.value ? "any" : g.value })}>
          {g.label}
        </Chip>
      ))}
      <Chip on={filters.minRating === 4} onClick={() => set({ minRating: filters.minRating === 4 ? 0 : 4 })}>★ 4+</Chip>
      <Chip on={filters.verifiedOnly} onClick={() => set({ verifiedOnly: !filters.verifiedOnly })}>✓ Verified</Chip>
      {activeFilterCount(filters) > 0 && (
        <Chip on={false} onClick={() => onChange(DEFAULT_FILTERS)}>✕ Clear</Chip>
      )}
    </div>
  );
}
