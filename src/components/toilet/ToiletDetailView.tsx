"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Stars } from "@/components/ui/Stars";
import { errorText, postJson } from "@/components/ui/useCaptchaSubmit";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useT } from "@/i18n/LanguageProvider";
import LanguageToggle from "@/i18n/LanguageToggle";
import { readJson } from "@/lib/client/http";
import { apiFetch } from "@/lib/client/visitor";
import { distanceMeters, walkingMinutes } from "@/lib/geo";
import { effectiveStatus } from "@/lib/labels";
import { ago } from "@/lib/time";
import type { ToiletDetail, ToiletStatus } from "@/types/toilet";
import AddPhotos from "./AddPhotos";
import CommentSection from "./CommentSection";
import ReportButton from "./ReportButton";
import ReviewSection from "./ReviewSection";

const STATUS_STYLE: Record<ToiletStatus, string> = {
  open: "bg-green-100 text-green-800",
  closed: "bg-red-100 text-red-800",
  unknown: "bg-zinc-100 text-zinc-700",
};

const VERIFY_TARGET = 3;

function Gallery({ toilet, onReported }: { toilet: ToiletDetail; onReported: () => void }) {
  const t = useT();
  if (toilet.photos.length === 0) {
    return <div className="flex h-56 items-center justify-center bg-zinc-100 text-5xl">🚻</div>;
  }
  const total = toilet.photos.length;
  return (
    <div className="flex h-64 snap-x snap-mandatory gap-1 overflow-x-auto bg-zinc-900 sm:h-80">
      {toilet.photos.map((p, i) => (
        <div key={p.id} className="relative h-full w-full shrink-0 snap-center sm:w-auto">
          <a href={p.url} target="_blank" rel="noopener noreferrer" className="block h-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote Supabase photo */}
            <img
              src={p.url}
              alt={t.detail.photoAlt(i + 1, total, toilet.name)}
              className="h-full w-full object-cover sm:w-auto"
              loading={i === 0 ? "eager" : "lazy"}
            />
          </a>
          <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
            {t.num.int(i + 1)}/{t.num.int(total)} · {p.authorName ?? t.common.anonymous}
          </span>
          <span className="absolute right-2 top-2 rounded bg-white/90 px-2 py-0.5">
            <ReportButton targetType="photo" targetId={p.id} onReported={onReported} />
          </span>
        </div>
      ))}
    </div>
  );
}

