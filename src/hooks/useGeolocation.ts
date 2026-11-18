"use client";

import { useEffect, useState } from "react";
import { distanceMeters, type LatLng } from "@/lib/geo";

export type GeoState =
  | { status: "loading" }
  | { status: "ready"; position: LatLng; accuracy: number; timestamp: number }
  | { status: "denied" }
  | { status: "unavailable" };

/** After this long, accept a new fix even if it's less accurate (we may have moved). */
const STALE_FIX_MS = 15_000;

/**
 * Should a new fix replace the current one?
 * Browsers often send a rough Wi-Fi/IP fix first and then better GPS fixes, and
 * sometimes a worse fix in between. Keep the most accurate recent fix, but always
 * accept a fix that is fresh enough or shows we've clearly moved.
 */
export function shouldAcceptFix(
  prev: { position: LatLng; accuracy: number; timestamp: number } | null,
  next: { position: LatLng; accuracy: number; timestamp: number },
): boolean {
  if (!prev) return true;
  if (next.accuracy <= prev.accuracy) return true;
  if (next.timestamp - prev.timestamp > STALE_FIX_MS) return true;
  // Moved further than both uncertainty circles combined: it's real movement.
  return distanceMeters(prev.position, next.position) > prev.accuracy + next.accuracy;
}

/** Watches the device location with high accuracy. Stops watching on unmount. */
export function useGeolocation(): GeoState {
  const [state, setState] = useState<GeoState>(() =>
    typeof navigator !== "undefined" && !("geolocation" in navigator)
      ? { status: "unavailable" }
      : { status: "loading" },
  );

  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const next = {
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        setState((prev) =>
          shouldAcceptFix(prev.status === "ready" ? prev : null, next) ? { status: "ready", ...next } : prev,
        );
      },
      (err) => {
        // Keep the last known position if a later update times out.
        setState((prev) =>
          prev.status === "ready"
            ? prev
            : { status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" },
        );
      },
      // maximumAge 0 = never reuse a cached (possibly rough) position.
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  return state;
}
