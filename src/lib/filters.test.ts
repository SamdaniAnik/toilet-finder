import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, activeFilterCount, matchesFilters } from "./filters";
import type { ToiletPin, ToiletStatus } from "@/types/toilet";

const toilet = (over: Partial<ToiletPin & { shownStatus: ToiletStatus }> = {}) => ({
  id: "1",
  name: "T",
  lat: 23.8,
  lng: 90.4,
  gender: "separate" as const,
  isPaid: false,
  priceBdt: null,
  status: "open" as const,
  statusUpdatedAt: null,
  avgRating: 4.2,
  reviewCount: 3,
  isVerified: true,
  coverPhotoUrl: null,
  shownStatus: "open" as const,
  ...over,
});

describe("matchesFilters", () => {
  it("matches everything with default filters", () => {
    expect(matchesFilters(toilet(), DEFAULT_FILTERS)).toBe(true);
  });
  it("lets women use female, separate and unisex toilets, not male-only", () => {
    const f = { ...DEFAULT_FILTERS, gender: "female" as const };
    expect(matchesFilters(toilet({ gender: "separate" }), f)).toBe(true);
    expect(matchesFilters(toilet({ gender: "unisex" }), f)).toBe(true);
    expect(matchesFilters(toilet({ gender: "male" }), f)).toBe(false);
  });
  it("filters free, open, verified and rating", () => {
    expect(matchesFilters(toilet({ isPaid: true }), { ...DEFAULT_FILTERS, freeOnly: true })).toBe(false);
    expect(matchesFilters(toilet({ shownStatus: "unknown" }), { ...DEFAULT_FILTERS, openNow: true })).toBe(false);
    expect(matchesFilters(toilet({ isVerified: false }), { ...DEFAULT_FILTERS, verifiedOnly: true })).toBe(false);
    expect(matchesFilters(toilet({ avgRating: 3.5 }), { ...DEFAULT_FILTERS, minRating: 4 })).toBe(false);
    expect(matchesFilters(toilet({ reviewCount: 0, avgRating: 0 }), { ...DEFAULT_FILTERS, minRating: 3 })).toBe(false);
  });
  it("counts active filters", () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, freeOnly: true, gender: "male" })).toBe(2);
  });
});
