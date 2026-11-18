import type { LatLng } from "./geo";

/**
 * Parses a PostGIS point returned by PostgREST as hex (E)WKB,
 * e.g. "0101000020E6100000<x:8 bytes><y:8 bytes>". Returns null if it isn't a point.
 */
export function parseWkbPoint(hex: string): LatLng | null {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length < 42) return null;
  const bytes = new Uint8Array(hex.match(/../g)!.map((b) => parseInt(b, 16)));
  const view = new DataView(bytes.buffer);
  const little = bytes[0] === 1;

  const type = view.getUint32(1, little);
  const hasSrid = (type & 0x20000000) !== 0;
  if ((type & 0xffff) !== 1) return null; // 1 = Point

  const offset = 5 + (hasSrid ? 4 : 0);
  if (bytes.length < offset + 16) return null;
  const lng = view.getFloat64(offset, little);
  const lat = view.getFloat64(offset + 8, little);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}
