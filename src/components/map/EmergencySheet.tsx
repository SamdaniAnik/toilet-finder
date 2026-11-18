"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { GeoState } from "@/hooks/useGeolocation";
import { useT } from "@/i18n/LanguageProvider";
import { readJson } from "@/lib/client/http";
import { rankForEmergency } from "@/lib/emergency";
import { walkingMinutes, type LatLng } from "@/lib/geo";
import { effectiveStatus } from "@/lib/labels";
import type { ToiletPin, ToiletStatus } from "@/types/toilet";

type Candidate = ToiletPin & { distanceM: number; shownStatus: ToiletStatus };
type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; list: Candidate[]; radiusKm: number };

/** Bottom sheet: the nearest usable toilet right now, with a one-tap "Go". */
export default function EmergencySheet({ geo, onClose, onShow }: { geo: GeoState; onClose: () => void; onShow: (p: LatLng) => void }) {
  const t = useT();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [index, setIndex] = useState(0);
  const position = geo.status === "ready" ? geo.position : null;
  const lat = position?.lat;
  const lng = position?.lng;

  // Search once per opening, from the first location fix (not on every GPS update).
  const searched = useRef(false);
  const ctrlRef = useRef<AbortController | null>(null);
  useEffect(() => () => ctrlRef.current?.abort(), []);

  useEffect(() => {
    if (lat == null || lng == null || searched.current) return;
    searched.current = true;
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    (async () => {
      try {
        const res = await fetch(`/api/toilets/nearby?lat=${lat}&lng=${lng}`, { signal: ctrl.signal });
        const data = await readJson<{ toilets: (ToiletPin & { distanceM: number })[]; radiusM: number }>(res);
        if (!res.ok) throw new Error(data.error ?? t.common.somethingWrong);
        const now = Date.now();
        const list = rankForEmergency(
          data.toilets.map((x) => ({ ...x, shownStatus: effectiveStatus(x.status, x.statusUpdatedAt, now) })),
        );
        setIndex(0);
        setState({ kind: "ready", list, radiusKm: data.radiusM / 1000 });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setState({ kind: "error", message: (err as Error).name === "TypeError" ? t.common.offline : (err as Error).message });
      }
    })();
  }, [lat, lng, t]);

  const pick = state.kind === "ready" ? state.list[index] : undefined;
  useEffect(() => {
    if (pick) onShow({ lat: pick.lat, lng: pick.lng });
  }, [pick, onShow]);

  const body = (() => {
    if (geo.status === "denied" || geo.status === "unavailable") return <p className="text-zinc-700">{t.emergency.needLocation}</p>;
    if (!position) return <p className="text-zinc-500">{t.emergency.waitingLocation}</p>;
    if (state.kind === "loading") return <p className="text-zinc-500">{t.emergency.finding}</p>;
    if (state.kind === "error") return <p className="text-red-700">{state.message}</p>;
    if (!pick) return <p className="text-zinc-700">{t.emergency.none(state.radiusKm)}</p>;

    const directions = `https://www.google.com/maps/dir/?api=1&destination=${pick.lat},${pick.lng}&travelmode=walking`;
    return (
      <div className="space-y-3">
        {pick.shownStatus === "closed" && <p className="text-sm font-medium text-red-700">{t.emergency.allClosed}</p>}
        <div>
          <p className="text-lg font-semibold leading-tight">{pick.name}</p>
          <p className="text-sm text-zinc-600">
            {pick.shownStatus === "open" ? t.emergency.open : pick.shownStatus === "unknown" ? t.emergency.unknown : t.status.closed} ·{" "}
            {t.gender[pick.gender]} · {t.price(pick.isPaid, pick.priceBdt)}
          </p>
          <p className="mt-1 text-2xl font-bold text-blue-700">
            {t.distance(pick.distanceM)} <span className="text-base font-medium text-zinc-600">· {t.walk(walkingMinutes(pick.distanceM))}</span>
          </p>
        </div>
        <a href={directions} target="_blank" rel="noopener noreferrer" className="block rounded-xl bg-red-600 py-3.5 text-center text-lg font-bold text-white">
          {t.emergency.go}
        </a>
        <div className="flex items-center justify-between text-sm">
          <Link href={`/toilet/${pick.id}`} className="font-medium text-blue-700">
            {t.emergency.details}
          </Link>
          {state.list.length > 1 && (
            <button type="button" onClick={() => setIndex((i) => (i + 1) % state.list.length)} className="font-medium text-zinc-700">
              {t.emergency.another} ({t.emergency.ofCount(index + 1, state.list.length)})
            </button>
          )}
        </div>
      </div>
    );
  })();

  return (
    <div
      role="dialog"
      aria-label={t.emergency.title}
      className="absolute inset-x-0 bottom-0 z-[1200] space-y-3 rounded-t-3xl bg-white p-5 pb-7 text-zinc-900 shadow-[0_-8px_30px_rgba(0,0,0,0.25)]"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">🚨 {t.emergency.title}</h2>
        <button type="button" onClick={onClose} aria-label={t.emergency.close} className="text-2xl leading-none text-zinc-500">
          ×
        </button>
      </div>
      {body}
    </div>
  );
}
