import { describe, expect, it } from "vitest";
import { DHAKA, distanceMeters, formatDistance, isInBangladesh, walkingMinutes } from "./geo";

describe("isInBangladesh", () => {
  it("accepts Dhaka and Chattogram", () => {
    expect(isInBangladesh(DHAKA)).toBe(true);
    expect(isInBangladesh({ lat: 22.3569, lng: 91.7832 })).toBe(true);
  });
  // Note: this is a bounding box, so nearby Indian border areas (e.g. Kolkata) pass.
  it("rejects Patna and London", () => {
    expect(isInBangladesh({ lat: 25.5941, lng: 85.1376 })).toBe(false);
    expect(isInBangladesh({ lat: 51.5072, lng: -0.1276 })).toBe(false);
  });
});

describe("distanceMeters", () => {
  it("is zero for the same point", () => {
    expect(distanceMeters(DHAKA, DHAKA)).toBe(0);
  });
  it("Dhaka → Chattogram is about 213 km", () => {
    const d = distanceMeters(DHAKA, { lat: 22.3569, lng: 91.7832 });
    expect(d).toBeGreaterThan(205_000);
    expect(d).toBeLessThan(220_000);
  });
});

describe("formatDistance / walkingMinutes", () => {
  it("formats metres and kilometres", () => {
    expect(formatDistance(347)).toBe("350 m");
    expect(formatDistance(1234)).toBe("1.2 km");
    expect(formatDistance(15_600)).toBe("16 km");
  });
  it("estimates walking time", () => {
    expect(walkingMinutes(10)).toBe(1);
    expect(walkingMinutes(400)).toBe(5);
  });
});
