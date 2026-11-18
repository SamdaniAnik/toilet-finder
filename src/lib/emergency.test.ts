import { describe, expect, it } from "vitest";
import { rankForEmergency } from "./emergency";

describe("rankForEmergency", () => {
  it("prefers open, then unknown, then closed; nearest first in each", () => {
    const ranked = rankForEmergency([
      { id: "closed-near", shownStatus: "closed" as const, distanceM: 50 },
      { id: "unknown-near", shownStatus: "unknown" as const, distanceM: 100 },
      { id: "open-far", shownStatus: "open" as const, distanceM: 900 },
      { id: "open-near", shownStatus: "open" as const, distanceM: 300 },
      { id: "unknown-far", shownStatus: "unknown" as const, distanceM: 400 },
    ]);
    expect(ranked.map((t) => t.id)).toEqual(["open-near", "open-far", "unknown-near", "unknown-far", "closed-near"]);
  });

  it("does not modify the input", () => {
    const input = [
      { shownStatus: "closed" as const, distanceM: 1 },
      { shownStatus: "open" as const, distanceM: 2 },
    ];
    rankForEmergency(input);
    expect(input[0].shownStatus).toBe("closed");
  });
});
