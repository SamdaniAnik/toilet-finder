import type { NextRequest } from "next/server";
import { withJsonErrors } from "@/lib/server/config";
import { jsonError } from "@/lib/server/request";
import { createAdminClient, photoUrl } from "@/lib/supabase/admin";
import { nearbyQuerySchema } from "@/lib/validation";
import type { ToiletPin } from "@/types/toilet";

const RADIUS_M = 5000;

type NearbyRow = {
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
  distance_m: number;
};

/** GET /api/toilets/nearby?lat=&lng= — up to 30 toilets within 5 km, nearest first (for the emergency button). */
export const GET = withJsonErrors(async (request: NextRequest) => {
  const parsed = nearbyQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError("lat and lng are required", 400);

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("nearby_toilets", {
    lat: parsed.data.lat,
    lng: parsed.data.lng,
    radius_m: RADIUS_M,
    lim: 30,
  });
  if (error) throw new Error(error.message);

  const toilets = (data as NearbyRow[]).map((r) => ({
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
    distanceM: r.distance_m,
  }));
  return Response.json({ toilets, radiusM: RADIUS_M });
});
