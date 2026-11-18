import { describe, expect, it } from "vitest";
import { MESSAGES } from "./messages";

/** Flattens nested message keys (functions count as leaves). */
function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("messages", () => {
  it("Bangla has exactly the same keys as English", () => {
    expect(keys(MESSAGES.bn).sort()).toEqual(keys(MESSAGES.en).sort());
  });

  it("report reasons offer the same choices in both languages", () => {
    for (const type of ["toilet", "photo", "review", "comment"] as const) {
      expect(MESSAGES.bn.report.reasons[type].map((r) => r.value)).toEqual(MESSAGES.en.report.reasons[type].map((r) => r.value));
    }
  });

  it("formats distances and prices with Bengali digits", () => {
    expect(MESSAGES.en.distance(347)).toBe("350 m");
    expect(MESSAGES.en.distance(1234)).toBe("1.2 km");
    expect(MESSAGES.en.distance(15_600)).toBe("16 km");
    expect(MESSAGES.bn.distance(347)).toBe("৩৫০ মি.");
    expect(MESSAGES.bn.distance(1234)).toBe("১.২ কিমি");
    expect(MESSAGES.bn.price(true, 10)).toBe("৳১০");
    expect(MESSAGES.bn.price(false, null)).toBe("ফ্রি");
    expect(MESSAGES.en.walk(5)).toBe("~5 min walk");
    expect(MESSAGES.bn.walk(5)).toBe("হেঁটে ~৫ মিনিট");
  });
});
