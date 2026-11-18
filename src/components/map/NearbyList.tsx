"use client";

import Link from "next/link";
import { distanceMeters, formatDistance, walkingMinutes, type LatLng } from "@/lib/geo";
import { GENDER_LABEL, STATUS_LABEL, formatPrice } from "@/lib/labels";
import type { ToiletPin, ToiletStatus } from "@/types/toilet";

const STATUS_DOT: Record<ToiletStatus, string> = { open: "bg-green-500", closed: "bg-red-500", unknown: "bg-zinc-400" };
const MAX_ITEMS = 40;

/** Bottom sheet listing the toilets on screen, nearest first. */
export default function NearbyList({
  toilets,
  from,
  fromLabel,
  onClose,
}: {
  toilets: (ToiletPin & { shownStatus: ToiletStatus })[];
  from: LatLng;
  fromLabel: string;
  onClose: () => void;
}) {
  const sorted = toilets
    .map((t) => ({ t, d: distanceMeters(from, t) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, MAX_ITEMS);

  return (
    <div className="absolute inset-x-0 bottom-0 z-[1100] flex max-h-[65dvh] flex-col rounded-t-3xl bg-white text-zinc-900 shadow-[0_-8px_30px_rgba(0,0,0,0.2)]">
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
        <div>
          <h2 className="font-semibold">Nearby toilets ({toilets.length})</h2>
          <p className="text-xs text-zinc-500">Nearest to {fromLabel}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close list" className="text-2xl leading-none text-zinc-500">
          ×
        </button>
      </div>
      <ul className="overflow-y-auto">
        {sorted.length === 0 && <li className="px-5 py-6 text-center text-sm text-zinc-500">No toilets in this area match your filters.</li>}
        {sorted.map(({ t, d }) => (
          <li key={t.id}>
            <Link href={`/toilet/${t.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50">
              {t.coverPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote Supabase thumbnail
                <img src={t.coverPhotoUrl} alt="" className="size-14 shrink-0 rounded-xl object-cover" loading="lazy" />
              ) : (
                <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-2xl">🚻</div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{t.name}</p>
                <p className="flex items-center gap-1.5 text-xs text-zinc-600">
                  <span className={`size-2 rounded-full ${STATUS_DOT[t.shownStatus]}`} />
                  {STATUS_LABEL[t.shownStatus]} · {GENDER_LABEL[t.gender]} · {formatPrice(t.isPaid, t.priceBdt)}
                </p>
                {t.reviewCount > 0 && <p className="text-xs text-amber-600">★ {t.avgRating.toFixed(1)} ({t.reviewCount})</p>}
              </div>
              <div className="shrink-0 text-right text-sm">
                <p className="font-semibold">{formatDistance(d)}</p>
                <p className="text-xs text-zinc-500">{walkingMinutes(d)} min</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
