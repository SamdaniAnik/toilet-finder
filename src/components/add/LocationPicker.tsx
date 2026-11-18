"use client";

import "leaflet/dist/leaflet.css";
import type L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useT } from "@/i18n/LanguageProvider";
import LanguageToggle from "@/i18n/LanguageToggle";
import { BD_BOUNDS, DHAKA, isInBangladesh, type LatLng } from "@/lib/geo";

const PICK_ZOOM = 18;

/** Tracks the map centre, and follows the user's location until they move the map. */
function CentreTracker({
  user,
  onCentre,
}: {
  user: LatLng | null;
  onCentre: (c: LatLng) => void;
}) {
  const map = useMap();
  const userMoved = useRef(false);
  const flown = useRef(false);

  useMapEvents({
    dragstart: () => (userMoved.current = true),
    move: () => {
      const c = map.getCenter();
      onCentre({ lat: c.lat, lng: c.lng });
    },
  });

  useEffect(() => {
    if (userMoved.current || !user || !isInBangladesh(user)) return;
    if (!flown.current) {
      flown.current = true;
      map.setView([user.lat, user.lng], PICK_ZOOM);
    } else {
      map.panTo([user.lat, user.lng]);
    }
  }, [map, user]);

  return null;
}

export default function LocationPicker({
  initial,
  onConfirm,
  onCancel,
}: {
  initial: LatLng | null;
  onConfirm: (point: LatLng) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const geo = useGeolocation();
  const user = geo.status === "ready" ? geo.position : null;
  const [centre, setCentre] = useState<LatLng>(initial ?? DHAKA);
  const [map, setMap] = useState<L.Map | null>(null);
  const inBd = isInBangladesh(centre);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        ref={setMap}
        center={[centre.lat, centre.lng]}
        zoom={initial ? PICK_ZOOM : 13}
        minZoom={7}
        maxBounds={[
          [BD_BOUNDS.minLat - 0.5, BD_BOUNDS.minLng - 0.5],
          [BD_BOUNDS.maxLat + 0.5, BD_BOUNDS.maxLng + 0.5],
        ]}
        maxBoundsViscosity={1}
        zoomControl={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          crossOrigin="anonymous"
          maxZoom={19}
        />
        <ZoomControl position="bottomright" />
        {/* Only auto-follow GPS when we weren't given a starting point. */}
        <CentreTracker user={initial ? null : user} onCentre={setCentre} />
        {user && (
          <CircleMarker
            center={[user.lat, user.lng]}
            radius={7}
            pathOptions={{ color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }}
            interactive={false}
          />
        )}
      </MapContainer>

      {/* Fixed centre pin: the tip of the pin marks the chosen point. */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-[1000] -translate-x-1/2 -translate-y-full">
        <svg width="40" height="52" viewBox="0 0 40 52" aria-hidden="true" className="drop-shadow-md">
          <path d="M20 0C9 0 0 9 0 20c0 15 20 32 20 32s20-17 20-32C40 9 31 0 20 0z" fill="#dc2626" />
          <circle cx="20" cy="20" r="8" fill="#fff" />
        </svg>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] p-3">
        <div className="pointer-events-auto mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-md">
          <button type="button" onClick={onCancel} className="text-2xl leading-none text-zinc-500" aria-label={t.common.cancel}>
            ×
          </button>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-zinc-900">{t.add.whereTitle}</p>
            <p className="text-sm text-zinc-600">{t.add.whereHint}</p>
          </div>
          <LanguageToggle />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-[1000] flex flex-col items-center gap-2 p-4 pb-6">
        {user && (
          <button
            type="button"
            onClick={() => map?.setView([user.lat, user.lng], PICK_ZOOM)}
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-blue-700 shadow"
          >
            {t.add.useMyLocation}
          </button>
        )}
        {!inBd && <p className="rounded bg-zinc-900/85 px-3 py-1 text-sm text-white">{t.add.pickInBd}</p>}
        <button
          type="button"
          disabled={!inBd}
          onClick={() => onConfirm(centre)}
          className="w-full max-w-xl rounded-xl bg-blue-600 py-3.5 text-base font-semibold text-white shadow-lg disabled:bg-zinc-400"
        >
          {t.add.confirmLocation}
        </button>
      </div>
    </div>
  );
}
