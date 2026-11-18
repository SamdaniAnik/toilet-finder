"use client";

import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import L from "leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import InstallButton from "@/components/pwa/InstallButton";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useOnline } from "@/hooks/useOnline";
import { useT } from "@/i18n/LanguageProvider";
import LanguageToggle from "@/i18n/LanguageToggle";
import { DEFAULT_FILTERS, matchesFilters, type Filters } from "@/lib/filters";
import FilterBar from "./FilterBar";
import EmergencySheet from "./EmergencySheet";
import NearbyList from "./NearbyList";
import SearchBar, { type Place } from "./SearchBar";
import { BD_BOUNDS, DHAKA, distanceMeters, isInBangladesh, walkingMinutes, type LatLng } from "@/lib/geo";
import { effectiveStatus } from "@/lib/labels";
import type { ToiletPin, ToiletStatus } from "@/types/toilet";

/** Below this zoom we don't load pins (the area would be too large). */
const MIN_FETCH_ZOOM = 11;
const USER_ZOOM = 16;

// A little padding so border towns aren't stuck at the edge of the screen.
const MAX_BOUNDS = L.latLngBounds(
  [BD_BOUNDS.minLat - 0.5, BD_BOUNDS.minLng - 0.5],
  [BD_BOUNDS.maxLat + 0.5, BD_BOUNDS.maxLng + 0.5],
);

type ShownToilet = ToiletPin & { shownStatus: ToiletStatus };
type LoadState = "idle" | "loading" | "ok" | "offline" | "zoom-in" | "no-db" | "error";

// ---------------------------------------------------------------------------
// Marker icons (cached per variant)
// ---------------------------------------------------------------------------
const iconCache = new Map<string, L.DivIcon>();

/** Bubble showing how many toilets are grouped together when zoomed out. */
function clusterIcon(cluster: { getChildCount: () => number }): L.DivIcon {
  const n = cluster.getChildCount();
  const size = n < 10 ? 36 : n < 100 ? 42 : 50;
  return L.divIcon({
    className: "",
    html: `<div class="toilet-cluster" style="width:${size}px;height:${size}px">${n}</div>`,
    iconSize: [size, size],
  });
}

