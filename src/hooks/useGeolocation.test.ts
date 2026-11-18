import { describe, expect, it } from "vitest";
import { shouldAcceptFix } from "./useGeolocation";

const at = (lat: number, lng: number, accuracy: number, timestamp: number) => ({
  position: { lat, lng },
  accuracy,
  timestamp,
});

describe("shouldAcceptFix", () => {
  it("accepts the first fix", () => {
    expect(shouldAcceptFix(null, at(23.8, 90.4, 2000, 0))).toBe(true);
  });
  it("accepts a more accurate fix (rough Wi-Fi → GPS)", () => {
    expect(shouldAcceptFix(at(23.8, 90.4, 2000, 0), at(23.81, 90.41, 10, 1000))).toBe(true);
  });
  it("ignores a worse fix shortly after a good one", () => {
    expect(shouldAcceptFix(at(23.8, 90.4, 10, 0), at(23.8001, 90.4001, 1500, 3000))).toBe(false);
  });
  it("accepts a worse fix once the good one is stale", () => {
    expect(shouldAcceptFix(at(23.8, 90.4, 10, 0), at(23.8, 90.4, 50, 20_000))).toBe(true);
  });
  it("accepts a worse fix that shows clear movement", () => {
    // ~1.1 km north, accuracy circles 10 m + 60 m
    expect(shouldAcceptFix(at(23.8, 90.4, 10, 0), at(23.81, 90.4, 60, 2000))).toBe(true);
  });
});
