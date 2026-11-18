"use client";

import Link from "next/link";
import { useT } from "@/i18n/LanguageProvider";
import { distanceMeters, walkingMinutes, type LatLng } from "@/lib/geo";
import type { ToiletPin, ToiletStatus } from "@/types/toilet";

const STATUS_DOT: Record<ToiletStatus, string> = { open: "bg-green-500", closed: "bg-red-500", unknown: "bg-zinc-400" };
const MAX_ITEMS = 40;

/** Bottom sheet listing the toilets on screen, nearest first. */
export default function NearbyList({
  toilets,
  from,
  fromUser,
  onClose,
}: {
  toilets: (ToiletPin & { shownStatus: ToiletStatus })[];
  from: LatLng;
  /** Distances are from the user (true) or from the map centre (false). */
  fromUser: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const sorted = toilets
    .map((toilet) => ({ toilet, d: distanceMeters(from, toilet) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, MAX_ITEMS);

  return (
    <div className="absolute inset-x-0 bottom-0 z-[1100] flex max-h-[65dvh] flex-col rounded-t-3xl bg-white text-zinc-900 shadow-[0_-8px_30px_rgba(0,0,0,0.2)]">
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
        <div>
          <h2 className="font-semibold">{t.nearby.title(toilets.length)}</h2>
          <p className="text-xs text-zinc-500">{t.nearby.nearestTo(fromUser ? t.nearby.you : t.nearby.mapCentre)}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={t.nearby.close} className="text-2xl leading-none text-zinc-500">
          ×
        </button>
      </div>
      <ul className="overflow-y-auto">
        {sorted.length === 0 && <li className="px-5 py-6 text-center text-sm text-zinc-500">{t.nearby.empty}</li>}
        {sorted.map(({ toilet, d }) => (
          <li key={toilet.id}>
            <Link href={`/toilet/${toilet.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50">
              {toilet.coverPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote Supabase thumbnail
                <img src={toilet.coverPhotoUrl} alt="" className="size-14 shrink-0 rounded-xl object-cover" loading="lazy" />
              ) : (
                <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-2xl">🚻</div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{toilet.name}</p>
                <p className="flex items-center gap-1.5 text-xs text-zinc-600">
                  <span className={`size-2 shrink-0 rounded-full ${STATUS_DOT[toilet.shownStatus]}`} />
                  {t.status[toilet.shownStatus]} · {t.gender[toilet.gender]} · {t.price(toilet.isPaid, toilet.priceBdt)}
                </p>
                {toilet.reviewCount > 0 && (
                  <p className="text-xs text-amber-600">
                    ★ {t.num.one(toilet.avgRating)} ({t.num.int(toilet.reviewCount)})
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right text-sm">
                <p className="font-semibold">{t.distance(d)}</p>
                <p className="text-xs text-zinc-500">{t.minutes(walkingMinutes(d))}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
