import { cacheLife } from "next/cache";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { withJsonErrors } from "@/lib/server/config";
import { jsonError } from "@/lib/server/request";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SearchResult } from "@/types/toilet";

const querySchema = z.string().trim().min(2).max(80);

type NominatimPlace = {
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox?: [string, string, string, string]; // [south, north, west, east]
};

/**
 * Place search via OpenStreetMap Nominatim, limited to Bangladesh. Cached for a day
 * per query to respect Nominatim's usage policy (max ~1 request/second, identify the app).
 */
async function searchPlaces(q: string): Promise<SearchResult["places"]> {
  "use cache";
  cacheLife("days");

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ q, format: "jsonv2", countrycodes: "bd", limit: "5", "accept-language": "en,bn" }).toString();
  const res = await fetch(url, {
    headers: { "User-Agent": "ToiletFinderBD/1.0 (community toilet map)" },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const places = (await res.json()) as NominatimPlace[];

  return places.map((p) => {
    const parts = p.display_name.split(",").map((s) => s.trim());
    const bb = p.boundingbox?.map(Number);
    return {
      name: p.name || parts[0],
      detail: parts.slice(1, 4).join(", "),
      lat: Number(p.lat),
      lng: Number(p.lon),
      bbox: bb && bb.every(Number.isFinite) ? [bb[0], bb[1], bb[2], bb[3]] : null,
    };
  });
}

/** GET /api/search?q= — toilets by name plus places in Bangladesh. */
export const GET = withJsonErrors(async (request: NextRequest) => {
  const parsed = querySchema.safeParse(request.nextUrl.searchParams.get("q") ?? "");
  if (!parsed.success) return jsonError("Type at least 2 characters", 400);
  const q = parsed.data;

  const supabase = createAdminClient();
  const [toiletsRes, places] = await Promise.all([
    supabase.rpc("search_toilets", { q, lim: 5 }),
    // Place search failing shouldn't break toilet search.
    searchPlaces(q).catch((err) => {
      console.error("place search failed", err);
      return [] as SearchResult["places"];
    }),
  ]);
  if (toiletsRes.error) throw new Error(toiletsRes.error.message);

  const result: SearchResult = {
    toilets: (toiletsRes.data as { id: string; name: string; lat: number; lng: number; gender: SearchResult["toilets"][number]["gender"]; is_paid: boolean }[]).map((t) => ({
      id: t.id,
      name: t.name,
      lat: t.lat,
      lng: t.lng,
      gender: t.gender,
      isPaid: t.is_paid,
    })),
    places,
  };
  return Response.json(result);
});
