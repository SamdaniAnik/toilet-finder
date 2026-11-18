"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { readJson } from "@/lib/client/http";
import { distanceMeters, formatDistance, type LatLng } from "@/lib/geo";
import { GENDER_LABEL } from "@/lib/labels";
import type { SearchResult } from "@/types/toilet";

export type Place = SearchResult["places"][number];

const MIN_CHARS = 2;
const DEBOUNCE_MS = 350;

/** Search box for toilets (by name) and places in Bangladesh. */
export default function SearchBar({ user, onPlace, trailing }: { user: LatLng | null; onPlace: (p: Place) => void; trailing?: React.ReactNode }) {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = q.trim();
    if (query.length < MIN_CHARS) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        const data = await readJson<SearchResult>(res);
        if (!res.ok) throw new Error(data.error ?? "Search failed");
        setResult(data);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError((err as Error).message);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  // Close the dropdown when tapping elsewhere.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const showDropdown = open && q.trim().length >= MIN_CHARS;
  const empty = result && result.toilets.length === 0 && result.places.length === 0;

  return (
    <div ref={boxRef} className="relative w-full max-w-xl">
      <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-md">
        <span className="text-xl" aria-hidden="true">🚻</span>
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            if (e.target.value.trim().length < MIN_CHARS) setResult(null);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          placeholder="Search toilets or places…"
          aria-label="Search toilets or places"
          className="min-w-0 flex-1 bg-transparent text-base text-zinc-900 outline-none placeholder:text-zinc-500"
        />
        {q && (
          <button type="button" aria-label="Clear search" onClick={() => { setQ(""); setResult(null); }} className="text-lg text-zinc-400">
            ×
          </button>
        )}
        {trailing}
      </div>

      {showDropdown && (
        <div className="absolute inset-x-0 top-full mt-2 max-h-[60dvh] overflow-y-auto rounded-2xl bg-white py-2 text-zinc-900 shadow-xl">
          {loading && !result && <p className="px-4 py-2 text-sm text-zinc-500">Searching…</p>}
          {error && <p className="px-4 py-2 text-sm text-red-700">{error}</p>}
          {empty && !loading && <p className="px-4 py-2 text-sm text-zinc-500">No results for “{q.trim()}”.</p>}

          {result && result.toilets.length > 0 && (
            <>
              <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Toilets</p>
              {result.toilets.map((t) => (
                <Link key={t.id} href={`/toilet/${t.id}`} className="block px-4 py-2 hover:bg-zinc-50">
                  <p className="font-medium">🚻 {t.name}</p>
                  <p className="text-xs text-zinc-500">
                    {GENDER_LABEL[t.gender]} · {t.isPaid ? "Paid" : "Free"}
                    {user && ` · ${formatDistance(distanceMeters(user, t))}`}
                  </p>
                </Link>
              ))}
            </>
          )}

          {result && result.places.length > 0 && (
            <>
              <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Places</p>
              {result.places.map((p) => (
                <button
                  key={`${p.lat},${p.lng}`}
                  type="button"
                  onClick={() => {
                    onPlace(p);
                    setOpen(false);
                  }}
                  className="block w-full px-4 py-2 text-left hover:bg-zinc-50"
                >
                  <p className="font-medium">📍 {p.name}</p>
                  {p.detail && <p className="text-xs text-zinc-500">{p.detail}</p>}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