function toiletIcon(status: ToiletStatus, isPaid: boolean, isVerified: boolean): L.DivIcon {
  const key = `${status}-${isPaid}-${isVerified}`;
  let icon = iconCache.get(key);
  if (!icon) {
    icon = L.divIcon({
      className: "",
      html: `<div class="toilet-pin toilet-pin--${status}${isVerified ? "" : " toilet-pin--unverified"}">
               <span aria-hidden="true">🚻</span>
               ${isPaid ? '<span class="toilet-pin__badge">৳</span>' : ""}
             </div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -18],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

// ---------------------------------------------------------------------------
// Child components that need the Leaflet map instance
// ---------------------------------------------------------------------------

/** Loads toilets for the visible area whenever the map stops moving. */
function ToiletLoader({
  onToilets,
  onState,
}: {
  onToilets: (t: ShownToilet[]) => void;
  onState: (s: LoadState) => void;
}) {
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    (map: L.Map) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        if (map.getZoom() < MIN_FETCH_ZOOM) {
          abortRef.current?.abort();
          onToilets([]);
          onState("zoom-in");
          return;
        }
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;

        const b = map.getBounds();
        const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => n.toFixed(5)).join(",");
        onState("loading");
        try {
          const res = await fetch(`/api/toilets?bbox=${bbox}`, { signal: ctrl.signal });
          if (res.status === 503) return onState("no-db");
          if (!res.ok) return onState("error");
          const { toilets } = (await res.json()) as { toilets: ToiletPin[] };
          const now = Date.now();
          onToilets(toilets.map((t) => ({ ...t, shownStatus: effectiveStatus(t.status, t.statusUpdatedAt, now) })));
          // The service worker answers from saved toilets when there's no connection.
          onState(res.headers.get("X-Offline") ? "offline" : "ok");
        } catch (err) {
          if ((err as Error).name !== "AbortError") onState("error");
        }
      }, 300);
    },
    [onToilets, onState],
  );

  const map = useMapEvents({ moveend: () => load(map) });

  useEffect(() => {
    load(map);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [map, load]);

  return null;
}

/**
 * Keeps the map centred on the user while `following` is on. The first fix flies
 * in to street zoom; later (better) fixes just pan. Dragging the map turns following off.
 */
function FollowUser({
  position,
  following,
  onStopFollowing,
}: {
  position: LatLng | null;
  following: boolean;
  onStopFollowing: () => void;
}) {
  const map = useMap();
  const zoomedIn = useRef(false);

  useMapEvents({ dragstart: onStopFollowing });

  useEffect(() => {
    if (!following || !position || !isInBangladesh(position)) return;
    if (!zoomedIn.current) {
      zoomedIn.current = true;
      map.flyTo([position.lat, position.lng], Math.max(map.getZoom(), USER_ZOOM), { duration: 1 });
    } else {
      map.panTo([position.lat, position.lng], { animate: true });
    }
  }, [map, position, following]);

  return null;
}

/** Above this, the fix is a Wi-Fi/IP guess rather than GPS. */
const APPROXIMATE_ACCURACY_M = 500;

type Focus = { lat: number; lng: number; toiletId: string | null };

/** `/?lat=&lng=&toilet=` — centre on a spot (e.g. a toilet just added) instead of the user. */
function readFocusFromUrl(): Focus | null {
  const q = new URLSearchParams(window.location.search);
  const lat = Number(q.get("lat"));
  const lng = Number(q.get("lng"));
  if (!q.has("lat") || !q.has("lng") || !isInBangladesh({ lat, lng })) return null;
  return { lat, lng, toiletId: q.get("toilet") };
}


// ---------------------------------------------------------------------------
// Popup
// ---------------------------------------------------------------------------
const STATUS_TEXT_CLASS: Record<ToiletStatus, string> = {
  open: "text-green-700",
  closed: "text-red-700",
  unknown: "text-zinc-500",
};

function ToiletPopup({ toilet, user }: { toilet: ShownToilet; user: LatLng | null }) {
  const t = useT();
  const distance = user ? distanceMeters(user, toilet) : null;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${toilet.lat},${toilet.lng}&travelmode=walking`;

  return (
    <div className="min-w-48 space-y-1 text-sm">
      {toilet.coverPhotoUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- remote Supabase image inside a Leaflet popup
        <img src={toilet.coverPhotoUrl} alt="" className="mb-2 h-28 w-full rounded object-cover" loading="lazy" />
      )}
      <p className="text-base font-semibold leading-tight">{toilet.name}</p>
      <p>
        {t.gender[toilet.gender]} · {t.price(toilet.isPaid, toilet.priceBdt)}
      </p>
      <p className={`font-medium ${STATUS_TEXT_CLASS[toilet.shownStatus]}`}>{t.status[toilet.shownStatus]}</p>
      <p className="text-zinc-600">
        {toilet.reviewCount > 0 ? `★ ${t.num.one(toilet.avgRating)} (${t.num.int(toilet.reviewCount)})` : t.map.noReviews}
        {!toilet.isVerified && ` · ${t.map.unverified}`}
      </p>
      {distance != null && (
        <p className="text-zinc-600">
          {t.distance(distance)} · {t.walk(walkingMinutes(distance))}
        </p>
      )}
      <div className="mt-1 flex gap-2">
        <Link href={`/toilet/${toilet.id}`} className="rounded bg-blue-600 px-3 py-1 font-medium !text-white">
          {t.map.details}
        </Link>
        <a
          href={directions}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border border-blue-600 px-3 py-1 font-medium !text-blue-700"
        >
          {t.map.directions}
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main map
// ---------------------------------------------------------------------------
export default function ToiletMap() {
  const geo = useGeolocation();
  const [map, setMap] = useState<L.Map | null>(null);
  const [toilets, setToilets] = useState<ShownToilet[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  // This component only renders in the browser (see MapLoader), so window is available.
  const [focus] = useState(readFocusFromUrl);
  const [following, setFollowing] = useState(!focus);
  const stopFollowing = useCallback(() => setFollowing(false), []);

  // Open the focused toilet's popup once its marker has loaded, then tidy the URL.
  const focusMarker = useRef<L.Marker | null>(null);
  const focusDone = useRef(false);
  useEffect(() => {
    if (focusDone.current || !focus) return;
    if (!focus.toiletId || focusMarker.current) {
      focusMarker.current?.openPopup();
      focusDone.current = true;
      window.history.replaceState(null, "", "/");
    }
  }, [focus, toilets]);

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const visible = useMemo(() => toilets.filter((t) => matchesFilters(t, filters)), [toilets, filters]);
  const [listFrom, setListFrom] = useState<{ point: LatLng; fromUser: boolean } | null>(null);

  const [emergency, setEmergency] = useState(false);
  const showOnMap = useCallback(
    (p: LatLng) => {
      setFollowing(false);
      map?.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 17), { duration: 0.8 });
    },
    [map],
  );

  const goToPlace = (p: Place) => {
    if (!map) return;
    setFollowing(false);
    if (p.bbox) {
      const [s, n, w, e] = p.bbox;
      map.flyToBounds([[s, w], [n, e]], { maxZoom: 17, duration: 1 });
    } else {
      map.flyTo([p.lat, p.lng], 16, { duration: 1 });
    }
  };

  const openList = () => {
    if (!map) return;
    const userHere = geo.status === "ready" && isInBangladesh(geo.position) && map.getBounds().contains([geo.position.lat, geo.position.lng]);
    const c = map.getCenter();
    setListFrom(userHere ? { point: geo.position, fromUser: true } : { point: { lat: c.lat, lng: c.lng }, fromUser: false });
  };

  const t = useT();
  const online = useOnline();
  const user = geo.status === "ready" ? geo.position : null;
  const accuracy = geo.status === "ready" ? geo.accuracy : null;
  const userInBd = user ? isInBangladesh(user) : false;
  const approximate = accuracy != null && accuracy > APPROXIMATE_ACCURACY_M;

  const locate = () => {
    if (!map) return;
    setFollowing(true);
    map.flyTo(user && userInBd ? [user.lat, user.lng] : [DHAKA.lat, DHAKA.lng], USER_ZOOM, { duration: 0.8 });
  };

  const notice = (() => {
    if (!online || loadState === "offline")
      return t.map.offline;
    if (geo.status === "denied") return t.map.locationOff;
    if (geo.status === "unavailable") return t.map.locationUnavailable;
    if (user && !userInBd) return t.map.outsideBd;
    if (approximate) return t.map.approximate(t.accuracy(accuracy));
    if (loadState === "zoom-in") return t.map.zoomIn;
    if (loadState === "no-db") return t.map.noDb;
    if (loadState === "error") return t.map.loadError;
    if (loadState === "ok" && toilets.length === 0) return t.map.noneHere;
    if (loadState === "ok" && visible.length === 0) return t.map.noneMatch;
    return null;
  })();

  return (
    <div className="relative h-full w-full">
      <MapContainer
        ref={setMap}
        center={focus ? [focus.lat, focus.lng] : [DHAKA.lat, DHAKA.lng]}
        zoom={focus ? 18 : 13}
        minZoom={7}
        maxBounds={MAX_BOUNDS}
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
        <ToiletLoader onToilets={setToilets} onState={setLoadState} />
        <FollowUser position={user} following={following} onStopFollowing={stopFollowing} />

        {user && geo.status === "ready" && (
          <>
            <Circle
              center={[user.lat, user.lng]}
              radius={geo.accuracy}
              pathOptions={{ color: "#2563eb", weight: 1, fillOpacity: 0.1 }}
              interactive={false}
            />
            <CircleMarker
              center={[user.lat, user.lng]}
              radius={8}
              pathOptions={{ color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }}
              interactive={false}
            />
          </>
        )}

        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={50}
          disableClusteringAtZoom={17}
          spiderfyOnMaxZoom={false}
          showCoverageOnHover={false}
          iconCreateFunction={clusterIcon}
        >
        {visible.map((t) => (
          <Marker
            key={t.id}
            ref={t.id === focus?.toiletId ? focusMarker : undefined}
            position={[t.lat, t.lng]}
            icon={toiletIcon(t.shownStatus, t.isPaid, t.isVerified)}
          >
            <Popup>
              <ToiletPopup toilet={t} user={user} />
            </Popup>
          </Marker>
        ))}
        </MarkerClusterGroup>
      </MapContainer>

      {/* Header */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex flex-col items-center gap-2 p-3">
        <h1 className="sr-only">{t.common.appName}</h1>
        <div className="pointer-events-auto w-full max-w-xl">
          <SearchBar
            user={user}
            onPlace={goToPlace}
            trailing={
              <span className="flex shrink-0 items-center gap-2 text-xs text-zinc-500">
                {(loadState === "loading" || geo.status === "loading") && <span aria-live="polite">…</span>}
                {accuracy != null && (
                  <span
                    title={t.map.accuracyTitle}
                    className={`rounded-full px-2 py-0.5 font-medium ${approximate ? "bg-amber-100 text-amber-800" : "bg-blue-50 text-blue-700"}`}
                  >
                    📍 {t.accuracy(accuracy)}
                  </span>
                )}
                <LanguageToggle />
              </span>
            }
          />
        </div>
        <div className="pointer-events-auto flex w-full justify-center">
          <FilterBar filters={filters} onChange={setFilters} />
        </div>
        {notice && (
          <p role="status" className="pointer-events-auto max-w-xl rounded-lg bg-zinc-900/85 px-3 py-1.5 text-center text-sm text-white">
            {notice}
          </p>
        )}
        <InstallButton label={t.map.install} dismissLabel={t.map.dontShowAgain} />
      </div>

      {/* Bottom actions: nearby list + add toilet */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-[1000] flex justify-center gap-2 px-16">
        <button
          type="button"
          onClick={() => {
            setEmergency(false);
            openList();
          }}
          className="pointer-events-auto shrink-0 rounded-full bg-white px-4 py-3.5 text-sm font-semibold text-zinc-900 shadow-lg active:scale-95"
        >
          ☰ {t.map.list}
          {visible.length > 0 && ` (${t.num.int(visible.length)})`}
        </button>
        <Link
          href="/add"
          className="pointer-events-auto truncate rounded-full bg-blue-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg active:scale-95"
        >
          ＋ {t.map.addToilet}
        </Link>
      </div>
      {listFrom && (
        <NearbyList toilets={visible} from={listFrom.point} fromUser={listFrom.fromUser} onClose={() => setListFrom(null)} />
      )}

      {emergency && <EmergencySheet geo={geo} onClose={() => setEmergency(false)} onShow={showOnMap} />}

      {/* Emergency: nearest usable toilet */}
      <button
        type="button"
        onClick={() => {
          setListFrom(null);
          setEmergency(true);
        }}
        aria-label={t.emergency.button}
        title={t.emergency.button}
        className="absolute bottom-40 right-2.5 z-[1000] flex size-12 items-center justify-center rounded-full bg-red-600 text-2xl shadow-lg ring-4 ring-red-600/25 active:scale-95"
      >
        🚨
      </button>

      {/* Locate me */}
      <button
        type="button"
        onClick={locate}
        aria-label={t.map.goToMyLocation}
        title={t.map.myLocation}
        aria-pressed={following}
        className={`absolute bottom-24 right-2.5 z-[1000] flex size-11 items-center justify-center rounded-full shadow-md active:scale-95 ${following && user ? "bg-blue-600" : "bg-white"}`}
      >
        <svg
          viewBox="0 0 24 24"
          className={`size-6 ${following && user ? "text-white" : "text-blue-600"}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
