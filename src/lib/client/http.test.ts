import { describe, expect, it } from "vitest";
import { readJson } from "./http";

describe("readJson", () => {
  it("parses JSON bodies", async () => {
    expect(await readJson(Response.json({ id: "x" }))).toEqual({ id: "x" });
  });
  it("turns an empty 500 into a readable error", async () => {
    const data = await readJson(new Response(null, { status: 500 }));
    expect(data.error).toMatch(/Server error \(500\)/);
  });
  it("handles HTML error pages", async () => {
    const data = await readJson(new Response("<html>oops</html>", { status: 502 }));
    expect(data.error).toMatch(/502/);
  });
  it("explains 413", async () => {
    const data = await readJson(new Response("", { status: 413 }));
    expect(data.error).toMatch(/too large/);
  });
});
