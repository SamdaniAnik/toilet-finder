"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window`, so the map only renders in the browser.
const ToiletMap = dynamic(() => import("./ToiletMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-zinc-500">Loading map…</div>
  ),
});

export default function MapLoader() {
  return <ToiletMap />;
}
