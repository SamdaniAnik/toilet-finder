import type { Gender, ToiletPin, ToiletStatus } from "@/types/toilet";

export type GenderFilter = "any" | "male" | "female" | "accessible";

export type Filters = {
  gender: GenderFilter;
  freeOnly: boolean;
  openNow: boolean;
  verifiedOnly: boolean;
  minRating: 0 | 3 | 4;
};

export const DEFAULT_FILTERS: Filters = {
  gender: "any",
  freeOnly: false,
  openNow: false,
  verifiedOnly: false,
  minRating: 0,
};

/** Which toilet types a person of each filter can use. */
const USABLE_BY: Record<Exclude<GenderFilter, "any">, Gender[]> = {
  male: ["male", "separate", "unisex"],
  female: ["female", "separate", "unisex"],
  accessible: ["accessible"],
};

export function matchesFilters(t: ToiletPin & { shownStatus: ToiletStatus }, f: Filters): boolean {
  if (f.gender !== "any" && !USABLE_BY[f.gender].includes(t.gender)) return false;
  if (f.freeOnly && t.isPaid) return false;
  if (f.openNow && t.shownStatus !== "open") return false;
  if (f.verifiedOnly && !t.isVerified) return false;
  if (f.minRating > 0 && (t.reviewCount === 0 || t.avgRating < f.minRating)) return false;
  return true;
}

export function activeFilterCount(f: Filters): number {
  return (
    (f.gender !== "any" ? 1 : 0) +
    (f.freeOnly ? 1 : 0) +
    (f.openNow ? 1 : 0) +
    (f.verifiedOnly ? 1 : 0) +
    (f.minRating > 0 ? 1 : 0)
  );
}
