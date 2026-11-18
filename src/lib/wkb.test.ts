import { describe, expect, it } from "vitest";
import { parseWkbPoint } from "./wkb";

/** Builds little-endian EWKB for POINT(lng lat) with SRID 4326. */
function ewkb(lng: number, lat: number): string {
  const buf = new ArrayBuffer(25);
  const v = new DataView(buf);
  v.setUint8(0, 1);
  v.setUint32(1, 0x20000001, true);
  v.setUint32(5, 4326, true);
  v.setFloat64(9, lng, true);
  v.setFloat64(17, lat, true);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

describe("parseWkbPoint", () => {
  it("reads an EWKB point (as PostgREST returns geography)", () => {
    const hex = ewkb(90.3957, 23.7383);
    expect(hex.startsWith("0101000020e6100000")).toBe(true);
    expect(parseWkbPoint(hex)).toEqual({ lat: 23.7383, lng: 90.3957 });
  });
  it("rejects garbage", () => {
    expect(parseWkbPoint("not hex")).toBeNull();
    expect(parseWkbPoint("0101")).toBeNull();
  });
});