/** Open/closed voting. */
function StatusVote({ toilet, onChanged }: { toilet: ToiletDetail; onChanged: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const vote = async (status: "open" | "closed") => {
    setBusy(true);
    setMessage(null);
    try {
      await postJson(`/api/toilets/${toilet.id}/status`, { status });
      setMessage(t.detail.thanks);
      onChanged();
    } catch (err) {
      setMessage(errorText(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl bg-zinc-50 p-4">
      <p className="mb-2 font-semibold">{t.detail.isItOpen}</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => vote("open")}
          className="rounded-xl border-2 border-green-600 bg-white py-2.5 font-medium text-green-800 disabled:opacity-50"
        >
          {t.detail.itsOpen}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => vote("closed")}
          className="rounded-xl border-2 border-red-600 bg-white py-2.5 font-medium text-red-800 disabled:opacity-50"
        >
          {t.detail.itsClosed}
        </button>
      </div>
      {message && <p className="mt-2 text-sm text-zinc-700">{message}</p>}
    </div>
  );
}

/** "Yes, this toilet exists" — 3 confirmations verify it. */
function Confirm({ toilet, onChanged }: { toilet: ToiletDetail; onChanged: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (toilet.isVerified) return null;

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/toilets/${toilet.id}/confirm`, {});
      onChanged();
    } catch (err) {
      setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="font-semibold">{t.detail.unverified(toilet.confirmCount, VERIFY_TARGET)}</p>
      {toilet.isMine ? (
        <p className="mt-1">{t.detail.youAdded(VERIFY_TARGET)}</p>
      ) : toilet.confirmedByMe ? (
        <p className="mt-1">{t.detail.youConfirmed}</p>
      ) : (
        <>
          <p className="mt-1">{t.detail.seenIt}</p>
          <button
            type="button"
            disabled={busy}
            onClick={confirm}
            className="mt-2 rounded-xl bg-amber-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {t.detail.yesExists}
          </button>
        </>
      )}
      {error && <p className="mt-2 text-red-800">{error}</p>}
    </div>
  );
}

export default function ToiletDetailView({ id }: { id: string }) {
  const t = useT();
  const [toilet, setToilet] = useState<ToiletDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addingPhotos, setAddingPhotos] = useState(false);
  const [copied, setCopied] = useState(false);
  const geo = useGeolocation();

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/toilets/${id}`);
      const data = await readJson<ToiletDetail>(res);
      if (!res.ok) throw new Error(data.error ?? t.detail.notFound);
      setToilet(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorText(err, t));
    }
  }, [id, t]);

  useEffect(() => {
    // Fetch on mount; `load` only sets state after the request finishes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (loadError && !toilet) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-4xl">🚫</p>
        <p className="text-lg font-semibold">{loadError}</p>
        <Link href="/" className="rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white">
          {t.common.backToMap}
        </Link>
      </div>
    );
  }
  if (!toilet) {
    return <div className="flex min-h-dvh items-center justify-center text-zinc-500">{t.common.loading}</div>;
  }

  const status = effectiveStatus(toilet.status, toilet.statusUpdatedAt);
  const user = geo.status === "ready" ? geo.position : null;
  const distance = user ? distanceMeters(user, toilet) : null;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${toilet.lat},${toilet.lng}&travelmode=walking`;
  const facilities = [
    toilet.hasWater && t.add.water,
    toilet.hasSoap && t.add.soap,
    toilet.babyChanging && t.add.babyChanging,
  ].filter(Boolean) as string[];

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: toilet.name, text: t.detail.shareText(toilet.name), url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch {
      // User cancelled the share sheet.
    }
  };

  return (
    <div className="min-h-dvh bg-white pb-16 text-zinc-900">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur">
        <Link href={`/?lat=${toilet.lat}&lng=${toilet.lng}`} className="text-xl text-zinc-600" aria-label={t.common.backToMap}>
          ←
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{toilet.name}</h1>
        <LanguageToggle />
      </header>

      <Gallery toilet={toilet} onReported={load} />

      <main className="mx-auto max-w-xl space-y-6 px-4 pt-4">
        <section className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className={`rounded-full px-2.5 py-0.5 font-medium ${STATUS_STYLE[status]}`}>
              {t.status[status]}
              {toilet.statusUpdatedAt && status !== "unknown" && ` · ${ago(toilet.statusUpdatedAt, t.locale)}`}
            </span>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 font-medium text-blue-800">{t.gender[toilet.gender]}</span>
            <span className={`rounded-full px-2.5 py-0.5 font-medium ${toilet.isPaid ? "bg-amber-100 text-amber-900" : "bg-green-100 text-green-800"}`}>
              {t.price(toilet.isPaid, toilet.priceBdt)}
            </span>
            {toilet.isVerified && <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-medium text-emerald-800">{t.detail.verified}</span>}
          </div>
          {status !== "unknown" && toilet.recentStatusReports > 1 && (
            <p className="text-xs text-zinc-500">{t.detail.peopleSaid(toilet.recentStatusReports, t.status[status])}</p>
          )}
          {toilet.reviewCount > 0 && (
            <p className="flex items-center gap-1.5 text-sm">
              <Stars value={toilet.avgRating} /> {t.num.one(toilet.avgRating)} · {t.detail.reviews(toilet.reviewCount)}
            </p>
          )}
          {distance != null && (
            <p className="text-sm text-zinc-700">{t.detail.away(t.distance(distance), t.walk(walkingMinutes(distance)))}</p>
          )}
        </section>

        <div className="grid grid-cols-3 gap-2">
          <a
            href={directions}
            target="_blank"
            rel="noopener noreferrer"
            className="col-span-2 rounded-xl bg-blue-600 py-3 text-center font-semibold text-white"
          >
            {t.detail.directions}
          </a>
          <button type="button" onClick={share} className="rounded-xl border border-zinc-300 py-3 font-medium">
            {copied ? t.detail.linkCopied : t.detail.share}
          </button>
        </div>

        <StatusVote toilet={toilet} onChanged={load} />
        <Confirm toilet={toilet} onChanged={load} />

        {(facilities.length > 0 || toilet.description) && (
          <section className="space-y-2">
            {facilities.length > 0 && (
              <div className="flex flex-wrap gap-2 text-sm">
                {facilities.map((f) => (
                  <span key={f} className="rounded-full bg-zinc-100 px-3 py-1">
                    {f}
                  </span>
                ))}
              </div>
            )}
            {toilet.description && <p className="whitespace-pre-line text-zinc-800">{toilet.description}</p>}
          </section>
        )}

        <p className="flex items-center justify-between gap-2 text-xs text-zinc-500">
          <span>{t.detail.addedBy(toilet.authorName ?? t.common.anonymous, ago(toilet.createdAt, t.locale))}</span>
          {!toilet.isMine && <ReportButton targetType="toilet" targetId={toilet.id} onReported={load} />}
        </p>

        {addingPhotos ? (
          <AddPhotos
            toiletId={toilet.id}
            onCancel={() => setAddingPhotos(false)}
            onDone={() => {
              setAddingPhotos(false);
              void load();
            }}
          />
        ) : (
          <button type="button" onClick={() => setAddingPhotos(true)} className="w-full rounded-xl border border-zinc-300 py-2.5 font-medium">
            {t.detail.addPhotos}
          </button>
        )}

        <ReviewSection toilet={toilet} onChanged={load} />
        <CommentSection toilet={toilet} onChanged={load} />
      </main>
    </div>
  );
}
