import { describe, expect, it } from "vitest";
import { timeAgo } from "./time";

const now = new Date("2026-11-18T12:00:00Z").getTime();
const ago = (s: number) => new Date(now - s * 1000).toISOString();

describe("timeAgo", () => {
  it("handles very recent times", () => {
    expect(timeAgo(ago(10), now)).toBe("now");
    expect(timeAgo(ago(10), now, "bn")).toBe("এখন");
  });
  it("uses the largest sensible unit", () => {
    expect(timeAgo(ago(5 * 60), now)).toMatch(/5 min/);
    expect(timeAgo(ago(2 * 3600), now)).toMatch(/2 hr/);
    expect(timeAgo(ago(24 * 3600), now)).toBe("yesterday");
    expect(timeAgo(ago(3 * 24 * 3600), now)).toMatch(/3 days/);
  });
});

describe("timeAgo in Bangla", () => {
  it("uses Bangla words and digits", () => {
    expect(timeAgo(ago(2 * 3600), now, "bn")).toMatch(/২ ঘন্টা আগে/);
    expect(timeAgo(ago(24 * 3600), now, "bn")).toBe("গতকাল");
  });
});
