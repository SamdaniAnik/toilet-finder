export type LatLng = { lat: number; lng: number };

/** Bangladesh bounding box (matches the DB check constraint). */
export const BD_BOUNDS = {
  minLat: 20.5,
  maxLat: 26.7,
  minLng: 88.0,
  maxLng: 92.7,
} as const;

/** Map fallback centre when location is unavailable or outside Bangladesh. */
export const DHAKA: LatLng = { lat: 23.8103, lng: 90.4125 };

export function isInBangladesh({ lat, lng }: LatLng): boolean {
  return (
    lat >= BD_BOUNDS.minLat &&
    lat <= BD_BOUNDS.maxLat &&
    lng >= BD_BOUNDS.minLng &&
    lng <= BD_BOUNDS.maxLng
  );
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres (Haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** "350 m" / "1.2 km" */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

const WALK_M_PER_MIN = 80;

/** Walking minutes, at least 1. */
export function walkingMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / WALK_M_PER_MIN));
}
