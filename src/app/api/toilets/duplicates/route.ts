import type { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withJsonErrors } from "@/lib/server/config";

const DUPLICATE_RADIUS_M = 20;

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/** GET /api/toilets/duplicates?lat=&lng= — toilets already listed within 20 m. */
export const GET = withJsonErrors(async (request: NextRequest) => {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return Response.json({ error: "lat and lng are required" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("toilets_near_point", {
    lat: parsed.data.lat,
    lng: parsed.data.lng,
    radius_m: DUPLICATE_RADIUS_M,
  });
  if (error) {
    console.error("toilets_near_point failed", error);
    return Response.json({ error: "Could not check for duplicates" }, { status: 502 });
  }

  const duplicates = (data as { id: string; name: string; distance_m: number }[]).map((d) => ({
    id: d.id,
    name: d.name,
    distanceM: Math.round(d.distance_m),
  }));
  return Response.json({ duplicates });
});
