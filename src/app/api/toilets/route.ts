import type { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient, photoUrl } from "@/lib/supabase/admin";
import type { ToiletPin } from "@/types/toilet";

const bboxSchema = z
  .string()
  .transform((s) => s.split(",").map(Number))
  .pipe(
    z.tuple([
      z.number().min(-180).max(180), // minLng
      z.number().min(-90).max(90), // minLat
      z.number().min(-180).max(180), // maxLng
      z.number().min(-90).max(90), // maxLat
    ]),
  )
  .refine(([minLng, minLat, maxLng, maxLat]) => minLng < maxLng && minLat < maxLat, "Invalid bbox");

type BboxRow = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  gender: ToiletPin["gender"];
  is_paid: boolean;
  price_bdt: number | string | null;
  current_status: ToiletPin["status"];
  status_updated_at: string | null;
  avg_rating: number | string;
  review_count: number;
  is_verified: boolean;
  cover_photo: string | null;
};

/** GET /api/toilets?bbox=minLng,minLat,maxLng,maxLat — toilets visible in the map area. */
export async function GET(request: NextRequest) {
  const parsed = bboxSchema.safeParse(request.nextUrl.searchParams.get("bbox") ?? "");
  if (!parsed.success) {
    return Response.json({ error: "bbox must be minLng,minLat,maxLng,maxLat" }, { status: 400 });
  }
  const [minLng, minLat, maxLng, maxLat] = parsed.data;

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  const { data, error } = await supabase.rpc("toilets_in_bbox", {
    min_lng: minLng,
    min_lat: minLat,
    max_lng: maxLng,
    max_lat: maxLat,
    lim: 500,
  });
  if (error) {
    console.error("toilets_in_bbox failed", error);
    // Network failure = Supabase not reachable (e.g. placeholder URL in .env.local).
    const unreachable = /fetch failed/i.test(error.message);
    return Response.json(
      { error: unreachable ? "Database not reachable" : "Could not load toilets" },
      { status: unreachable ? 503 : 502 },
    );
  }

  const toilets: ToiletPin[] = (data as BboxRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    gender: r.gender,
    isPaid: r.is_paid,
    priceBdt: r.price_bdt == null ? null : Number(r.price_bdt),
    status: r.current_status,
    statusUpdatedAt: r.status_updated_at,
    avgRating: Number(r.avg_rating),
    reviewCount: r.review_count,
    isVerified: r.is_verified,
    coverPhotoUrl: r.cover_photo ? photoUrl(r.cover_photo) : null,
  }));

  return Response.json({ toilets });
}
