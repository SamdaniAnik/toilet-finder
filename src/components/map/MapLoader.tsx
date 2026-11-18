"use client";

import dynamic from "next/dynamic";
import { useT } from "@/i18n/LanguageProvider";

function MapLoading() {
  const t = useT();
  return <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-zinc-500">{t.map.loadingMap}</div>;
}

// Leaflet touches `window`, so the map only renders in the browser.
const ToiletMap = dynamic(() => import("./ToiletMap"), {
  ssr: false,
  loading: () => <MapLoading />,
});

export default function MapLoader() {
  return <ToiletMap />;
}
